import { getAllTools, getReadOnlyTools } from '@/agent'
import { Agent } from '@/agent/agent'
import { getFilesWithContext } from '@/context/manifest'
import { DEFAULT_GLOB, GLOB_WITHOUT_TESTS, Indexer } from '@/db/indexer'
import { findSimilarDocuments } from '@/utils/similarity'
import { splitOnce } from '@/utils/utils'

const SYSTEM_MESSAGE =
  'You are PlannerGPT, you output plans that will be used by an AI to write code. Be very ' +
  "efficient with your actions and only use the tools provided. Many edits don't require any " +
  'tools. Return the plan in the output format specified below:' +
  `
  
{
  "unixCommands": [
    "sed -i 's/old/new/g' *",
  ],
  "reference": ['up to three files given to AI as reference'],
  "change": {
    "path/file3": "detailed explanation of change with all the context that an AI needs",
  },
  "clone": { 
    "from/file": { "dest": "to/file", edits: "any edits to make to the dest file" } 
  },
  "create": {
    "other/file4": "detailed explanation of new file contents",
  },
  "rename": { "from/file": "to/file" },
  "delete": []
}
`

const OUTPUT_FORMAT = `I have the plan:
{ ... json plan ...}`

export class Planner {
  doPlan = async (indexer: Indexer, query: string, glob?: string) => {
    const baseGlob = query.includes('test') ? DEFAULT_GLOB : GLOB_WITHOUT_TESTS
    const files = await indexer.getFiles(glob || baseGlob)
    const { docs, updatedDocs } = await indexer.load(files)
    await indexer.index(updatedDocs)
    await indexer.loadVectors(docs)

    const relevantDocs = await findRelevantDocs(query, files, indexer)
    const tools = getReadOnlyTools(indexer)

    const outputFormat = OUTPUT_FORMAT

    const agent = new Agent(tools, outputFormat, SYSTEM_MESSAGE)

    agent.addInitialState(
      'What are the most relevant files to this query?',
      relevantDocs.join('\n')
    )

    await agent.runContinuous(query, 10, true)
  }
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
