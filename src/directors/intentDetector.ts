import { getModel, streamChatWithHistory } from '@/ai/api'
import { compactMessageHistory, detectTypeFromResponse } from '@/directors/helpers'
import { IntentHandler } from '@/directors/intentHandler'
import prompts from '@/prompts'
import { ChatMessage, Intent, MessagePayload, PostMessage } from '@/types'

// product manager bot
export class IntentDetector extends IntentHandler {
  initialRun = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ) => {
    // determine what we're doing
    const { message, history } = payload

    const model = getModel(false)
    const prompt = prompts.detectIntent({ model })
    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt + message.content + attachmentBody,
    }
    const messages = compactMessageHistory([...history, userMessage], model, {
      role: 'system',
      content: systemMessage,
    })

    const answer = await streamChatWithHistory(messages, model, postMessage)
    const types = Object.values(Intent)

    const { type, response } = detectTypeFromResponse(answer, types, Intent.ANSWER)

    const responseMessage: ChatMessage = {
      role: 'assistant',
      content: response,
      options: { model, type },
      intent: type,
    }
    history.push(message)

    return responseMessage
  }
}

// history.push(responseMessage)
// postMessage(responseMessage)

// if (type == Intent.ANSWER || (type == Intent.COMPLEX && response.length > 300)) {
//   // we're done
// } else {
//   await this.handleDetectedIntent(type as Intent, payload, attachmentBody, postMessage)
// }
