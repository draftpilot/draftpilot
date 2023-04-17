import { getReadOnlyTools } from '@/agent'
import { Agent } from '@/agent/agent'
import { chatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { CodebaseEditor } from '@/directors/codebaseEditor'
import {
  attachmentListToString,
  compactMessageHistory,
  detectProjectLanguage,
  detectTypeFromResponse,
  pastMessages,
} from '@/directors/helpers'
import { WebPlanner } from '@/directors/webPlanner'
import { ChatMessage, Intent, MessagePayload, PostMessage } from '@/types'
import { log } from '@/utils/logger'
import path from 'path'

// the full-service agent is an all-in-one agent used by the web
// it is stateless and can do anything (with confirmation)

export class FullServiceDirector {
  init = () => {
    indexer.loadFilesIntoVectors()
  }

  onMessage = async (payload: MessagePayload, postMessage: PostMessage) => {
    const { message, history } = payload

    if (message.role == 'assistant') {
      await this.regenerateResponse(payload, postMessage)
    } else if (message.role == 'user') {
      let intent = message.intent
      if (!intent && history.length) {
        const lastIntent = history
          .slice()
          .reverse()
          .find((h) => h.intent)?.intent
        if (lastIntent == Intent.PLANNER || lastIntent == Intent.ACTION) {
          intent = Intent.PLANNER
        }
      }
      if (intent) log('received intent', intent)
      if (intent == Intent.PLANNER) {
        await this.usePlanningAgent(
          payload,
          attachmentListToString(message.attachments),
          postMessage
        )
      } else if (intent == Intent.ACTION) {
        await this.useActingAgent(payload, postMessage)
      } else {
        await this.detectIntent(payload, postMessage)
      }
    } else {
      log('got sent a system message, doing nothing')
    }
  }

  regenerateResponse = async (payload: MessagePayload, postMessage: PostMessage) => {
    const { message, history } = payload

    const reversedHistory = history.slice().reverse()
    const lastIntent = reversedHistory.find((h) => h.intent)?.intent
    const lastUserMessage = reversedHistory.find((h) => h.role == 'user')

    const intent = message.intent || lastIntent

    log('regenerating response for intent', intent)

    if (intent == Intent.PLANNER) {
      const attachmentBody = attachmentListToString(lastUserMessage?.attachments)
      await this.usePlanningAgent(payload, attachmentBody, postMessage)
    } else if (intent == Intent.ACTION) {
      await this.useActingAgent(payload, postMessage)
    } else {
      const newPayload = { message: lastUserMessage!, history }
      await this.detectIntent(newPayload, postMessage)
    }
  }

  systemMessage = () => {
    const project = path.basename(process.cwd())
    const systemMessage =
      'You are an EngineerGPT, an assistant for software engineers running in a ' +
      `${detectProjectLanguage()} project called ${project}`
    return systemMessage
  }

  detectIntent = async (payload: MessagePayload, postMessage: (message: ChatMessage) => void) => {
    // determine what we're doing
    const { message, history } = payload

    const model = message.options?.model || '3.5'
    const prompt = `Given my input & conversation history, determine the type of request:
- question that can be answered with only the context provided:
  ${
    model != '4' &&
    `if requires code generation or other complex reasoning, type = COMPLEX_ANSWER, message = let the user know to wait for the next message
  else, `
  }type = DIRECT_ANSWER, message = answer to the question or request with code snippets if relevant
- requires context or taking action (from the file system, user, or internet), type = PLANNER, message = let the user know planning is happening
- if none of these, type = DIRECT_ANSWER, message = ask the user for clarification and tell them to try again

ALWAYS Return in the format "<type>: <message to the user>", e.g. DIRECT_ANSWER: the answer is 42

Analyze and categorize my query: `

    const attachmentBody = attachmentListToString(message.attachments)
    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt + message.content + attachmentBody,
    }
    const messages = compactMessageHistory([...history, userMessage], model, {
      role: 'system',
      content: this.systemMessage(),
    })

    const answer = await chatWithHistory(messages, model)
    const types = [Intent.ANSWER, Intent.PLANNER, Intent.COMPLEX]

    const { type, response } = detectTypeFromResponse(answer, types, Intent.ANSWER)

    const responseMessage: ChatMessage = {
      role: 'assistant',
      content: response,
      options: { model, type },
      intent: type,
    }
    history.push(message)
    history.push(responseMessage)
    postMessage(responseMessage)

    if (type == Intent.ANSWER) {
      // we're done
    } else if (type == Intent.COMPLEX) {
      if (!message.options) message.options = {}
      message.options.model = '4'
      await this.detectIntent(payload, postMessage)
    } else if (type == Intent.PLANNER) {
      await this.usePlanningAgent(payload, attachmentBody, postMessage)
    }
  }

  planner = new WebPlanner()
  usePlanningAgent = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    postMessage: PostMessage
  ) => {
    await this.planner.runAgent(payload, attachmentBody, this.systemMessage(), postMessage)
  }

  editor = new CodebaseEditor()
  useActingAgent = async (payload: MessagePayload, postMessage: PostMessage) => {
    await this.editor.planChanges(payload, postMessage)
  }
}
