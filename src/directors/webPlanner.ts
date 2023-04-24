import { chatWithHistory, streamChatWithHistory } from '@/ai/api'
import { findRelevantDocs } from '@/context/relevantFiles'
import { indexer } from '@/db/indexer'
import { compactMessageHistory } from '@/directors/helpers'
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
export class WebPlanner {
  constructor(public interrupted: Set<string>) {}

  runInitialPlanning = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ) => {
    let { id, message, history } = payload
    const { options } = message

    const relevantDocs = await findRelevantDocs(message.content, indexer.files, 50)
    const similarCode = await indexer.vectorDB.searchWithScores(message.content, 6)
    const similarFuncs = similarCode
      ?.filter((s) => {
        const [doc, score] = s
        if (score < 0.15) return false
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

    const model = '4'

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

    const result = await streamChatWithHistory(messages, model, (response) => {
      postMessage(response)
    })

    postMessage({
      role: 'assistant',
      content: result,
      intent: Intent.PLANNER,
    })
  }

  runFollowupPlanner = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ) => {
    const { message, history } = payload
    // in the follow-up planner, we've already run planning and either proposed a plan or asked
    // the user for feedback. the user has responsed to us, and now we need to figure out what to do.

    const model = message.options?.model || '3.5'

    const prompt = prompts.draftPilot({
      message: message.content,
      references: attachmentBody || '',
    })

    const msessage = compactMessageHistory([...history, { content: prompt, role: 'user' }], model)

    const response = await chatWithHistory(msessage, model)

    const newMessage: ChatMessage = {
      role: 'assistant',
      content: response,
    }
    postMessage(newMessage)
  }
}
