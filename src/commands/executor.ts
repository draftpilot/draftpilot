import { chatCompletion } from '@/ai/api'
import { cache } from '@/db/cache'
import { Indexer } from '@/db/indexer'
import { log, verboseLog } from '@/utils/logger'
import { fuzzyMatchingFile, readConfig } from '@/utils/utils'
import chalk from 'chalk'
import { oraPromise } from 'ora'
import fs from 'fs'
import { PLAN_FILE } from '@/commands/planner'
import { Plan } from '@/types'
import config from '@/config'
import * as Diff from 'diff'
import { dirname, basename } from 'path'
import type { Document } from 'langchain/dist/document'

type Options = {
  glob?: string
}

// executes a plan
export default async function (file: string | undefined, options: Options) {
  const indexer = new Indexer()
  const files = await indexer.getFiles(options.glob)
  const { docs, updatedDocs, existing } = await indexer.load(files)
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

  if (plan.clone) {
    Object.keys(plan.clone).forEach((file) => promises.push(doClone(plan, indexer, file)))
  }

  const start = Date.now()
  const promise = Promise.all(promises)
  const text =
    config.gpt4 == 'never'
      ? 'Executing...'
      : 'Executing (GPT-4 is slow so this may take a while)...'
  const results = await oraPromise(promise, { text })

  const messages = results.filter(Boolean)

  log(`Execution took ${Date.now() - start}ms`)

  if (messages.length) {
    log('Finished with errors:')
    messages.forEach((m) => log(m))
    log('Please check /tmp/*.patch and *.prompt to inspect intermediate results.')
    return false
  } else {
    log(chalk.green('Success!'))
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
  file = fuzzyMatchingFile(file, indexer.files) || file
  if (!fs.existsSync(file)) {
    return chalk.red('Error: ') + `File ${file} does not exist.`
  }

  fs.unlinkSync(file)
  return null
}

async function doClone(plan: Plan, indexer: Indexer, file: string) {
  const dest = plan.clone![file]
  file = fuzzyMatchingFile(file, indexer.files) || file

  if (!fs.existsSync(file)) {
    return chalk.red('Error: ') + `File ${file} does not exist.`
  }

  const dir = dirname(dest.dest)
  fs.mkdirSync(dir, { recursive: true })

  return await doChange(plan, indexer, file, dest.edits, dest.dest)
}

export async function doChange(
  plan: Plan,
  indexer: Indexer,
  inputFile: string,
  changes: string,
  outputFile?: string
) {
  inputFile = fuzzyMatchingFile(inputFile, indexer.files) || inputFile
  if (!fs.existsSync(inputFile)) return chalk.red('Error: ') + `File ${inputFile} does not exist.`
  const fileContents = fs.readFileSync(inputFile, 'utf8')
  if (!outputFile) outputFile = inputFile

  const similar = await indexer.vectorDB.searchWithScores(plan.request + '\n' + changes, 4)
  const notInFile = similar
    ?.filter((s) => {
      const [doc, score] = s
      if (score < 0.15) return false
      if (doc.metadata.path.includes(inputFile)) return false
      return true
    })
    .slice(0, 2)

  const fileLines = fileContents.split('\n')
  const outputFormat = fileLines.length < 200 ? 'full' : 'diff'

  const decoratedLines =
    outputFormat == 'full' ? fileLines : fileLines.map((l, i) => `${i + 1}: ${l}`)

  const prompt = `
Possibly related code:
${notInFile.map((s) => s[0].pageContent).join('\n\n')}

---
${outputFile} contents:

${decoratedLines.join('\n')}

---
Overall goal: ${plan.request}

Apply the following changes to the ${outputFile}: ${changes}`

  const model = config.gpt4 == 'never' ? '3.5' : '4'

  const systemMessage = outputFormat == 'full' ? FULL_FORMAT : DIFF_FORMAT

  const tempInput = '/tmp/' + basename(outputFile) + '.prompt'
  fs.writeFileSync(tempInput, systemMessage + '\n\n' + prompt)

  const result = await chatCompletion(prompt, model, systemMessage)

  if (outputFormat == 'full') {
    fs.writeFileSync(outputFile, result)
  } else {
    const tempOutput = '/tmp/' + basename(outputFile) + '.patch'
    fs.writeFileSync(tempOutput, 'changing ' + outputFile + '\n\n' + result)

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
      if (inputFile != outputFile) fs.writeFileSync(outputFile, fileContents)
      return (
        chalk.red('Error: ') +
        `Unable to apply patch to ${outputFile}. The AI is not very good at ` +
        `producing diffs, so you can try to apply it yourself: ${tempOutput}.`
      )
    }
  }

  return null
}

const DIFF_FORMAT = `Output only in patch format with no commentary and no changes to other files - your output will be sent to patch tool. e.g:
@@ -20,7 +20,6 @@
 context2
 context3
-  line to be deleted
+  line to be added
  context4
@@ -88,6 +87,11 @@`

const FULL_FORMAT = `Output the entire file with no commentary and no changes to other files - your output will be written directly to disk.`
