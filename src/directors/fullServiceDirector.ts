import { getReadOnlyTools } from '@/agent'
import { Agent } from '@/agent/agent'
import { chatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { findRelevantDocs } from '@/directors/agentPlanner'
import { Attachment, ChatMessage, MessagePayload, Model } from '@/types'
import { log } from '@/utils/logger'
import { fuzzyMatchingFile } from '@/utils/utils'
import fs from 'fs'
import { encode } from 'gpt-3-encoder'
import path from 'path'

// the full-service agent is an all-in-one agent used by the web
// it is stateless and can do anything (with confirmation)

const MAX_PLAN_ITERATIONS = 5

enum InitialType {
  ANSWER = 'DIRECT_ANSWER',
  EDIT_REQUEST = 'EDIT_REQUEST',
  CONTEXT_NEEDED = 'CONTEXT_NEEDED',
  UPGRADE = 'UPGRADE',
}

enum PlanOutcome {
  CONFIRM = 'CONFIRM:',
  ANSWER = 'ANSWER:',
  ASK = 'ASK:',
  UPGRADE = 'UPGRADE',
}

export class FullServiceDirector {
  init = () => {
    indexer.loadFilesIntoVectors()
  }

  onMessage = async (payload: MessagePayload, postMessage: (message: ChatMessage) => void) => {
    const { message } = payload

    if (message.role == 'assistant') {
      await this.regenerateResponse(payload, postMessage)
    } else if (message.role == 'user') {
      await this.detectIntent(payload, postMessage)
    } else {
      log('got sent a system message, doing nothing')
    }
  }

  regenerateResponse = async (
    payload: MessagePayload,
    postMessage: (message: ChatMessage) => void
  ) => {
    const { message, history } = payload
    const model = message.options?.model || '3.5'
    const messages = compactMessageHistory(history, model)

    const answer = await chatWithHistory(messages, model)
    log(answer)

    postMessage({
      role: 'assistant',
      content: answer,
      options: { model },
    })
  }

  detectIntent = async (payload: MessagePayload, postMessage: (message: ChatMessage) => void) => {
    // determine what we're doing
    const { message, history } = payload

    const project = path.basename(process.cwd())
    const systemMessage =
      'You are an EngineerGPT, an assistant for software engineers running in a ' +
      'folder called ' +
      project

    const prompt = `Given my input, determine the type of request:
- can be answered with only the context provided, type = DIRECT_ANSWER, message = answer to the question or request.
- a file editing request that can be acted upon immediately, type = EDIT_REQUEST, message = proposed course of action
- requires additional context (from the file system, user, or internet), type = CONTEXT_NEEDED, message = the context needed to fulfill the request
- if request is complex, type = UPGRADE to upgrade to a slower, more powerful agent
- if none of these, type = DIRECT_ANSWER, message = ask the user for clarification and tell them to try again

Return in the format <type>: <message to the user>, e.g. DIRECT_ANSWER: the answer is 42

Analyze and categorize my query: `

    const attachmentBody = attachmentListToString(message.attachments)
    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt + message.content + attachmentBody,
    }
    const model = message.options?.model || '3.5'
    const messages = compactMessageHistory([...history, userMessage], model, {
      role: 'system',
      content: systemMessage,
    })

    const answer = await chatWithHistory(messages, model)
    log(answer)

    let foundType: InitialType | undefined
    let foundResponse: string = answer

    const types = [
      InitialType.ANSWER,
      InitialType.EDIT_REQUEST,
      InitialType.CONTEXT_NEEDED,
      InitialType.UPGRADE,
    ]
    for (const type of types) {
      if (answer.startsWith(type)) {
        foundType = type
        foundResponse = answer.substring(type.length + 1)
        break
      }
    }
    if (!foundType) {
      for (const type of types) {
        if (answer.includes(type)) {
          foundType = type
          foundResponse = answer.replace(type, '')
          break
        }
      }
    }
    if (!foundType) {
      foundType = InitialType.ANSWER
      foundResponse = answer
    }
    if (foundResponse.startsWith(':')) foundResponse = foundResponse.substring(1)

    postMessage({
      role: 'assistant',
      content: foundResponse,
      options: { model, type: foundType },
    })
  }

  useAnswerAgent = async (payload: MessagePayload, postMessage: (message: ChatMessage) => void) => {
    const { message, history } = payload

    const attachmentBody = attachmentListToString(message.attachments)
    const messages: ChatMessage[] = history
      ? [...pastMessages(history.slice(history.length - 4))]
      : []

    messages.push({
      role: 'user',
      content:
        'Answer this request if it can be answered directly, or if codebase access is needed, return USE_TOOLS:\n\n' +
        attachmentBody +
        message.content,
    })

    const options = message.options
    const answer = await chatWithHistory(messages, options?.model || '3.5')
    log(answer)

    if (answer.includes('USE_TOOLS') || answer.includes('your codebase')) {
      await this.usePlanningAgent(payload, attachmentBody, postMessage)
    } else {
      postMessage({ role: 'assistant', content: answer, options })
    }
  }

  usePlanningAgent = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    postMessage: (message: ChatMessage) => void
  ) => {
    let { message, history } = payload
    const { options } = message
    const tools = options?.tools ? getReadOnlyTools() : []

    const outputFormat =
      `either ${Outcome.CONFIRM} <proposed set of actions that user must approve>, ` +
      (options?.model != '4'
        ? `${Outcome.UPGRADE} to switch to super smart AI mode if request is complex, or `
        : '') +
      `${Outcome.ANSWER} <answer to user request if no action is needed>, or ` +
      `${Outcome.ASK} <question to ask user if you need more information>`

    const agent = new Agent(tools, outputFormat, SYSTEM_MESSAGE)
    agent.actionParam = 'ResearchAction'
    agent.finalAnswerParam = 'TellUser'
    agent.model = options?.model || '3.5'

    // user wants to regenerate this message
    if (message.role == 'assistant') {
      while (message.role != 'user') {
        agent.addState(message.state)
        message = history.pop()!
      }
    }
    agent.priorMessages = pastMessages(history)

    const query = message.content
    if (attachmentBody) {
      agent.addInitialState('View the referenced files', attachmentBody)
    } else {
      const relevantDocs = await findRelevantDocs(query, indexer.files)
      agent.addInitialState('What are the most relevant files to this query?', relevantDocs)
    }

    for (let i = 0; i < MAX_PLAN_ITERATIONS; i++) {
      const result = await agent.runOnce(query, i == MAX_PLAN_ITERATIONS - 1)
      log(result)

      if (
        result.finalAnswer?.includes(Outcome.UPGRADE) ||
        result.thought?.includes(Outcome.UPGRADE)
      ) {
        if (agent.model != '4') {
          i--
          agent.model = '4'
          continue
        }
      }

      if (result.thought) {
        const upperThought = result.thought.toUpperCase()
        // sometimes the final answer gets stuck in the thought

        const keywords = [Outcome.CONFIRM, Outcome.ANSWER, Outcome.ASK]
        let index = -1
        for (const keyword of keywords) {
          if (upperThought.includes(keyword)) {
            index = upperThought.indexOf(keyword)
            break
          }
        }
        if (index !== -1) {
          result.finalAnswer = result.thought.substring(index)
          result.thought = result.thought.substring(0, index)
        }
      }

      const content = result.finalAnswer ? result.finalAnswer : 'Thought: ' + result.thought

      const newMessage: ChatMessage = {
        role: 'assistant',
        content,
        options,
        attachments: result.observations?.map((o) => ({
          type: 'observation',
          name: o.tool + (o.input ? ' ' + o.input : ''),
          content: o.output,
        })),
        state: result,
      }
      postMessage(newMessage)

      if (result.finalAnswer || !result.action) break
      agent.addState(result)
    }
  }

  useActingAgent = async (payload: MessagePayload, postMessage: (message: ChatMessage) => void) => {
    const { message } = payload
    const { options } = message
    postMessage({ role: 'assistant', content: 'Acting agent not implemented yet', options })
  }
}

