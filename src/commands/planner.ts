import { chatCompletion, chatWithHistory } from '@/ai/api'
import { DEFAULT_GLOB, GLOB_WITHOUT_TESTS, Indexer } from '@/db/indexer'
import { log, verboseLog } from '@/utils/logger'
import { oraPromise } from 'ora'
import chalk from 'chalk'
import { cache } from '@/db/cache'
import { getFilesWithContext } from '@/context/manifest'
import config from '@/config'
import fs from 'fs'
import { ChatMessage, Plan } from '@/types'
import inquirer from 'inquirer'
import { findSimilarDocuments } from '@/utils/similarity'

type Options = {
  glob?: string
}

export const PLAN_FILE = 'plan.json'

// zero-shot planner for how to complete a code task
// running the command stand-alone writes the plan to a file
export default async function (query: string, options: Options) {
  const indexer = new Indexer()

  const plan = await doPlan(indexer, query, options)

  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan))
  log(chalk.green(`Excellent! Wrote plan to ${PLAN_FILE}`))

  cache.close()
}

const SYSTEM_MESSAGE =
  'Respond in the requested format with no extra comments. Do not return actual code, and do not make up files to modify.'

export async function doPlan(indexer: Indexer, query: string, options?: Options) {
  const baseGlob = query.includes('test') ? DEFAULT_GLOB : GLOB_WITHOUT_TESTS

  const files = await indexer.getFiles(options?.glob || baseGlob)

  // return 200 most similar files
  const filteredFiles = filterFiles(files, query, 200)
  const filesWithContext = getFilesWithContext(filteredFiles)

  const prompt = createPlanPrompt(filesWithContext, query)

  verboseLog(prompt)

  const model = config.gpt4 == 'always' ? '4' : '3.5'

  const promise = chatCompletion(prompt, model, SYSTEM_MESSAGE)
  const result = await oraPromise(promise, { text: 'Generating an action plan...' })

  log(chalk.bold(`Here's my guess as to which files I'll need to access or change:`))
  log(result)

  const finalPlan = await loopIteratePlan(query, createPlanPrompt(filesWithContext, query), result)

  return finalPlan
}

function createPlanPrompt(filesWithContext: string[], query: string) {
  return `Project Files:
${filesWithContext.join('\n')}

---
Request: ${query}
Return a list of files which should be modified (at least 1) to fulfill this request in this JSON format:

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

    const jsonStart = plan.indexOf('{')
    const jsonEnd = plan.lastIndexOf('}')
    if (jsonStart > -1 && jsonEnd > -1) {
      plan = plan.substring(jsonStart, jsonEnd + 1)
      // sometimes trailing commas are generated. sometimes no commas are generated,
      const fixedJsonString = plan.replace(/"\n"/g, '",').replace(/,\s*([\]}])/g, '$1')

      // don't accept plans that are not JSON
      try {
        finalPlan = { request, ...JSON.parse(fixedJsonString) }
      } catch (e) {
        log(chalk.red('Error:'), 'Oops, that was invalid JSON')
      }
    } else {
      log(chalk.yellow('Warning:'), 'Plan was not updated, got non-JSON response')
    }

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
