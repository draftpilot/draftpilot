import { chatCompletion } from '@/ai/chat'
import { cache } from '@/db/cache'
import { Indexer } from '@/db/indexer'
import { log, verboseLog } from '@/utils/logger'
import { readConfig } from '@/utils/utils'
import chalk from 'chalk'
import { oraPromise } from 'ora'
import fs from 'fs'
import { PLAN_FILE } from '@/commands/planner'
import { Plan } from '@/types'
import config from '@/config'
import * as Diff from 'diff'
import { dirname, basename } from 'path'

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

export async function executePlan(plan: Plan, indexer: Indexer): Promise<boolean> {
  const promises: Promise<string | null>[] = []
  if (plan.change) {
    Object.keys(plan.change).forEach((file) =>
      promises.push(doChange(plan, indexer, file, plan.change![file]))
    )
  }

  if (plan.create) {
    Object.keys(plan.create).forEach((file) =>
      promises.push(createFile(plan, file, plan.create![file]))
    )
  }

  if (plan.delete) {
    plan.delete.forEach((file) => promises.push(deleteFile(file, indexer)))
  }

  if (plan.copyAndEdit) {
    Object.keys(plan.copyAndEdit).forEach((file) =>
      promises.push(doCopyAndEdit(plan, indexer, file))
    )
  }

  const promise = Promise.all(promises)
  const results = await oraPromise(promise, { text: 'Executing...' })

  const messages = results.filter(Boolean)

  if (messages.length) {
    log('Execution finished with errors:')
    messages.forEach((m) => log(m))
    log('Please check /tmp/*.patch and *.prompt to inspect intermediate results.')
    return false
  } else {
    log(chalk.green('Success! '), 'Execution finished successfully.')
    log('If anything went wrong, results were output to /tmp/*.patch and *.prompt')
    return true
  }
}

async function createFile(plan: Plan, file: string, changes: string) {
  const prompt = `Create a new file at ${file} based on the following request: ${changes}
---
Overall goal: ${plan.request}`

  const systemMessage = `Output only file contents with no commentary and no changes to other files`
  const model = config.gpt4 == 'never' ? '3.5' : '4'
  const result = await chatCompletion(prompt, model, systemMessage)

  if (!result) {
    return chalk.red('Error: ') + `Unable to create file at ${file}.`
  }

  const dir = dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, result)
  return null
}

async function deleteFile(file: string, indexer: Indexer) {
  file = findMatchingFile(file, indexer)
  if (!fs.existsSync(file)) {
    return chalk.red('Error: ') + `File ${file} does not exist.`
  }

  fs.unlinkSync(file)
  return null
}

async function doCopyAndEdit(plan: Plan, indexer: Indexer, file: string) {
  const dest = plan.copyAndEdit![file]
  file = findMatchingFile(file, indexer)

  if (!fs.existsSync(file)) {
    return chalk.red('Error: ') + `File ${file} does not exist.`
  }

  return await doChange(plan, indexer, file, dest.edits, dest.dest)
}

async function doChange(
  plan: Plan,
  indexer: Indexer,
  file: string,
  changes: string,
  outputFile?: string
) {
  file = findMatchingFile(file, indexer)
  if (!fs.existsSync(file)) return chalk.red('Error: ') + `File ${file} does not exist.`
  const fileContents = fs.readFileSync(file, 'utf8')
  if (!outputFile) outputFile = file

  const similar = (await indexer.vectorDB.search(changes, 6)) || []
  const notInFile = similar.filter((s) => !s.metadata.path.includes(file)).slice(0, 4)

  const fileLines = fileContents.split('\n')
  const outputFormat = fileLines.length < 200 ? 'full' : 'diff'

  const decoratedLines =
    outputFormat == 'full' ? fileLines : fileLines.map((l, i) => `${i + 1}: ${l}`)

  const prompt = `
Possibly related code:
${notInFile.map((s) => s.pageContent).join('\n\n')}

---
${file} contents:
${decoratedLines.join('\n')}

---
Overall goal: ${plan.request}

Apply the following changes to the ${file}: ${changes}`

  const model = config.gpt4 == 'never' ? '3.5' : '4'

  const systemMessage = outputFormat == 'full' ? FULL_FORMAT : DIFF_FORMAT

  const tempInput = '/tmp/' + basename(file) + '.prompt'
  fs.writeFileSync(tempInput, systemMessage + '\n\n' + prompt)

  const result = await chatCompletion(prompt, model, systemMessage)

  if (outputFormat == 'full') {
    fs.writeFileSync(outputFile, result)
  } else {
    const tempOutput = '/tmp/' + basename(file) + '.patch'
    fs.writeFileSync(tempOutput, 'changing ' + file + '\n\n' + result)

    if (!result.startsWith('@@')) {
      return (
        chalk.red('Error: ') +
        `AI completion did not return a valid patch file. Please check ${tempOutput} for details.`
      )
    }

    try {
      const output = Diff.applyPatch(fileContents, result.trim(), { fuzzFactor: 5 })
      fs.writeFileSync(outputFile, output)
    } catch (e: any) {
      return (
        chalk.red('Error: ') +
        `Unable to apply patch to ${file}. The AI is not very good at ` +
        `producing diffs, so you can try to apply it yourself: ${tempOutput}.`
      )
    }
  }

  return null
}

const DIFF_FORMAT = `Output only in patch format with no commentary and no changes to other files. e.g:
@@ -20,7 +20,6 @@
 context2
 context3
-  line to be deleted
+  line to be added
  context4
@@ -88,6 +87,11 @@`

const FULL_FORMAT = `Output complete file with no commentary and no changes to other files.`

export const findMatchingFile = (file: string, indexer: Indexer) => {
  if (fs.existsSync(file)) return file

  const similar = indexer.files.find((f) => f.endsWith(file))
  if (similar) return similar

  return file
}