function pastMessages(history: ChatMessage[]) {
  const pastMessages: ChatMessage[] = []
  history.forEach((msg) => {
    if (msg.role == 'system') return
    pastMessages.push({
      role: msg.role,
      content: msg.content,
    })
  })
  return pastMessages
}

// fit as many messages as possible into the token budget
function compactMessageHistory(messages: ChatMessage[], model: Model, systemMessage?: ChatMessage) {
  let tokenBudget = model == '4' ? 6000 : 3500

  if (systemMessage) tokenBudget -= encode(systemMessage.content).length

  const history: ChatMessage[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]

    tokenBudget -= encode(msg.content).length
    if (tokenBudget < 0) break
    history.push({
      role: msg.role,
      content: msg.content,
    })
  }
  if (systemMessage) history.push(systemMessage)
  history.reverse()
  return history
}

function attachmentListToString(attachments: Attachment[] | undefined) {
  return attachments
    ?.map((attachment) => {
      if (attachment.content) {
        return attachment.name + '\n---\n' + attachment.content
      } else if (attachment.type === 'file') {
        const filePath = fuzzyMatchingFile(attachment.name, indexer.files)
        if (filePath) {
          return filePath + '\n---\n' + fs.readFileSync(filePath, 'utf8') + '\n---\n'
        }
      }
    })
    .filter(Boolean)
    .join('\n')
}
