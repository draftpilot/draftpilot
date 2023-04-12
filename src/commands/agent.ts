import { getAllTools } from '@/agent'
import { Agent } from '@/agent/agent'
import { cache } from '@/db/cache'
import { DEFAULT_GLOB, GLOB_WITHOUT_TESTS, indexer } from '@/db/indexer'
import { AgentPlanner, findRelevantDocs } from '@/tools/agentPlanner'
import inquirer from 'inquirer'

type Options = {
  glob?: string
}

const SYSTEM_MESSAGE =
  "You are SoftwareGPT, a coding assistant that works in the user's codebase. " +
  'Be efficient with your actions and only use the tools provided'

// read/write version of the agent
export default async function (query: string, options: Options) {
  if (!query) {
    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: 'What do you want to do?',
      },
    ])
    query = response.query
  }

  const baseGlob = query.includes('test') ? DEFAULT_GLOB : GLOB_WITHOUT_TESTS
  const files = await indexer.getFiles(options.glob || baseGlob)
  const { docs, updatedDocs } = await indexer.load(files)
  await indexer.index(updatedDocs)
  await indexer.loadVectors(docs)

  const relevantDocs = await findRelevantDocs(query, files)

  const tools = getAllTools()
  const outputFormat = 'Finished making changes'
  const agent = new Agent(tools, outputFormat, SYSTEM_MESSAGE)
  agent.actionParam = 'Research Action'
  agent.finalAnswerParam = 'Action Plan'

  agent.addInitialState('What are the most relevant files to this query?', relevantDocs.join('\n'))

  await agent.runContinuous(query, 10, true)

  cache.close()
}
