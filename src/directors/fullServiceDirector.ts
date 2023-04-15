import { getReadOnlyTools } from '@/agent'
import { Agent } from '@/agent/agent'
import { chatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { findRelevantDocs } from '@/directors/agentPlanner'
import { Attachment, ChatMessage, MessagePayload } from '@/types'
import { log } from '@/utils/logger'
import { fuzzyMatchingFile } from '@/utils/utils'
import fs from 'fs'

// the full-service agent is an all-in-one agent used by the web
// it is stateless and can do anything (with confirmation)

const SYSTEM_MESSAGE =
  'You are EngineerGPT, an assistant that helps develop on a codebase. Listen well to ' +
  'the user, stop looping if uncertain, respond exactly in the desired format.'

const MAX_PLAN_ITERATIONS = 5

enum AnswerMode {
  ANSWER,
  PLAN,
  ACT,
}

enum Outcome {
  CONFIRM = 'CONFIRM:',
  ANSWER = 'ANSWER:',
  ASK = 'ASK:',
  UPGRADE = 'UPGRADE',
}

export class FullServiceDirector {
  init = () => {
    indexer.loadFilesIntoVectors()
  }

  onMessage = async (payload: MessagePayload, postMessage: (message: ChatMessage) => void) => {
    // determine what we're doing

    const { message, history } = payload

    const lastHistoryMessage = history[history.length - 1]

    const answerMode =
      !lastHistoryMessage || !lastHistoryMessage.state
        ? AnswerMode.ANSWER
        : lastHistoryMessage.content.startsWith(Outcome.CONFIRM)
        ? AnswerMode.ACT
        : AnswerMode.PLAN

    if (answerMode == AnswerMode.ANSWER) {
      await this.useAnswerAgent(payload, postMessage)
    } else if (answerMode == AnswerMode.PLAN) {
      await this.usePlanningAgent(payload, attachmentListToString(message.attachments), postMessage)
    } else if (answerMode == AnswerMode.ACT) {
      await this.useActingAgent(payload, postMessage)
    }
  }

  useAnswerAgent = async (payload: MessagePayload, postMessage: (message: ChatMessage) => void) => {
    const { message, history } = payload

    const attachmentBody = attachmentListToString(message.attachments)
    const messages: ChatMessage[] = history
      ? [...pastMessages(history.slice(history.length - 4))]
      : []

    messages.push({
      role: 'user',
      content:
        'Answer this request if it can be answered directly, or if codebase access is needed, return USE_TOOLS:\n\n' +
        attachmentBody +
        message.content,
    })

    const options = message.options
    const answer = await chatWithHistory(messages, options?.model || '3.5')
    log(answer)

    if (answer.includes('USE_TOOLS') || answer.includes('your codebase')) {
      await this.usePlanningAgent(payload, attachmentBody, postMessage)
    } else {
      postMessage({ role: 'assistant', content: answer, options })
    }
  }

  usePlanningAgent = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    postMessage: (message: ChatMessage) => void
  ) => {
    const { message, history } = payload
    const { options } = message
    const tools = options?.tools ? getReadOnlyTools() : []

    const outputFormat =
      `either ${Outcome.CONFIRM} <proposed set of actions that user must approve>, ` +
      (options?.model != '4'
        ? `${Outcome.UPGRADE} to switch to super smart AI mode if request is complex, or `
        : '') +
      `${Outcome.ANSWER} <answer to user request if no action is needed>, or ` +
      `${Outcome.ASK} <question to ask user if you need more information>`

    const agent = new Agent(tools, outputFormat, SYSTEM_MESSAGE)
    agent.actionParam = 'ResearchAction'
    agent.finalAnswerParam = 'TellUser'
    agent.model = options?.model || '3.5'

    const query = message.content
    if (attachmentBody) {
      agent.addInitialState('View the referenced files', attachmentBody)
    } else {
      const relevantDocs = await findRelevantDocs(query, indexer.files)
      agent.addInitialState('What are the most relevant files to this query?', relevantDocs)
    }

    // TODO implement re-generate message

    agent.priorMessages = pastMessages(history)

    for (let i = 0; i < MAX_PLAN_ITERATIONS; i++) {
      const result = await agent.runOnce(query, i == MAX_PLAN_ITERATIONS - 1)
      log(result)

      if (
        result.finalAnswer?.includes(Outcome.UPGRADE) ||
        result.thought?.includes(Outcome.UPGRADE)
      ) {
        if (agent.model != '4') {
          i--
          agent.model = '4'
          continue
        }
      }

      if (result.thought) {
        const upperThought = result.thought.toUpperCase()
        // sometimes the final answer gets stuck in the thought

        const keywords = [Outcome.CONFIRM, Outcome.ANSWER, Outcome.ASK]
        let index = -1
        for (const keyword of keywords) {
          if (upperThought.includes(keyword)) {
            index = upperThought.indexOf(keyword)
            break
          }
        }
        if (index !== -1) {
          result.finalAnswer = result.thought.substring(index)
          result.thought = result.thought.substring(0, index)
        }
      }

      const content = result.finalAnswer ? result.finalAnswer : 'Thought: ' + result.thought

      const newMessage: ChatMessage = {
        role: 'assistant',
        content,
        options,
        attachments: result.observations?.map((o) => ({
          type: 'observation',
          name: o.tool + (o.input ? ' ' + o.input : ''),
          content: o.output,
        })),
        state: result,
      }
      postMessage(newMessage)

      if (result.finalAnswer || !result.action) break
      agent.addState(result)
    }
  }

  useActingAgent = async (payload: MessagePayload, postMessage: (message: ChatMessage) => void) => {
    const { message } = payload
    const { options } = message
    postMessage({ role: 'assistant', content: 'Acting agent not implemented yet', options })
  }
}

function pastMessages(history: ChatMessage[]) {
  const pastMessages: ChatMessage[] = []
  history.forEach((msg) => {
    if (msg.role == 'system') return
    pastMessages.push({
      role: msg.role,
      content: msg.content,
    })
  })
  return pastMessages
}

function attachmentListToString(attachments: Attachment[] | undefined) {
  return attachments
    ?.map((attachment) => {
      if (attachment.content) {
        return attachment.name + '\n---\n' + attachment.content
      } else if (attachment.type === 'file') {
        const filePath = fuzzyMatchingFile(attachment.name, indexer.files)
        if (filePath) {
          return filePath + '\n---\n' + fs.readFileSync(filePath, 'utf8') + '\n---\n'
        }
      }
    })
    .filter(Boolean)
    .join('\n')
}
