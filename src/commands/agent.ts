import { DEFAULT_GLOB, GLOB_WITHOUT_TESTS, Indexer } from '@/db/indexer'
import { cache } from '@/db/cache'
import { getFilesWithContext } from '@/context/manifest'
import { findSimilarDocuments } from '@/utils/similarity'
import { Agent } from '@/agent/agent'
import { splitOnce } from '@/utils/utils'
import { getAllTools } from '@/agent'

type Options = {
  glob?: string
}

export const PLAN_FILE = 'plan.json'

// agent version of the planner
export default async function (query: string, options: Options) {
  const indexer = new Indexer()

  await doPlan(indexer, query, options)

  cache.close()
}

const SYSTEM_MESSAGE =
  'You are EngineerGPT, you help make changes to an existing codebase in as few steps as possible. Only use the tools provided, unix/bash expressions not supported.'

export async function doPlan(indexer: Indexer, query: string, options?: Options) {
  const baseGlob = query.includes('test') ? DEFAULT_GLOB : GLOB_WITHOUT_TESTS
  const files = await indexer.getFiles(options?.glob || baseGlob)
  const { docs, updatedDocs } = await indexer.load(files)
  await indexer.index(updatedDocs)
  await indexer.loadVectors(docs)

  const relevantDocs = await findRelevantDocs(query, files, indexer)
  const tools = getAllTools(indexer)

  const outputFormat = `Request is complete`

  const agent = new Agent(tools, outputFormat)
  agent.systemMessage = SYSTEM_MESSAGE
  agent.addInitialState('What are the most relevant files to this query?', relevantDocs.join('\n'))

  await agent.runContinuous(query, 10, true)
}

async function findRelevantDocs(query: string, files: string[], indexer: Indexer) {
  const filteredFiles = filterFiles(files, query, 20)
  const fileSet = new Set(filteredFiles)
  const similarDocs = await indexer.vectorDB.search(query, 10)

  similarDocs?.forEach((doc) => {
    const file = splitOnce(doc.metadata.path, '#')[0]
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
