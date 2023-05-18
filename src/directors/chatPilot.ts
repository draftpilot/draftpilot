import fs from 'fs'
import path from 'path'

import { getSimpleTools } from '@/agent'
import { Tool } from '@/agent/tool'
import openAIApi, { getModel } from '@/ai/api'
import config from '@/config'
import { findRelevantDocs } from '@/context/relevantFiles'
import { indexer } from '@/db/indexer'
import { compactMessageHistory, detectProjectLanguage } from '@/directors/helpers'
import prompts from '@/prompts'
import { ChatMessage, ProjectConfig } from '@/types'
import { git } from '@/utils/git'
import { log } from '@/utils/logger'
import { fuzzyParseJSON, splitOnce } from '@/utils/utils'
import { readConfig } from '@/context/projectConfig'
import { AutoPilot } from '@/directors/autoPilot'
import { AutoPilotPlanner, ToolSpec } from '@/directors/autoPilotPlanner'

export class ChatPilot {
  tools: Tool[] = getSimpleTools()
  request: string = ''
  systemMessage: ChatMessage
  context: string

  constructor() {
    this.context = readConfig()?.description || ''

    const project = path.basename(process.cwd())
    const systemMessage = prompts.systemMessage({
      language: detectProjectLanguage() || 'unknown',
      project,
      context: this.context,
    })
    this.systemMessage = {
      role: 'system',
      content: systemMessage,
    }
  }

  planner = new AutoPilotPlanner()

  chat = async (request: string, history: ChatMessage[]): Promise<string[]> => {
    this.request = request

    const outputs: string[] = []

    const references = await this.planner.getInitialReference()
    const toolDescriptions = this.tools.map((t) => `${t.name} - ${t.description}`)

    let prompt = prompts.chatPlanner1({
      message: request,
      references,
      tools: toolDescriptions,
    })

    const result = await this.runPrompt(prompt, history)
    outputs.push(result)

    const hasTools = result.indexOf('TOOLS')
    if (hasTools == -1) return outputs

    const thought = result.slice(0, hasTools).trim()
    let tools = result.slice(hasTools + 6).trim()
    if (tools.startsWith(':')) tools = tools.slice(1).trim()

    const parsed = await this.parseTools(tools)
    if (typeof parsed == 'string') {
      log(parsed)
      return outputs
    }

    const results = await this.planner.runTools(parsed)

    prompt = prompts.chatPlanner2({
      message: request,
      thought,
      toolResults: results,
    })

    outputs.push(await this.runPrompt(prompt, history))

    return outputs
  }

  parseTools = async (tools: string): Promise<ToolSpec[] | string> => {
    let parsed: ToolSpec[] | null = fuzzyParseJSON(tools)
    if (!parsed) {
      log('warning: received invalid json, attempting fix')
      const response = await openAIApi.chatCompletion(
        prompts.jsonFixer({ input: tools, schema }),
        '3.5'
      )
      parsed = fuzzyParseJSON(response)
    }

    if (!parsed) return 'Unable to parse JSON tools block'
    return parsed
  }

  runPrompt = async (prompt: string, history: ChatMessage[]) => {
    const model = getModel(false)
    const userMessage: ChatMessage = { role: 'user', content: prompt }
    const messages: ChatMessage[] = compactMessageHistory(
      [...history, userMessage],
      model,
      this.systemMessage
    )

    const result = await openAIApi.streamChatWithHistory(messages, model, (response) => {
      process.stdout.write(typeof response == 'string' ? response : '\n')
    })
    process.stdout.write('\n')

    history.push({ role: 'assistant', content: result })

    fs.writeFileSync(`${config.configFolder}/chat-${new Date().toISOString()}.txt`, result)
    return result
  }
}

const schema = '[ { "name": "name of tool", "input": ["args"] } ]'
