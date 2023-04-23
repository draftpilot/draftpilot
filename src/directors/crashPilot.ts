import { streamChatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { attachmentListToString, compactMessageHistory } from '@/directors/helpers'
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

    const prompt = `I will paste in a crash log or bug report written by a user or product manager.
Your job is to figure out where the possible bug/crash is. If it can be fixed simply, propose a 
fix in your response, including the file name and new code with a few lines of context.

If it's not clear what the fix is, come up with a few possible theories, and a plan for how I can
test them and report back. You can help me (or the user) think of ways to reproduce the bug,
write a simple test case to expose the bug, or other debugging techniques. Don't go off topic 
and tell me about creating new projects or building features unless explicitly requested.

======
Relevant code snippets:

${similarFuncs?.join('\n\n') || 'No similar code found'}

======
My Request:
`

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
