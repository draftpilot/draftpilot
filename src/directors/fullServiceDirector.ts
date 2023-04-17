import { getReadOnlyTools, getSimpleTools } from '@/agent'
import { Agent } from '@/agent/agent'
import { chatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { findRelevantDocs } from '@/directors/agentPlanner'
import { CodebaseEditor } from '@/directors/codebaseEditor'
import {
  attachmentListToString,
  compactMessageHistory,
  detectProjectLanguage,
  detectTypeFromResponse,
  pastMessages,
} from '@/directors/helpers'
import { Attachment, ChatMessage, MessagePayload, Model, PostMessage } from '@/types'
import { log } from '@/utils/logger'
import { fuzzyMatchingFile } from '@/utils/utils'
import fs from 'fs'
import { encode } from 'gpt-3-encoder'
import path from 'path'

// the full-service agent is an all-in-one agent used by the web
// it is stateless and can do anything (with confirmation)

const MAX_PLAN_ITERATIONS = 3

enum Intent {
  ANSWER = 'DIRECT_ANSWER',
  COMPLEX = 'COMPLEX_ANSWER',
  PLANNER = 'PLANNER',
  ACTION = 'ACTION',
}

enum PlanOutcome {
  CONFIRM = 'CONFIRM:',
  ANSWER = 'ANSWER:',
  ASK = 'ASK:',
  UPGRADE = 'UPGRADE',
}

export class FullServiceDirector {
  init = () => {
    indexer.loadFilesIntoVectors()
  }

  onMessage = async (payload: MessagePayload, postMessage: PostMessage) => {
    const { message } = payload

    if (message.role == 'assistant') {
      await this.regenerateResponse(payload, postMessage)
    } else if (message.role == 'user') {
      if (message.intent == Intent.PLANNER) {
        await this.usePlanningAgent(
          payload,
          attachmentListToString(message.attachments),
          postMessage
        )
      } else if (message.intent == Intent.ACTION) {
        await this.useActingAgent(payload, postMessage)
      } else {
        await this.detectIntent(payload, postMessage)
      }
    } else {
      log('got sent a system message, doing nothing')
    }
  }

  regenerateResponse = async (payload: MessagePayload, postMessage: PostMessage) => {
    const { message, history } = payload

    const reversedHistory = history.slice().reverse()
    const lastIntent = reversedHistory.find((h) => h.intent)?.intent
    const lastUserMessage = reversedHistory.find((h) => h.role == 'user')

    const intent = message.intent || lastIntent

    log('regenerating response for intent', intent)

    if (intent == Intent.PLANNER) {
      const attachmentBody = attachmentListToString(lastUserMessage?.attachments)
      await this.usePlanningAgent(payload, attachmentBody, postMessage)
    } else if (intent == Intent.ACTION) {
      await this.useActingAgent(payload, postMessage)
    } else {
      const newPayload = { message: lastUserMessage!, history }
      await this.detectIntent(newPayload, postMessage)
    }
  }

  systemMessage = () => {
    const project = path.basename(process.cwd())
    const systemMessage =
      'You are an EngineerGPT, an assistant for software engineers running in a ' +
      `${detectProjectLanguage()} project called ${project}`
    return systemMessage
  }

  detectIntent = async (payload: MessagePayload, postMessage: (message: ChatMessage) => void) => {
    // determine what we're doing
    const { message, history } = payload

    const model = message.options?.model || '3.5'
    const prompt = `Given my input & conversation history, determine the type of request:
- question that can be answered with only the context provided:
  ${
    model != '4' &&
    `if requires code generation or other complex reasoning, type = COMPLEX_ANSWER, message = tell the user to wait & why answer is complex
  else, `
  }type = DIRECT_ANSWER, message = answer to the question or request with code snippets if relevant
- requires context or taking action (from the file system, user, or internet), type = PLANNER, message = tell the user to wait & what planning is needed
- if none of these, type = DIRECT_ANSWER, message = ask the user for clarification and tell them to try again

Return in the format <type>: <message to the user>, e.g. DIRECT_ANSWER: the answer is 42

Analyze and categorize my query: `

    const attachmentBody = attachmentListToString(message.attachments)
    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt + message.content + attachmentBody,
    }
    const messages = compactMessageHistory([...history, userMessage], model, {
      role: 'system',
      content: this.systemMessage(),
    })

    const answer = await chatWithHistory(messages, model)
    const types = [Intent.ANSWER, Intent.PLANNER, Intent.COMPLEX]

    const { type, response } = detectTypeFromResponse(answer, types, Intent.ANSWER)

    const responseMessage: ChatMessage = {
      role: 'assistant',
      content: response,
      options: { model, type },
      intent: type,
    }
    history.push(message)
    history.push(responseMessage)
    postMessage(responseMessage)

    if (type == Intent.ANSWER) {
      // we're done
    } else if (type == Intent.COMPLEX) {
      if (!message.options) message.options = {}
      message.options.model = '4'
      await this.detectIntent(payload, postMessage)
    } else if (type == Intent.PLANNER) {
      await this.usePlanningAgent(payload, attachmentBody, postMessage)
    }
  }

  usePlanningAgent = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
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

    const systemMessage =
      this.systemMessage() +
      '. You are in planning mode, help figure out which files to edit then send to user for confirmation.'
    const agent = new Agent(tools, outputFormat, systemMessage)
    agent.actionParam = 'ResearchAction'
    agent.finalAnswerParam = 'TellUser'
    agent.model = options?.model || '3.5'

    // user wants to regenerate this message
    if (message.role == 'assistant') {
      while (message.role != 'user') {
        agent.addState(message.state)
        message = history.pop()!
      }
    }
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

  editor = new CodebaseEditor()
  useActingAgent = async (payload: MessagePayload, postMessage: PostMessage) => {
    await this.editor.planChanges(payload, postMessage)
  }
}
