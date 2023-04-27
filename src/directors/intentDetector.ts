import { getModel, streamChatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
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

    const similar = await indexer.vectorDB.searchWithScores(message.content, 6)
    const similarFuncs =
      similar
        ?.filter((s) => {
          const [doc, score] = s
          if (score < 0.15) return false
          return true
        })
        .map((s) => s[0]) || []
    const similarFuncText = similarFuncs.length
      ? 'Related functions:\n' +
        similarFuncs.map((s) => s.metadata.path + '\n' + s.pageContent).join('\n\n') +
        '------\n\n'
      : ''

    const prompt = prompts.chatPilot({ request: message.content, references: similarFuncText })
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
