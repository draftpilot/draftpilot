import { getReadOnlyTools } from '@/agent'
import { Agent } from '@/agent/agent'
import { pastMessages } from '@/directors/helpers'
import { ChatMessage, MessagePayload, PostMessage } from '@/types'
import { log } from '@/utils/logger'

const MAX_PLAN_ITERATIONS = 3

enum PlanOutcome {
  CONFIRM = 'CONFIRM:',
  ANSWER = 'ANSWER:',
  ASK = 'ASK:',
  UPGRADE = 'UPGRADE',
}

// planner that exists as part of a multi-intent flow
export class WebPlanner {
  runAgent = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ) => {
    let { message, history } = payload
    const { options } = message
    const tools = options?.tools ? getReadOnlyTools() : []

    const outputFormat =
      `either ${PlanOutcome.CONFIRM} <proposed set of actions that user must approve>, ` +
      (options?.model != '4'
        ? `${PlanOutcome.UPGRADE} to switch to super smart AI mode if request is complex, or `
        : '') +
      `${PlanOutcome.ANSWER} <answer to user request if no action is needed>, or ` +
      `${PlanOutcome.ASK} <question to ask user if you need more information>`

    systemMessage =
      systemMessage +
      '. You are in planning mode, help figure out which files to edit then send to user for confirmation.'
    const agent = new Agent(tools, outputFormat, systemMessage)
    agent.actionParam = 'ResearchAction'
    agent.finalAnswerParam = 'TellUser'
    agent.model = options?.model || '3.5'

    // resume from previous state
    const priorMessages: ChatMessage[] = []
    history.forEach((m) => {
      if (message.state) agent.addState(message.state)
      else priorMessages.push(m)
    })
    agent.priorMessages = pastMessages(history)

    const query = message.content
    if (attachmentBody) {
      agent.addInitialState('View the referenced files', attachmentBody)
    }

    for (let i = 0; i < MAX_PLAN_ITERATIONS; i++) {
      const result = await agent.runOnce(query, i == MAX_PLAN_ITERATIONS - 1)
      log({ ...result, observations: '...' })

      if (
        result.finalAnswer?.includes(PlanOutcome.UPGRADE) ||
        result.thought?.includes(PlanOutcome.UPGRADE)
      ) {
        if (agent.model != '4') {
          log('switching to GPT-4')
          i--
          agent.model = '4'
          continue
        }
      }

      if (result.thought) {
        const upperThought = result.thought.toUpperCase()
        // sometimes the final answer gets stuck in the thought

        const keywords = [PlanOutcome.CONFIRM, PlanOutcome.ANSWER, PlanOutcome.ASK]
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
}
