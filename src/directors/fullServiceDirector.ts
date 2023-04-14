import { getReadOnlyTools } from '@/agent'
import { Agent } from '@/agent/agent'
import { indexer } from '@/db/indexer'
import { findRelevantDocs } from '@/directors/agentPlanner'
import { ChatMessage, MessagePayload } from '@/types'
import { log } from '@/utils/logger'

// the full-service agent is an all-in-one agent used by the web
// it is stateless and can do anything (with confirmation)

const SYSTEM_MESSAGE =
  'You are EngineerGPT, an assistant that helps develop on a codebase. Listen well to ' +
  "the user, ask if uncertain, don't loop needlessly, respond exactly as instructed."

const MAX_PLAN_ITERATIONS = 5

enum AnswerMode {
  PLANNING,
}

const CONFIRM = 'CONFIRM:'
const ANSWER = 'ANSWER:'
const ASK = 'ASK:'

export class FullServiceDirector {
  init = () => {
    indexer.loadFilesIntoVectors()
  }

  onMessage = async (
    { message, history, options }: MessagePayload,
    postMessage: (message: ChatMessage) => void
  ) => {
    const tools = options.tools ? getReadOnlyTools() : []

    // based on history, determine if we're doing research or taking action
    // const mode = AnswerMode.PLANNING

    const outputFormat = // mode == AnswerMode.PLANNING ?
      `either ${CONFIRM} <proposed set of actions that user must approve>, ` +
      `${ANSWER} <answer to user request if no action is needed>, or ` +
      `${ASK} <question to ask user if you need more information>`

    const agent = new Agent(tools, outputFormat, SYSTEM_MESSAGE)
    agent.actionParam = 'ResearchAction'
    agent.finalAnswerParam = 'TellUser'
    agent.model = options.model || '3.5'

    const query = message.content
    const relevantDocs = await findRelevantDocs(query, indexer.files)
    agent.addInitialState('What are the most relevant files to this query?', relevantDocs)

    const pastMessages: ChatMessage[] = []
    history.forEach((msg) => {
      if (msg.role == 'system') return
      pastMessages.push({
        role: msg.role,
        content: msg.content,
      })
    })
    agent.priorMessages = pastMessages

    for (let i = 0; i < MAX_PLAN_ITERATIONS; i++) {
      const result = await agent.runOnce(query, i == MAX_PLAN_ITERATIONS - 1)
      log(result)

      if (result.thought) {
        const upperThought = result.thought.toUpperCase()
        // sometimes the final answer gets stuck in the thought

        const keywords = [CONFIRM, ANSWER, ASK]
        let index = -1
        for (const keyword of keywords) {
          if (upperThought.includes(keyword)) {
            index = upperThought.indexOf(keyword)
            break
          }
        }
        if (index !== -1) {
          result.finalAnswer = result.thought.substring(index)
        } else if (!result.action) {
          // if no actions were provided, then the thought is the final answer
          result.finalAnswer = result.thought
        }
      }

      const content = result.finalAnswer ? result.finalAnswer : 'Thought: ' + result.thought

      const newMessage: ChatMessage = {
        role: 'assistant',
        content,
        attachments: result.observations?.map((o) => ({
          type: 'observation',
          name: o.tool + (o.input ? ' ' + o.input : ''),
          content: o.output,
        })),
        state: result,
      }
      postMessage(newMessage)

      if (result.finalAnswer) break
      agent.addState(result)
    }
  }
}
