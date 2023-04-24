import { streamChatWithHistory } from '@/ai/api'
import { compactMessageHistory } from '@/directors/helpers'
import { IntentHandler } from '@/directors/intentHandler'
import { ChatMessage, Intent, MessagePayload, PostMessage } from '@/types'

// product manager bot
export class ProductAssistant extends IntentHandler {
  initialRun = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ) => {
    let { message, history } = payload
    const model = message.options?.model || '3.5'

    systemMessage =
      'You are a Product Manager assistant tasked with helping the user, an engineer, get to clarity on their project. ' +
      'Help the user think strategically about what users want, not just what they want to build.'

    const messages = compactMessageHistory([...history, message], model, {
      content: systemMessage,
      role: 'system',
    })

    const response = await streamChatWithHistory(messages, model, (response) => {
      postMessage(response)
    })

    return {
      role: 'assistant',
      content: response,
      options: { model },
    } as ChatMessage
  }
}
