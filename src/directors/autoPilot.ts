import fs from 'fs'
import path from 'path'

import { getSimpleTools } from '@/agent'
import { Tool } from '@/agent/tool'
import { chatWithHistory, getModel, streamChatWithHistory } from '@/ai/api'
import { readProjectContext } from '@/context/projectContext'
import { findRelevantDocs, getManifestFiles } from '@/context/relevantFiles'
import { indexer } from '@/db/indexer'
import { CodebaseEditor } from '@/directors/codebaseEditor'
import { CrashPilot } from '@/directors/crashPilot'
import { DraftPilot } from '@/directors/draftPilot'
import { GenerateContext } from '@/directors/generateContext'
import { attachmentListToString, detectProjectLanguage } from '@/directors/helpers'
import { IntentDetector } from '@/directors/intentDetector'
import { IntentHandler } from '@/directors/intentHandler'
import { PostAction } from '@/directors/postAction'
import { ProductAssistant } from '@/directors/productAssistant'
import prompts from '@/prompts'
import { ChatMessage, Intent, MessagePayload, PostMessage } from '@/types'
import { log } from '@/utils/logger'
import { tracker } from '@/utils/tracker'

export class AutoPilot {
  context: string = ''
  interrupted = new Set<string>()
  tools: Tool[] = getSimpleTools()

  constructor() {
    this.context = readProjectContext() || ''
    indexer.loadFilesIntoVectors()
  }

  systemMessage = () => {
    const project = path.basename(process.cwd())
    return prompts.systemMessage({
      language: detectProjectLanguage() || 'unknown',
      project,
      context: this.context,
    })
  }

  plan = async (request: string) => {
    const message: ChatMessage = {
      role: 'user',
      content: request,
    }

    const relevantDocs = await findRelevantDocs(message.content, indexer.files, 50)
    const similarCode = await indexer.vectorDB.searchWithScores(message.content, 6)
    const similarFuncs =
      similarCode
        ?.filter((s) => {
          const [doc, score] = s
          if (score < 0.15) return false
          return true
        })
        .map((s) => s[0].pageContent) || []

    // TODO: git history, past learnings

    const contexts: string[] = ['Codebase files:', relevantDocs, 'Code snippets:', ...similarFuncs]

    const model = getModel(false)

    const toolDescriptions = this.tools.map((t) => `${t.name} - ${t.description}`)

    const prompt = prompts.autoPilotPlanner({
      message: message.content,
      references: contexts.join('\n\n'),
      tools: toolDescriptions,
      exampleJson: [exampleFrontendPlan, exampleBackendPlan, exampleSimplePlan],
    })

    const messages: ChatMessage[] = [
      {
        content: this.systemMessage(),
        role: 'system',
      },
      { role: 'user', content: prompt },
    ]

    const result = await streamChatWithHistory(messages, model, (response) => {
      process.stdout.write(response)
    })

    fs.writeFileSync('/tmp/plan.txt', result)
    return result
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
