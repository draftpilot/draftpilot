import { streamChatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { attachmentListToString, compactMessageHistory } from '@/directors/helpers'
import prompts from '@/prompts'
import { ChatMessage, MessagePayload, PostMessage } from '@/types'

export class CrashPilot {
  constructor(public interrupted: Set<string>) {}

  useCrashPilot = async (
    payload: MessagePayload,
    systemMessage: string,
    postMessage: PostMessage
  ) => {
    const { message, history } = payload

    const model = '4' // message.options?.model || '4'

    const similarCode = await indexer.vectorDB.searchWithScores(message.content, 10)
    const similarFuncs = similarCode
      ?.filter((s) => {
        const [doc, score] = s
        if (score < 0.15) return false
        return true
      })
      .map((s) => s[0].pageContent)

    const prompt = prompts.crashPilot({
      message: message.content,
      references: similarFuncs?.join('\n\n'),
    })

    const attachmentBody = attachmentListToString(message.attachments)
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

    if (this.interrupted.has(payload.id)) return

    postMessage(responseMessage)
  }
}
