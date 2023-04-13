import { getReadOnlyTools } from '@/agent'
import { Agent } from '@/agent/agent'
import { getFilesWithContext } from '@/context/manifest'
import { DEFAULT_GLOB, GLOB_WITHOUT_TESTS, indexer } from '@/db/indexer'
import { AbstractPlanner, PLAN_FORMAT_STR, parsePlan } from '@/tools/planner'
import { Plan } from '@/types'
import { log } from '@/utils/logger'
import { findSimilarDocuments } from '@/utils/similarity'
import { splitOnce } from '@/utils/utils'
import inquirer from 'inquirer'

const SYSTEM_MESSAGE =
  'You are PlannerGPT, you output a list of files that will be used by an AI to write code.' +
  'Don\t do any extra work, just return the plan if you know which files to change. Do not actually modify anything. ' +
  'Return the plan in this output format: ' +
  PLAN_FORMAT_STR

const OUTPUT_FORMAT = `I have the plan:
{ ... json plan ...}`

const MAX_PLAN_ITERATIONS = 5

export class AgentPlanner implements AbstractPlanner {
  constructor(public stopEachStep?: boolean) {}

  doPlan = async (query: string, glob?: string): Promise<Plan> => {
    const baseGlob = query.includes('test') ? DEFAULT_GLOB : GLOB_WITHOUT_TESTS
    const files = await indexer.getFiles(glob || baseGlob)
    const { docs, updatedDocs } = await indexer.load(files)
    await indexer.index(updatedDocs)
    await indexer.loadVectors(docs)

    const relevantDocs = await findRelevantDocs(query, files)
    const tools = getReadOnlyTools()

    const outputFormat = OUTPUT_FORMAT

    const agent = new Agent(tools, outputFormat, SYSTEM_MESSAGE)
    agent.actionParam = 'Research Action'
    agent.finalAnswerParam = 'Action Plan'

    agent.addInitialState('What are the most relevant files to this query?', relevantDocs)

    while (true) {
      const planString = await agent.runContinuous(query, MAX_PLAN_ITERATIONS, this.stopEachStep)

      const parsedPlan = parsePlan(query, planString)

      if (parsedPlan) log(parsedPlan)

      const prompt = parsedPlan
        ? 'Press enter to accept the plan, or tell me what to change:'
        : 'No plan was returned. Press enter to continue, or tell me what to change:'

      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'iterate',
          message: prompt,
        },
      ])

      const iterate = answer.iterate.trim()
      if (!iterate) return parsedPlan || { request: query }

      agent.addInitialState('The user tells me what to change:', iterate)
      agent.chatHistory.push({ role: 'user', content: iterate })
    }
  }
}

export async function findRelevantDocs(query: string, files: string[]) {
  const filteredFiles = filterFiles(files, query, 20)
  const fileSet = new Set(filteredFiles)
  const similarDocs = (await indexer.vectorDB.search(query, 10)) || []

  const exactMatches = await indexer.searchDB.search(query, 10)
  similarDocs.forEach((doc) => {
    const file = splitOnce(doc.metadata.path, '#')[0]
    fileSet.add(file)
  })

  const returnStrings = []
  if (exactMatches.length) returnStrings.push('Exact matches:', exactMatches.join('\n'))
  const relevantFiles = Array.from(fileSet)
  if (returnStrings.length && relevantFiles.length) returnStrings.push('Other related files:')
  if (relevantFiles.length) returnStrings.push(relevantFiles.join('\n'))

  return returnStrings.join('\n')
}

function filterFiles(files: string[], query: string, limit: number) {
  if (files.length <= limit) return files
  const similar = findSimilarDocuments(query, files)

  return similar.slice(0, limit)
}
