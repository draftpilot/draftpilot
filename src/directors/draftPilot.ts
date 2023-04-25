import { chatWithHistory, getModel, setFakeModeResponse, streamChatWithHistory } from '@/ai/api'
import { findRelevantDocs } from '@/context/relevantFiles'
import { indexer } from '@/db/indexer'
import { compactMessageHistory } from '@/directors/helpers'
import { IntentHandler } from '@/directors/intentHandler'
import prompts from '@/prompts'
import { ChatMessage, Intent, MessagePayload, Model, PostMessage } from '@/types'
import { encode } from 'gpt-3-encoder'

enum PlanOutcome {
  CONFIRM = 'CONFIRM:',
  ANSWER = 'ANSWER:',
  ASK = 'ASK:',
  UPGRADE = 'UPGRADE',
}

// planner that exists as part of a multi-intent flow
export class DraftPilot extends IntentHandler {
  initialRun = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ) => {
    let { message, history } = payload
    const attachmentFiles = message.attachments?.map((a) => a.name) || []
    const relevantDocs = await findRelevantDocs(message.content, indexer.files, 50)
    const similarCode = await indexer.vectorDB.searchWithScores(message.content, 6)
    const similarFuncs = similarCode
      ?.filter((s) => {
        const [doc, score] = s
        if (score < 0.15) return false
        if (attachmentFiles.includes(doc.metadata.path)) return false
        return true
      })
      .map((s) => s[0].pageContent)

    // TODO: git history, past learnings

    const contexts: string[] = [
      attachmentBody || '',
      'Codebase files:',
      relevantDocs,
      'Code snippets:',
      ...similarFuncs,
    ]

    const model = getModel(false)

    const basePrompt = prompts.draftPilot({ message: message.content, references: '' })

    let tokenBudget = (model == '4' ? 6000 : 3500) - encode(basePrompt).length
    const references = []

    for (const context of contexts) {
      const encoded = encode(context).length
      if (tokenBudget < encoded) {
        break
      }
      tokenBudget -= encoded
      references.push(context, '\n')
    }

    const prompt = prompts.draftPilot({
      message: message.content,
      references: references.join('\n'),
    })

    const messages = compactMessageHistory([...history, { content: prompt, role: 'user' }], model, {
      content: systemMessage,
      role: 'system',
    })

    setFakeModeResponse(
      'PLAN: fake plan 123\n1. create draftpilot\n2. ???\n3. profit\n---\n- README.md - take over the world\n---\nconfidence: high'
    )
    const result = await streamChatWithHistory(messages, model, (response) => {
      postMessage(response)
    })

    return {
      role: 'assistant',
      content: result,
    } as ChatMessage
  }

  followupRun = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ) => {
    const { message, history } = payload
    // in the follow-up planner, we've already run planning and either proposed a plan or asked
    // the user for feedback. the user has responsed to us, and now we need to figure out what to do.

    const model = getModel(false)

    const prompt = prompts.draftPilot({
      message: message.content,
      references: attachmentBody || '',
    })

    console.log('attachments', attachmentBody?.length)

    const messages = compactMessageHistory([...history, { content: prompt, role: 'user' }], model, {
      content: systemMessage,
      role: 'system',
    })

    const result = await streamChatWithHistory(messages, model, (response) => {
      postMessage(response)
    })

    return {
      role: 'assistant',
      content: result,
      intent: Intent.DRAFTPILOT,
    } as ChatMessage
  }
}
