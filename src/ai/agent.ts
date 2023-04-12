import { chatCompletion } from '@/ai/api'
import { Tool } from '@/tools/tool'
import { log, verboseLog } from '@/utils/logger'
import chalk from 'chalk'
import { encode } from 'gpt-3-encoder'
import inquirer from 'inquirer'
import { oraPromise } from 'ora'
import fs from 'fs'
import { splitOnce } from '@/utils/utils'

import { ChatMessage } from '@/types'
type ToolInvocation = {
  tool: string
  input: string
}

type AgentState = {
  thought: string
  action?: string
  parsedAction?: ToolInvocation[]
  finalAnswer?: string
  observation?: string
}

// an agent iteratively uses tools to solve a problem
// inspired by langchain
export class Agent {
  systemMessage?: string

  scratchpad: string = ''

  toolNames: string

  toolDescriptions: string

  query?: string

  model: '3.5' | '4' = '3.5'

  // query states, newest first
  state: AgentState[] = []

  chatHistory: ChatMessage[] = []

  constructor(public tools: Tool[], public outputFormat: string) {
    this.toolNames = tools.map((tool) => tool.name).join(', ')
    this.toolDescriptions = tools.map((tool) => `${tool.name}: ${tool.description}`).join('\n')
  }

  addInitialState = (thought: string, observation: string) => {
    this.state.unshift({
      thought,
      observation,
    })
  }

  constructPrompt = () => {
    const prefix = `You have access to the following tools:
${this.toolDescriptions}`

    const instructions = `Use the following format:
Request: the request you must fulfill
Thought: you should always think about what to do
Action: the action to take, should be one or more of [${this.toolNames}] + input, e.g.
- grep: foo
- viewFile: path/to/file
Observation: the result of the actions
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: ${this.outputFormat}`

    const inProgressState: string[] = []
    let inProgressTokens = 0
    const maxTokens = 3500

    for (let i = 0; i < this.state.length; i++) {
      const state = this.state[i]
      const stateText: string[] = []

      if (state.thought) stateText.push(`Thought: ${state.thought}`)
      if (state.action) stateText.push(`Action: ${state.action}`)

      if (state.observation) {
        const observationLength = encode(state.observation).length
        if (i > 0 && observationLength > 500) stateText.push('Observation: too long to fit')
        else stateText.push(`Observation: ${state.observation}`)
      }

      const stateBlurb = stateText.join('\n')
      const totalLength = encode(stateBlurb).length
      if (inProgressTokens + totalLength > maxTokens) {
        if (i == 0) throw new Error('State too large to fit in prompt')
        break
      }

      inProgressTokens += totalLength
      inProgressState.push(stateBlurb)
    }

    inProgressState.reverse()
    const progressText = inProgressState.join('\n')

    const progress = `
Begin!
Request: ${this.query}
${progressText}
`
    return [prefix, instructions, progress].join('\n\n')
  }

  runContinuous = async (query: string, limit: number = 5, pauseBetween: boolean = false) => {
    let forceAnswer = false
    for (let i = 0; i < limit; i++) {
      if (i == limit - 1) forceAnswer = true

      const result = await this.runOnce(query, forceAnswer)

      if (result.finalAnswer) {
        return result.finalAnswer
      }

      this.state.unshift(result)
      const askedUser = result.parsedAction?.some((invocation) => invocation.tool == 'askUser')

      if (!forceAnswer && pauseBetween && !askedUser) {
        log(
          chalk.bold(
            "Allow the agent to iterate again? Type 'n' to force answer, or type text to add comments for the agent"
          )
        )
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'continue',
            message: '>',
          },
        ])

