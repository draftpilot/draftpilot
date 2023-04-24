import { chatWithHistory, streamChatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { CodebaseEditor } from '@/directors/codebaseEditor'
import {
  attachmentListToString,
  compactMessageHistory,
  detectProjectLanguage,
  detectTypeFromResponse,
} from '@/directors/helpers'
import { ProductAssistant } from '@/directors/productAssistant'
import { WebPlanner } from '@/directors/webPlanner'
import { ChatMessage, Intent, MessagePayload, PostMessage } from '@/types'
import { log } from '@/utils/logger'
import path from 'path'
import { readProjectContext } from '@/context/projectContext'
import { CrashPilot } from '@/directors/crashPilot'
import { tracker } from '@/utils/tracker'
import prompts from '@/prompts'

export class Dispatcher {
  interrupted = new Set<string>()
  context: string = ''

  init = async () => {
    indexer.loadFilesIntoVectors()
    this.context = readProjectContext() || ''
  }

  onMessage = async (payload: MessagePayload, origPostMessage: PostMessage) => {
    const { id, message, history } = payload

    const postMessage = (msg: string | ChatMessage) => {
      if (this.interrupted.has(id)) return
      origPostMessage(msg)
    }

    if (message.role == 'assistant') {
      tracker.regenerateResponse(message.intent)
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
      tracker.userMessage(intent)
      await this.handleDetectedIntent(intent as Intent, payload, undefined, postMessage)
    } else {
      log('got sent a system message, doing nothing')
    }

    this.interrupted.delete(id)
  }

  onInterrupt = async (id: string) => {
    log('interrupting', id)
    this.interrupted.add(id)
  }

  regenerateResponse = async (payload: MessagePayload, postMessage: PostMessage) => {
    const { id, message, history } = payload

    const reversedHistory = history.slice().reverse()
    const lastIntent = reversedHistory.find((h) => h.intent)?.intent

    const intent = message.intent || lastIntent

    log('regenerating response for intent', intent)

    await this.handleDetectedIntent(intent as Intent, payload, undefined, postMessage)
  }

  systemMessage = () => {
    const project = path.basename(process.cwd())
    return prompts.systemMessage({
      language: detectProjectLanguage() || 'unknown',
      project,
      context: this.context,
    })
  }

  detectIntent = async (payload: MessagePayload, postMessage: PostMessage) => {
    // determine what we're doing
    const { message, history } = payload

    const model = message.options?.model || '3.5'
    const prompt = prompts.detectIntent({ model })
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
    const types = Object.values(Intent)

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

    if (type == Intent.ANSWER || (type == Intent.COMPLEX && response.length > 300)) {
      // we're done
    } else {
      await this.handleDetectedIntent(type as Intent, payload, attachmentBody, postMessage)
    }
  }

  handleDetectedIntent = async (
    intent: Intent | undefined,
    payload: MessagePayload,
    attachmentBody: string | undefined,
    postMessage: PostMessage
  ) => {
    const { message } = payload
    if (intent == Intent.COMPLEX) {
      if (!message.options) message.options = {}
      message.options.model = '4'
      await this.detectIntent(payload, postMessage)
    } else if (intent == Intent.PLANNER || intent == Intent.DRAFTPILOT) {
      if (!attachmentBody) attachmentBody = attachmentListToString(message.attachments)
      await this.usePlanningAgent(payload, attachmentBody, postMessage)
    } else if (intent == Intent.CRASHPILOT) {
      await this.useCrashPilot(payload, postMessage)
    } else if (intent == Intent.ACTION) {
      await this.useActingAgent(payload, postMessage)
    } else if (intent == Intent.PRODUCT) {
      await this.useProductAssistant(payload, postMessage)
    } else {
      await this.detectIntent(payload, postMessage)
    }
  }

  planner = new WebPlanner(this.interrupted)
  usePlanningAgent = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    postMessage: PostMessage
  ) => {
    if (payload.history.find((h) => h.state)) {
      // if we have a state, we're in the middle of a planning session
      await this.planner.runFollowupPlanner(
        payload,
        attachmentBody,
        this.systemMessage(),
        postMessage
      )
    } else {
      await this.planner.runInitialPlanning(
        payload,
        attachmentBody,
        this.systemMessage(),
        postMessage
      )
    }
  }

  editor = new CodebaseEditor()
  useActingAgent = async (payload: MessagePayload, postMessage: PostMessage) => {
    await this.editor.planChanges(payload, postMessage, this.systemMessage())
  }

  productAssistant = new ProductAssistant()
  useProductAssistant = async (payload: MessagePayload, postMessage: PostMessage) => {
    await this.productAssistant.runAgent(payload, postMessage)
  }

  crashPilot = new CrashPilot(this.interrupted)
  useCrashPilot = async (payload: MessagePayload, postMessage: PostMessage) => {
    if (payload.history.find((h) => h.intent == Intent.CRASHPILOT)) {
      // user has already started a conversation with the crash pilot
      this.handleDetectedIntent(Intent.COMPLEX, payload, undefined, postMessage)
    } else {
      this.crashPilot.useCrashPilot(payload, this.systemMessage(), postMessage)
    }
  }
}
