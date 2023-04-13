import { chatCompletion } from '@/ai/api'
import { Tool } from '@/agent/tool'
import { log, verboseLog } from '@/utils/logger'
import chalk from 'chalk'
import { encode } from 'gpt-3-encoder'
import inquirer from 'inquirer'
import { oraPromise } from 'ora'
import fs from 'fs'
import { findRoot, splitOnce } from '@/utils/utils'

import { ChatMessage } from '@/types'
import { writeFileSync } from 'fs'

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
  scratchpad: string = ''

  toolNames: string

  toolDescriptions: string

  query?: string

  model: '3.5' | '4' = '3.5'

  // query states, newest first
  state: AgentState[] = []

  chatHistory: ChatMessage[] = []

  // how the agent thinks about the user's input
  requestParam = 'Request'
  // how the agent thinks about the action to take
  actionParam = 'Action'
  // how the agent thinks about the end state
  finalAnswerParam = 'Final Answer'

  constructor(public tools: Tool[], public outputFormat: string, public systemMessage?: string) {
    this.toolNames = tools.map((tool) => tool.name).join(', ')
    this.toolDescriptions = tools.map((tool) => `${tool.name}: ${tool.description}`).join('\n')
    if (systemMessage) this.chatHistory.push({ role: 'system', content: systemMessage })
    this.chatHistory.push({ role: 'user', content: this.constructPrompt() })
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
${this.requestParam}: the request you must fulfill
Thought: I know what files to edit
${this.finalAnswerParam}: ${this.outputFormat}

or

Thought: I need to use a tool to solve this problem
${this.actionParam}: the action to take, should be one or more of [${this.toolNames}] + input, e.g.
- grep: foo
- viewFile: path/to/file
Observation: the result of the actions
... (this Thought/${this.actionParam}/Observation can repeat N times)
Thought: I now know the final answer
${this.finalAnswerParam}: ...`

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
        if (observationLength + inProgressTokens > maxTokens)
          stateText.push('Observation: too long to fit')
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
${this.requestParam}: ${this.query}
${progressText}
`
    if (this.query) this.chatHistory.push({ role: 'assistant', content: progress })
    return [prefix, instructions, progress].join('\n\n')
  }

  runContinuous = async (query: string, limit: number = 5, pauseBetween: boolean = false) => {
    let forceAnswer = false
    for (let i = 0; i < limit; i++) {
      if (i == limit - 1) forceAnswer = true

      const result = await this.runOnce(query, forceAnswer)
      const root = findRoot()
      writeFileSync(root + '/.draftpilot/history.json', JSON.stringify(this.chatHistory, null, 2))

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

    const suffix = forceComplete
      ? 'Thought: the user wants me to answer immediately.\n' + this.finalAnswerParam + ':'
      : 'Thought:'
    const prompt = this.constructPrompt() + suffix

    verboseLog(prompt)
    const tempInput = '/tmp/agent.prompt'
    fs.writeFileSync(tempInput, this.systemMessage + '\n\n' + prompt)

    const promise = chatCompletion(prompt, this.model, this.systemMessage, '\nObservation')
    const response = await oraPromise(promise, { text: 'Analyzing next steps...' })

    log(chalk.bold(`Response:`))
    this.chatHistory.push({ role: 'assistant', content: response })
    const finalAnswerIndex = response.indexOf(this.finalAnswerParam + ':')
    const outputToLog = finalAnswerIndex > -1 ? response.slice(0, finalAnswerIndex) : response
    log(outputToLog)

    if (forceComplete)
      return {
        thought: 'I was forced to answer',
        finalAnswer: response,
      }

    const parsedResponse = await this.parseResponse(response)
    await this.runTools(parsedResponse)
    return parsedResponse
  }

  runTools = async (result: AgentState, skipLogObservation?: boolean) => {
    if (result.finalAnswer) {
      return result.finalAnswer
    }

    if (result.parsedAction) {
      const results: string[] = []
      for (const invocation of result.parsedAction) {
        const tool = this.tools.find((tool) => tool.name === invocation.tool)
        if (!tool) {
          results.push(`Tool ${invocation.tool} was not found`)
          continue
        }

        try {
          const result = await tool.run(invocation.input, this.query!)
          results.push(
            `Ran tool ${invocation.tool} with input ${invocation.input}\n` +
              (result ? result : 'Empty output returned')
          )
          continue
        } catch (e: any) {
          log(chalk.red('Error running tool:'), e.message)
          results.push(
            `Error running tool ${invocation.tool} with input ${invocation.input}\n` + e.toString()
          )
        }
      }
      result.observation = results.join('\n---\n')

      if (!skipLogObservation) {
        log(
          chalk.bold('Observation:'),
          result.observation.slice(0, 200),
          result.observation.length < 200 ? '' : '... (output truncated)'
        )
      }
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
      } else if (line.startsWith(this.actionParam + ':')) {
        transitionMode()
        buffer = []
        mode = 'action'
        buffer.push(line.replace(this.actionParam + ':', '').trim())
      } else if (line.startsWith(this.finalAnswerParam + ':')) {
        transitionMode()
        buffer = []
        mode = 'finalAnswer'
        buffer.push(line.replace(this.finalAnswerParam + ':', '').trim())
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

    for (let line of lines) {
      const sourceLine = line.startsWith('- ') ? line.slice(2) : line
      let [tool, input] = splitOnce(sourceLine, ' ').map((s) => s.trim())

      if (tool) {
        if (tool.endsWith(':')) tool = tool.slice(0, -1)
        invocations.push({ tool, input })
      } else {
        log(chalk.yellow('Warning:'), `Could not parse line: ${line}`)
        return null
      }
    }

    if (invocations.length) {
      return invocations
    }
    return null
  }
}
