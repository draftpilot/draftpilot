import { chatCompletion, chatWithHistory } from '@/ai/api'
import { DEFAULT_GLOB, GLOB_WITHOUT_TESTS, indexer } from '@/db/indexer'
import { log, verboseLog } from '@/utils/logger'
import { oraPromise } from 'ora'
import chalk from 'chalk'
import { getFilesWithContext } from '@/context/manifest'
import config from '@/config'
import { ChatMessage, Plan } from '@/types/types'
import inquirer from 'inquirer'
import { findSimilarDocuments } from '@/utils/similarity'
import { AbstractPlanner, PLAN_FORMAT_STR, parsePlan } from '@/tools/planner'

const SYSTEM_MESSAGE =
  'Respond in the requested format with no extra comments. Do not return actual code, and do not make up files to modify.'

export class OneShotPlanner implements AbstractPlanner {
  doPlan = async (query: string, glob?: string): Promise<Plan> => {
    const baseGlob = query.includes('test') ? DEFAULT_GLOB : GLOB_WITHOUT_TESTS

    const files = await indexer.getFiles(glob || baseGlob)

    // return 200 most similar files
    const filteredFiles = filterFiles(files, query, 200)
    const filesWithContext = getFilesWithContext(filteredFiles)

    const prompt = createPlanPrompt(filesWithContext, query)

    verboseLog(prompt)

    const model = config.gpt4 == 'always' ? '4' : '3.5'

    const promise = chatCompletion(prompt, model, SYSTEM_MESSAGE)
    const result = await oraPromise(promise, { text: 'Generating an action plan...' })

    log(chalk.bold(`Here's my guess as to which files I'll need to access or change:`))
    log(parsePlan(query, result))

    const finalPlan = await loopIteratePlan(
      query,
      createPlanPrompt(filesWithContext, query),
      result
    )

    return finalPlan
  }
}

function createPlanPrompt(filesWithContext: string[], query: string) {
  return `Project Files:
${filesWithContext.join('\n')}

---
Request: ${query}
Return a list of files which should be modified (at least 1) to fulfill this request in this JSON format:

${PLAN_FORMAT_STR}`
}

async function loopIteratePlan(request: string, prompt: string, plan: string): Promise<Plan> {
  const chatHistory: ChatMessage[] = [
    { role: 'system', content: SYSTEM_MESSAGE },
    { role: 'user', content: prompt },
    { role: 'assistant', content: plan },
  ]

  let finalPlan: Plan = { request }

  while (true) {
    plan = plan.trim()

    const parsedPlan = parsePlan(request, plan)
    if (parsedPlan) finalPlan = parsedPlan

    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'iterate',
        message: 'Press enter to accept the plan, or tell me what to change:',
      },
    ])

    const iterate = answer.iterate.trim()
    if (!iterate) return finalPlan

    chatHistory.push({ role: 'user', content: iterate })

    const model = config.gpt4 == 'always' ? '4' : '3.5'
    const promise = chatWithHistory(chatHistory, model)

    plan = await oraPromise(promise, { text: 'Revising the plan...' })

    log(chalk.bold(`Here's the updated plan:`))
    log(plan)

    chatHistory.push({ role: 'assistant', content: plan })
  }
}

function filterFiles(files: string[], query: string, limit: number) {
  if (files.length <= limit) return files
  const similar = findSimilarDocuments(query, files)

  return similar.slice(0, limit)
}
