import { chatCompletion, chatWithHistory } from '@/ai/chat'
import { Indexer } from '@/db/indexer'
import { log, verboseLog } from '@/logger'
import { oraPromise } from 'ora'
import chalk from 'chalk'
import { cache } from '@/db/cache'
import { getFilesWithContext } from '@/context/filetree'
import { getSimilarMethods } from '@/context/similar'
import config from '@/config'
import fs from 'fs'
import { ChatMessage } from '@/types'
import inquirer from 'inquirer'

type Options = {
  glob?: string
}

export const PLAN_FILE = 'plan.json'

export default async function (query: string, options: Options) {
  const result = await doPlan(query, options)

  log(chalk.green(`Excellent! Wrote plan to ${PLAN_FILE}`))

  cache.close()
}

const SYSTEM_MESSAGE =
  'Respond in the requested format with no extra comments. Do not return actual code.'

export async function doPlan(query: string, options?: Options) {
  const indexer = new Indexer()

  const files = await indexer.getFiles(options?.glob)
  const { docs, newDocs, existing } = await indexer.load()
  if (!existing) await indexer.index(newDocs)
  await indexer.loadVectors(docs)

  const filesWithContext = getFilesWithContext(files)

  const similar = null // await getSimilarMethods(indexer, query, 4)
  // TODO: this is where we should output the exported class members

  const prompt = createPlanPrompt(filesWithContext, similar, query)

  verboseLog(prompt)

  const model = config.gpt4 == 'always' ? '4' : '3.5'

  const promise = chatCompletion(prompt, model, SYSTEM_MESSAGE)
  const result = await oraPromise(promise, { text: 'Generating an action plan...' })

  log(chalk.bold(`Here's my guess as to which files I'll need to access or change:`))
  log(result)

  const finalPlan = await loopIteratePlan(createPlanPrompt(filesWithContext, null, query), result)

  return finalPlan
}

function createPlanPrompt(filesWithContext: string[], similar: string | null, query: string) {
  return `Project Files:
${filesWithContext.join('\n')}

---
Request: ${query}
Return a list of files which should be accessed for context (no more than 3) or changed to fulfill
this request in this JSON format:

{
  "read": ["path/file1", "path/to/file2"],
  "change": {
    "path/file3": "detailed explanation of change",
  },
  "add": {
    "other/file4": "detailed explanation of change",
  },
  "delete": []
}`
}

async function loopIteratePlan(prompt: string, plan: string) {
  const chatHistory: ChatMessage[] = [
    { role: 'system', content: SYSTEM_MESSAGE },
    { role: 'user', content: prompt },
    { role: 'assistant', content: plan },
  ]

  while (true) {
    plan = plan.trim()
    if (plan.startsWith('{') && plan.endsWith('}')) {
      fs.writeFileSync(PLAN_FILE, plan)
    }

    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'iterate',
        message: 'Press enter to accept the plan, or tell me what to change:',
      },
    ])

    const iterate = answer.iterate.trim()
    if (!iterate) return plan

    chatHistory.push({ role: 'user', content: iterate })

    const model = config.gpt4 == 'always' ? '4' : '3.5'
    const promise = chatWithHistory(chatHistory, model)

    plan = await oraPromise(promise, { text: 'Revising the plan...' })

    log(chalk.bold(`Here's the updated plan:`))
    log(plan)

    chatHistory.push({ role: 'assistant', content: plan })
  }
}
