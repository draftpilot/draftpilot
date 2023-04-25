import { getModel, streamChatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { attachmentListToString, compactMessageHistory } from '@/directors/helpers'
import { IntentHandler } from '@/directors/intentHandler'
import prompts from '@/prompts'
import { ChatMessage, MessagePayload, PostMessage } from '@/types'

export class CrashPilot extends IntentHandler {
  initialRun = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ) => {
    const { message, history } = payload
    const model = getModel(true)

    const similarCode = await indexer.vectorDB.searchWithScores(message.content, 10)
    const similarFuncs =
      similarCode
        ?.filter((s) => {
          const [doc, score] = s
          if (score < 0.15) return false
          return true
        })
        .map((s) => s[0].pageContent) || []
    if (attachmentBody) similarFuncs.push(attachmentBody)

    const prompt = prompts.crashPilot({
      message: message.content,
      references: similarFuncs?.join('\n\n'),
    })

    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt + message.content + attachmentBody,
    }
    const messages = compactMessageHistory([...history, userMessage], model, {
      role: 'system',
      content: systemMessage,
    })

    const response = await streamChatWithHistory(messages, model, postMessage)

    const responseMessage: ChatMessage = {
      role: 'assistant',
      content: response,
    }

    return responseMessage
  }
}
