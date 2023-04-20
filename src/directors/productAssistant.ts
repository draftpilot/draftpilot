import { streamChatWithHistory } from '@/ai/api'
import { compactMessageHistory } from '@/directors/helpers'
import { Intent, MessagePayload, PostMessage } from '@/types'

// product manager bot
export class ProductAssistant {
  runAgent = async (payload: MessagePayload, postMessage: PostMessage) => {
    let { message, history } = payload
    const { options } = message

    const systemMessage =
      'You are a Product Manager assistant tasked with helping the user, an engineer, get to clarity on their project. ' +
      'Help the user think strategically about what users want, not just what they want to build.'

    const model = message.options?.model || '3.5'

    const messages = compactMessageHistory([...history, message], model, {
      content: systemMessage,
      role: 'system',
    })

    const response = await streamChatWithHistory(messages, model, (response) => {
      postMessage(response)
    })

    postMessage({
      role: 'assistant',
      content: response,
      options: { model },
      intent: Intent.PRODUCT,
    })
  }
}
