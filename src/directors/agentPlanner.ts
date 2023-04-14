import { getReadOnlyTools } from '@/agent'
import { Agent } from '@/agent/agent'
import { addToLearning } from '@/context/learning'
import { getFilesWithContext } from '@/context/manifest'
import { readConfig } from '@/context/projectConfig'
import { DEFAULT_GLOB, GLOB_WITHOUT_TESTS, indexer } from '@/db/indexer'
import { AbstractPlanner, PLAN_FORMAT_STR, parsePlan } from '@/directors/planner'
import { Plan } from '@/types'
import { log } from '@/utils/logger'
import { findSimilarDocuments } from '@/utils/similarity'
import { splitOnce } from '@/utils/utils'
import inquirer from 'inquirer'

const SYSTEM_MESSAGE =
  'You are PlannerGPT, you output a list of files that will be used by an AI to write code.' +
  'Listen very well to the user, ask if you need clarification, return the plan as soon as you ' +
  'think you know which files to change, but do not actually change anything. Return in this JSON format: ' +
  PLAN_FORMAT_STR

const OUTPUT_FORMAT = `I have the plan:
{ ... json plan ...}`

const MAX_PLAN_ITERATIONS = 5

export class AgentPlanner implements AbstractPlanner {
  constructor(public stopEachStep?: boolean) {}

  doPlan = async (query: string, glob?: string): Promise<Plan> => {
    const testRelated = query.includes('test')
    const baseGlob = testRelated ? DEFAULT_GLOB : GLOB_WITHOUT_TESTS

    const files = await indexer.getFiles(glob || baseGlob)
    const { docs, updatedDocs } = await indexer.load(files)
    await indexer.index(updatedDocs)
    await indexer.loadVectors(docs)

    const relevantDocs = await findRelevantDocs(query, files)
    const tools = getReadOnlyTools()

    const outputFormat = OUTPUT_FORMAT

    const agent = new Agent(tools, outputFormat, SYSTEM_MESSAGE)
    agent.actionParam = 'Research Action'
    agent.finalAnswerParam = 'Final Plan'

    agent.addInitialState('What are the most relevant files to this query?', relevantDocs)
    const config = readConfig()
    if (testRelated && config?.testDir) {
      agent.addInitialState('Where should tests go?', config.testDir)
    }

    while (true) {
      const planString = await agent.runContinuous(query, MAX_PLAN_ITERATIONS, this.stopEachStep)

      const parsedPlan = parsePlan(query, planString)

      if (parsedPlan) log(parsedPlan)
      else log(planString)

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
      if (!iterate) {
        if (parsedPlan) {
          addToLearning('planner', {
            request: query,
            output: planString,
            accepted: true,
          })
        }

        return parsedPlan || { request: query }
      }

      addToLearning('planner', {
        request: query,
        output: planString,
        accepted: false,
        feedback: iterate,
      })

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
