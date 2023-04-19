import { getReadOnlyTools } from '@/agent'
import { Agent } from '@/agent/agent'
import { chatCompletion, chatWithHistory, streamChatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { findRelevantDocs } from '@/directors/agentPlanner'
import { CodebaseEditor } from '@/directors/codebaseEditor'
import { compactMessageHistory, pastMessages } from '@/directors/helpers'
import { ChatMessage, Intent, MessagePayload, Model, PostMessage } from '@/types'
import { log } from '@/utils/logger'
import { encode } from 'gpt-3-encoder'

const MAX_PLAN_ITERATIONS = 3

enum PlanOutcome {
  CONFIRM = 'CONFIRM:',
  ANSWER = 'ANSWER:',
  ASK = 'ASK:',
  UPGRADE = 'UPGRADE',
}

// planner that exists as part of a multi-intent flow
export class WebPlanner {
  constructor(public interrupted: Set<string>) {}

  outputFormat = (model: Model | undefined) =>
    `either ${PlanOutcome.CONFIRM} <proposed set of actions that user must approve>, ` +
    (model != '4'
      ? `${PlanOutcome.UPGRADE} to switch to super smart AI mode if request is complex, or `
      : '') +
    `${PlanOutcome.ANSWER} <answer to user request if absolutely no action is being requested>, or ` +
    `${PlanOutcome.ASK} <question to ask user if you need more information>`

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
      .map((s) => s[0].pageContent.split('\n').slice(0, 50).join('\n'))

    // TODO: git history, past learnings

    const contexts: string[] = [
      attachmentBody || '',
      'Possibly relevant files:',
      relevantDocs,
      'Code snippets:',
      ...similarFuncs,
    ]

    const basePrompt = `User's request: ${message.content}. Think step by step to come up with a 
plan of action. ALWAYS return in this output format:

- If you know what to do:
  CONFIRM: return the steps in markdown, a '---' separator followed by a list of files to modify (with full paths) and how they should be changed.

- If you need to ask the user a question:
  ASK: proposed plan in markdown, a '---' separator, and the question(s) you want to ask.`

    let tokenBudget = 6000 - encode(basePrompt).length
    const promptParts = []

    for (const context of contexts) {
      const encoded = encode(context).length
      if (tokenBudget < encoded) {
        break
      }
      tokenBudget -= encoded
      promptParts.push(context)
    }

    const prompt = `${promptParts.join('\n')}\n${basePrompt}`
    const model = '4'

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

    const prompt = `${message.content}
${attachmentBody}

${this.outputFormat(model)}`

    const msessage = compactMessageHistory([...history, { content: prompt, role: 'user' }], model)

    const response = await chatWithHistory(msessage, model)

    const newMessage: ChatMessage = {
      role: 'assistant',
      content: response,
    }
    postMessage(newMessage)
  }
}
