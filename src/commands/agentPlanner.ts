import { DEFAULT_GLOB, GLOB_WITHOUT_TESTS, Indexer } from '@/db/indexer'
import { log } from '@/utils/logger'
import chalk from 'chalk'
import { cache } from '@/db/cache'
import { getFilesWithContext } from '@/context/manifest'
import fs from 'fs'
import { Plan } from '@/types'
import { findSimilarDocuments } from '@/utils/similarity'
import { unixTools } from '@/tools/unix'
import { generateCodeTools } from '@/tools/code'
import { Agent } from '@/ai/agent'
import { systemTools } from '@/tools/system'

type Options = {
  glob?: string
}

export const PLAN_FILE = 'plan.json'

// agent version of the planner
export default async function (query: string, options: Options) {
  const indexer = new Indexer()

  const plan = await doPlan(indexer, query, options)
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan))
  log(chalk.green(`Excellent! Wrote plan to ${PLAN_FILE}`))

  cache.close()
}

const SYSTEM_MESSAGE =
  'You are PlanGPT, you help plan changes to an existing codebase. Respond in the requested format with no extra comments. Do not try to modify anything.'

export async function doPlan(indexer: Indexer, query: string, options?: Options) {
  const baseGlob = query.includes('test') ? DEFAULT_GLOB : GLOB_WITHOUT_TESTS
  const files = await indexer.getFiles(options?.glob || baseGlob)
  const { docs } = await indexer.load(files)
  await indexer.loadVectors(docs)

  const relevantDocs = await findRelevantDocs(query, files, indexer)

  const tools = [...unixTools, ...systemTools, ...generateCodeTools(indexer)]

  const outputFormat = `the plan for how to make the changes requested, in the JSON format:
{
  "change": {
    "path/file3": "detailed explanation of change",
  },
  "clone": { "from/file":
    { "dest": "to/file", edits: "making a copy of from/file with changes" } },
  "create": {
    "other/file4": "detailed explanation of new file contents",
  },
  "rename": { "from/file": "to/file" },
  "delete": []
}`

  const agent = new Agent(tools, outputFormat)
  agent.systemMessage = SYSTEM_MESSAGE
  agent.addInitialState('What are the most relevant files to this query?', relevantDocs.join('\n'))

  let plan = await agent.runContinuous(query, 5, true)

  const jsonStart = plan.indexOf('{')
  const jsonEnd = plan.lastIndexOf('}')
  if (jsonStart > -1 && jsonEnd > -1) {
    plan = plan.substring(jsonStart, jsonEnd + 1)
    // sometimes trailing commas are generated. sometimes no commas are generated,
    const fixedJsonString = plan.replace(/"\n"/g, '",').replace(/,\s*([\]}])/g, '$1')

    // don't accept plans that are not JSON
    try {
      const finalPlan: Plan = { request: query, ...JSON.parse(fixedJsonString) }
      return finalPlan
    } catch (e) {
      log(chalk.red('Error:'), 'Oops, that was invalid JSON')
    }
  } else {
    log(chalk.yellow('Warning:'), 'Plan was not updated, got non-JSON response')
  }

  return { request: query }
}

async function findRelevantDocs(query: string, files: string[], indexer: Indexer) {
  const filteredFiles = filterFiles(files, query, 20)
  const fileSet = new Set(filteredFiles)
  const similarDocs = await indexer.vectorDB.search(query, 10)

  similarDocs?.forEach((doc) => {
    const file = doc.metadata.path.split('#')[0]
    fileSet.add(file)
  })

  const relevantFiles = Array.from(fileSet)
  const filesWithContext = getFilesWithContext(relevantFiles)
  return filesWithContext
}

function filterFiles(files: string[], query: string, limit: number) {
  if (files.length <= limit) return files
  const similar = findSimilarDocuments(query, files)

  return similar.slice(0, limit)
}
