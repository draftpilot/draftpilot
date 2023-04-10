import { chatCompletion } from '@/ai/chat'
import { cache } from '@/db/cache'
import { Indexer } from '@/db/indexer'
import { log, verboseLog } from '@/logger'
import { readConfig } from '@/utils'
import chalk from 'chalk'
import { oraPromise } from 'ora'
import fs from 'fs'
import { PLAN_FILE } from '@/commands/planner'
import { Plan } from '@/types'
import config from '@/config'
import * as Diff from 'diff'

type Options = {}

// executes a plan
export default async function (file: string | undefined, options: Options) {
  const config = readConfig()
  if (!config) throw new Error('you must run `init` first')

  const indexer = new Indexer()
  const { docs, updatedDocs, existing } = await indexer.load()
  if (!existing) await indexer.index(updatedDocs)
  await indexer.loadVectors(docs)

  const planText = fs.readFileSync(file || PLAN_FILE, 'utf8')
  try {
    const plan: Plan = JSON.parse(planText)

    await executePlan(plan, indexer)
  } catch (e: any) {
    throw new Error('Unable to parse plan file', e)
  }

  cache.close()
}

export async function executePlan(plan: Plan, indexer: Indexer) {
  const promises: Promise<string | null>[] = []
  if (plan.change) {
    Object.keys(plan.change).forEach((file) =>
      promises.push(doChange(indexer, file, plan.change[file]))
    )
  }

  const promise = Promise.all(promises)
  const results = await oraPromise(promise, { text: 'Executing...' })

  const messages = results.filter(Boolean)

  if (messages.length) {
    log('Execution finished with errors:', ...messages)
  } else {
    log(chalk.green('Success! '), 'Execution finished successfully.')
  }
}

async function doChange(indexer: Indexer, file: string, changes: string) {
  if (!fs.existsSync(file)) return chalk.red('Error: ') + `File ${file} does not exist.`

  const similar = (await indexer.vectorDB.search(changes, 6)) || []
  const notInFile = similar.filter((s) => !s.metadata.path.includes(file)).slice(0, 4)

  const fileContents = fs.readFileSync(file, 'utf8')
  const fileLines = fileContents.split('\n').map((l, i) => `${i + 1}: ${l}`)

  const prompt = `
Related functions:
${notInFile.map((s) => s.pageContent).join('\n\n')}

---
File contents:
${fileLines.join('\n')}

---
Perform the following modification, outputting in unified patch format: ${changes}

@@ -20,7 +20,6 @@
 context2
 context3
-  line to be deleted
+  line to be added
  context4
@@ -88,6 +87,11 @@
...etc`

  const model = config.gpt4 == 'never' ? '3.5' : '4'

  const result = await chatCompletion(prompt, model)

  verboseLog('result for', file, changes, result)

  try {
    const output = Diff.applyPatch(fileContents, result.trim(), { fuzzFactor: 5 })
    fs.writeFileSync(file, output)
  } catch (e: any) {
    return chalk.red('Error: ') + `Unable to apply patch to ${file}: ${e.message}`
  }

  return null
}
