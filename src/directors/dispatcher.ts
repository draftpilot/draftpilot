import { indexer } from '@/db/indexer'
import { CodebaseEditor } from '@/directors/codebaseEditor'
import { attachmentListToString, detectProjectLanguage } from '@/directors/helpers'
import { ProductAssistant } from '@/directors/productAssistant'
import { DraftPilot } from '@/directors/draftPilot'
import { ChatMessage, Intent, MessagePayload, PostMessage } from '@/types'
import { log } from '@/utils/logger'
import path from 'path'
import { readProjectContext } from '@/context/projectContext'
import { CrashPilot } from '@/directors/crashPilot'
import { tracker } from '@/utils/tracker'
import prompts from '@/prompts'
import { IntentDetector } from '@/directors/intentDetector'
import { IntentHandler } from '@/directors/intentHandler'
import { PostAction } from '@/directors/postAction'

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
        if (lastIntent == Intent.DRAFTPILOT || lastIntent == Intent.EDIT_FILES) {
          intent = Intent.DRAFTPILOT
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

  handleDetectedIntent = async (
    intent: Intent | undefined,
    payload: MessagePayload,
    attachmentBody: string | undefined,
    postMessage: PostMessage
  ) => {
    const { message, history } = payload

    const handler: IntentHandler =
      {
        [Intent.PRODUCT]: this.productAssistant,
        [Intent.EDIT_FILES]: this.codeEditor,
        [Intent.DRAFTPILOT]: this.draftPilot,
        [Intent.CRASHPILOT]: this.crashPilot,
        [Intent.TESTPILOT]: this.draftPilot,

        // the rest are all passed to the intent detector
        [Intent.DONE]: this.intentDetector,
        [Intent.CHAT]: this.intentDetector,
        [Intent.ANSWER]: this.intentDetector,
        [Intent.COMPLEX]: this.intentDetector,
      }[intent || Intent.CHAT] || this.intentDetector

    if (intent == Intent.COMPLEX) {
      if (!message.options) message.options = {}
      message.options.model = '4'
    }
    const isInitialRun =
      history.find((m) => m.role == 'assistant' && m.intent == intent) == undefined
    const isIntentDetection = intent === undefined
    if (message.attachments && !attachmentBody)
      attachmentBody = attachmentListToString(message.attachments)

    const nextMessage = isInitialRun
      ? await handler.initialRun(payload, attachmentBody, this.systemMessage(), postMessage)
      : await handler.followupRun(payload, attachmentBody, this.systemMessage(), postMessage)
    if (!nextMessage.intent) nextMessage.intent = intent

    if (this.interrupted.has(payload.id)) return

    postMessage(nextMessage)
    history.push(nextMessage)

    if (isIntentDetection && nextMessage.intent) {
      await this.handleDetectedIntent(
        nextMessage.intent as Intent,
        payload,
        attachmentBody,
        postMessage
      )
    } else {
      this.postAction.onMessage(payload, nextMessage, postMessage)
    }
  }

  postAction = new PostAction()
  intentDetector = new IntentDetector(this.interrupted)
  draftPilot = new DraftPilot(this.interrupted)
  codeEditor = new CodebaseEditor(this.interrupted)
  productAssistant = new ProductAssistant(this.interrupted)
  crashPilot = new CrashPilot(this.interrupted)
}
