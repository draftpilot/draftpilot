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
  'the user, ask if uncertain, use the tools provided.'

const MAX_PLAN_ITERATIONS = 5

enum AnswerMode {
  PLANNING,
}

export class FullServiceDirector {
  init = () => {
    indexer.loadFilesIntoVectors()
  }

  onMessage = async (
    { message, history }: MessagePayload,
    postMessage: (message: ChatMessage) => void
  ) => {
    const tools = getReadOnlyTools()

    // based on history, determine if we're doing research or taking action
    // const mode = AnswerMode.PLANNING

    const outputFormat = // mode == AnswerMode.PLANNING ?
      'either PROPOSAL: <proposed course of action that user must approve> or ' +
      'ANSWER: <answer to user request if no action is needed>'

    const agent = new Agent(tools, outputFormat, SYSTEM_MESSAGE)
    agent.actionParam = 'Research Action'
    agent.finalAnswerParam = 'Report to User'

    const query = message.content
    if (history.length == 0) {
      const relevantDocs = await findRelevantDocs(query, indexer.files)
      history.push({
        content: 'Found relevant files to this query: ' + relevantDocs,
        role: 'system',
      })
    } else {
      history.forEach((msg) => {
        if (msg.state) agent.addState(msg.state)
      })
    }

    const result = await agent.runOnce(query)
    log(result)

    const content = result.finalAnswer ? result.finalAnswer : 'Thought: ' + result.thought

    const newMessage: ChatMessage = {
      role: 'assistant',
      content,
      attachments: result.observations?.map((o) => ({
        type: 'observation',
        name: o.tool + o.input ? ' ' + o.input : '',
        content: o.output,
      })),
      state: result,
    }
    postMessage(newMessage)
  }
}
