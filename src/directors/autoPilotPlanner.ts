import fs from 'fs'
import path from 'path'

import { getSimpleTools } from '@/agent'
import { Tool } from '@/agent/tool'
import { chatCompletion, getModel, streamChatWithHistory } from '@/ai/api'
import config from '@/config'
import { readProjectContext } from '@/context/projectContext'
import { findRelevantDocs } from '@/context/relevantFiles'
import { indexer } from '@/db/indexer'
import { compactMessageHistory, detectProjectLanguage } from '@/directors/helpers'
import prompts from '@/prompts'
import { ChatMessage } from '@/types'
import { git } from '@/utils/git'
import { log } from '@/utils/logger'
import { fuzzyParseJSON, splitOnce } from '@/utils/utils'

export type PlanResult = {
  plan?: string[]
  failure?: string
  edits?: { [key: string]: string }
  tools?: { name: string; input: string }[]
}

const PLAN_LOOPS = 3

export class AutoPilotPlanner {
  tools: Tool[] = getSimpleTools()
  request: string = ''
  systemMessage: string = ''

  plan = async (
    request: string,
    history: ChatMessage[],
    systemMessage: string,
    diff?: string
  ): Promise<PlanResult> => {
    this.request = request
    this.systemMessage = systemMessage

    let toolOutput = await this.getInitialReference(diff)
    let prevPlan: PlanResult = {}

    for (let i = 0; i < PLAN_LOOPS; i++) {
      let output = await this.runPlanner(i, prevPlan.plan || [], toolOutput, history)
      const result = await this.parsePlanResult(output)

      if (result.failure) {
        return result
      }

      if (result.tools && i < PLAN_LOOPS - 1) {
        toolOutput = await this.runTools(result.tools)
      } else if (result.edits) {
        return result
      }
      prevPlan = result
    }

    return { failure: 'Unable to generate a plan' }
  }

  parsePlanResult = async (plan: string): Promise<PlanResult> => {
    let parsed: PlanResult | null = fuzzyParseJSON(plan)
    if (!parsed) {
      log('warning: received invalid json, attempting fix')
      const response = await chatCompletion(prompts.jsonFixer({ input: plan, schema }), '3.5')
      parsed = fuzzyParseJSON(response)
    }

    if (!parsed) return { failure: 'Unable to parse JSON response: ' + plan }

    if (parsed.failure) return parsed

    return parsed
  }

  runPlanner = async (
    iteration: number,
    plan: string[],
    toolOutput: string[],
    history: ChatMessage[]
  ) => {
    const message: ChatMessage = {
      role: 'user',
      content: this.request,
    }

    const model = getModel(false)
    const toolDescriptions = this.tools.map((t) => `${t.name} - ${t.description}`)

    const prompt =
      iteration == 0
        ? prompts.autoPilotPlanner1({
            message: message.content,
            references: toolOutput,
            tools: toolDescriptions,
            exampleJson: [exampleFrontendPlan, exampleBackendPlan, exampleSimplePlan],
          })
        : iteration < PLAN_LOOPS - 1
        ? prompts.autoPilotPlanner2({
            message: message.content,
            plan: plan,
            toolResults: toolOutput,
            tools: toolDescriptions,
          })
        : prompts.autoPilotPlanner3({
            message: message.content,
            plan: plan,
            toolResults: toolOutput,
          })

    const userMessage: ChatMessage = { role: 'user', content: prompt }
    const messages: ChatMessage[] = compactMessageHistory([...history, userMessage], model, {
      content: this.systemMessage,
      role: 'system',
    })

    const result = await streamChatWithHistory(messages, model, (response) => {
      process.stdout.write(typeof response == 'string' ? response : '\n')
    })

    history.push({ role: 'assistant', content: result })

    fs.writeFileSync(`${config.configFolder}/plan${iteration}.txt`, result)
    return result
  }

  runTools = async (tools: { name: string; input: string }[]) => {
    const output = []
    for (const tool of tools) {
      const toolInstance = this.tools.find((t) => t.name == tool.name)
      if (!toolInstance) {
        output.push(`Tool not found: ${tool.name}`)
        continue
      }

      output.push(`Running ${tool.name} with input: ${tool.input}`)
      const result = await toolInstance.run(tool.input, this.request)
      output.push(result)
    }

    return output
  }

  getInitialReference = async (diff?: string) => {
    if (diff) {
      const diffData = git(['diff', diff])
      return [diffData]
    }

    const relevantDocs = await findRelevantDocs(this.request, indexer.files, 50)
    const similarCode = await indexer.vectorDB.searchWithScores(this.request, 6)
    const similarFuncs =
      similarCode
        ?.filter((s) => {
          const [doc, score] = s
          if (score < 0.15) return false
          return true
        })
        .sort((a, b) => a[0].metadata.path.localeCompare(b[0].metadata.path))
        .map((s) => s[0]) || []

    // read entire top file
    const similarFiles = similarFuncs.map((s) => splitOnce(s.metadata.path, '#')[0])
    const similarFileCount = new Map<string, number>()
    for (const file of similarFiles) {
      similarFileCount.set(file, (similarFileCount.get(file) || 0) + 1)
    }
    const topFile = [...similarFileCount.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const topFileContent = fs.existsSync(topFile) ? fs.readFileSync(topFile, 'utf8') : null

    // remove top file from similarFuncs
    const funcsToRead = topFileContent
      ? similarFuncs.filter((s) => !s.metadata.path.startsWith(topFile))
      : similarFuncs

    const contexts: string[] = [
      'Codebase files:',
      relevantDocs,
      'Code snippets:',
      funcsToRead.map((f) => f.pageContent).join('\n----------\n'),
    ]
    if (topFileContent) {
      contexts.push('\n\n', topFile, topFileContent)
    }

    return contexts
  }
}

const exampleFrontendPlan = {
  request: 'I want to add a sidebar to my app with navigation links to other pages',
  plan: [
    'Look for main app layout file',
    'Read routes from router file',
    'Create a sidebar component file with links',
    'Add the sidebar component to the main app layout file',
  ],
  tools: [{ name: 'showFiles', input: 'src/App.tsx, src/routes.ts' }],
}

const exampleBackendPlan = {
  request: 'I want to add a new API route for deleting widgets',
  plan: [
    'Read package.json to understand the backend framework',
    'Read prisma schema database file',
    'Create new delete widget handler',
    'Add to API handler file',
  ],
  tools: [
    { name: 'listFiles', input: 'src/api' },
    { name: 'showFiles', input: 'package.json, prisma/schema.prisma, src/lib/api.ts' },
  ],
}

const exampleSimplePlan = {
  request: 'I want to add a tooltip to the buttons on the Dashboard',
  plan: ['Edit the dashboard, add tooltips to all the buttons'],
  edits: [
    {
      'src/pages/dashboard.tsx':
        'add tooltips to all the buttons by adding a data-tooltip attribute',
    },
  ],
}

const schema = `{
  plan: ['array of steps to take',],
  // tools are optional
  tools: [{ name: 'tool to invoke', input: 'input args' }],
  // edits are optional
  edits: { "path/to/file": "file changes" }
}`