import { getModel, streamChatWithHistory } from '@/ai/api'
import { compactMessageHistory } from '@/directors/helpers'
import { ChatMessage, MessagePayload, PostMessage } from '@/types'

export abstract class IntentHandler {
  constructor(public interrupted: Set<string>) {}

  // called the first time this intent is invoked in a session
  abstract initialRun(
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ): Promise<ChatMessage>

  // called any subsequent time the intent is invoked. by default just does chat completion
  followupRun = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ): Promise<ChatMessage> => {
    const { message, history } = payload
    const model = getModel(false)

    const userMessage: ChatMessage = {
      role: 'user',
      content: message.content + attachmentBody,
    }
    const messages = compactMessageHistory([...history, userMessage], model)
    const response = await streamChatWithHistory(messages, model, postMessage)

    const responseMessage: ChatMessage = {
      role: 'assistant',
      content: response,
    }

    return responseMessage
  }
}