        const continueLower = response.continue.toLowerCase()
        if (continueLower == 'n' || continueLower == 'no') {
          forceAnswer = true
        } else if (continueLower == 'y' || continueLower == 'yes') {
          forceAnswer = false
        } else if (response.continue != '') {
          this.state.unshift({
            thought: 'From user: ' + response.continue,
          })
          this.chatHistory.push({ role: 'user', content: response.continue })
        }
      }
    }

    return 'Could not find answer'
  }

  runOnce = async (query: string, forceComplete?: boolean): Promise<AgentState> => {
    this.query = query

    const suffix = forceComplete ? 'Final Answer:' : 'Thought:'
    const prompt = this.constructPrompt() + suffix

    verboseLog(prompt)
    const tempInput = '/tmp/agent.prompt'
    fs.writeFileSync(tempInput, this.systemMessage + '\n\n' + prompt)

    const promise = chatCompletion(prompt, this.model, this.systemMessage, '\nObservation')
    const response = await oraPromise(promise, { text: 'Analyzing next steps...' })

    log(chalk.bold(`Response:`))
    this.chatHistory.push({ role: 'assistant', content: response })
    log(response)

    if (forceComplete)
      return {
        thought: 'I was forced to answer',
        finalAnswer: response,
      }

    const parsedResponse = await this.parseResponse(response)
    await this.runTools(parsedResponse)
    return parsedResponse
  }

  runTools = async (result: AgentState) => {
    if (result.finalAnswer) {
      log(chalk.bold('Final Answer:'), result.finalAnswer)
      return result.finalAnswer
    }

    if (result.parsedAction) {
      const results: string[] = await Promise.all(
        result.parsedAction.map(async (invocation) => {
          const tool = this.tools.find((tool) => tool.name === invocation.tool)
          if (!tool) {
            return `Tool ${invocation.tool} was not found`
          }

          try {
            const result = await tool.run(invocation.input)
            return (
              `Ran tool ${invocation.tool} with input ${invocation.input}\n` +
              (result ? result : 'Empty output returned')
            )
          } catch (e: any) {
            log(chalk.red('Error running tool:'), e.message)
            return (
              `Error running tool ${invocation.tool} with input ${invocation.input}\n` +
              e.toString()
            )
          }
        })
      )
      result.observation = results.join('\n---\n')

      log(
        chalk.bold('Observation:'),
        result.observation.slice(0, 200),
        result.observation.length < 200 ? '' : '...'
      )
    }
  }

  parseResponse = async (response: string): Promise<AgentState> => {
    const lines = response.split('\n').filter(Boolean)

    const result: AgentState = {
      thought: '',
    }

    let mode: 'thought' | 'action' | 'finalAnswer' = 'thought'
    let buffer: string[] = []

    const transitionMode = () => {
      result[mode] = (result[mode] || '') + buffer.join('\n')
    }

    for (const line of lines) {
      if (line.startsWith('Thought:')) {
        buffer.push(line.replace('Thought:', '').trim())
      } else if (line.startsWith('Action:')) {
        transitionMode()
        buffer = []
        mode = 'action'
        buffer.push(line.replace('Action:', '').trim())
      } else if (line.startsWith('Final Answer:')) {
        transitionMode()
        buffer = []
        mode = 'finalAnswer'
        buffer.push(line.replace('Final Answer:', '').trim())
      } else {
        buffer.push(line)
      }
    }
    transitionMode()

    if (result.action) {
      let parsedAction = this.parseActions(result.action)
      if (!parsedAction) {
        log(
          "I couldn't parse the result. Please help by giving the response in a proper format (Action: toolname: input). " +
            'If you are able, please submit the result as a issue on GitHub.'
        )
        const response = await inquirer.prompt({
          type: 'input',
          name: 'response',
          message: '>',
        })
        parsedAction = this.parseActions(response.response)!
      }
      result.parsedAction = parsedAction || undefined
    }

    return result
  }

  /**
   * results typically of the form:
   *
   * Action: toolName: input
   *
   * Action:
   * - toolName: input
   */
  parseActions = (result: string): ToolInvocation[] | null => {
    const invocations: ToolInvocation[] = []
    const lines = result.split('\n').filter(Boolean)

    for (const line of lines) {
      let [tool, input] = splitOnce(line, ' ').map((s) => s.trim())

      if (tool && input) {
        if (tool.endsWith(':')) tool = tool.slice(0, -1)
        invocations.push({ tool, input })
      } else {
        log(chalk.yellow('Warning:'), `Could not parse line: ${line}`)
      }
    }

    if (invocations.length) {
      return invocations
    }
    return null
  }
}
