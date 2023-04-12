import { chatCompletion } from '@/ai/api'
import { cache } from '@/db/cache'
import { Indexer, indexer } from '@/db/indexer'
import { log, verboseLog } from '@/utils/logger'
import { fuzzyMatchingFile, readConfig } from '@/utils/utils'
import chalk from 'chalk'
import { oraPromise } from 'ora'
import fs from 'fs'
import { Plan } from '@/types'
import config from '@/config'
import * as Diff from 'diff'
import { dirname, basename } from 'path'
import { VectorDB } from '@/db/vectorDb'
import { encode } from 'gpt-3-encoder'

export class Executor {
  referencesIndex: Indexer | undefined

  executePlan = async (plan: Plan): Promise<boolean> => {
    const promises: Promise<string | null>[] = []

    if (plan.reference) {
      this.loadReferences(plan.reference)
    }

    if (plan.change) {
      Object.keys(plan.change).forEach((file) =>
        promises.push(this.doChange(plan, file, plan.change![file]))
      )
    }

    if (plan.create) {
      Object.keys(plan.create).forEach((file) =>
        promises.push(this.createFile(plan, file, plan.create![file]))
      )
    }

    if (plan.delete) {
      plan.delete.forEach((file) => promises.push(this.deleteFile(file)))
    }

    if (plan.clone) {
      Object.keys(plan.clone).forEach((file) => promises.push(this.doClone(plan, file)))
    }

    if (plan.rename) {
      // todo
    }

    if (plan.shellCommands) {
      // todo
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

  loadReferences = async (references: string[]) => {
    if (references.length == 0) return

    this.referencesIndex = new Indexer()
    const { docs } = await this.referencesIndex.load(references, true)
    this.referencesIndex.loadVectors(docs)
  }

  createFile = async (plan: Plan, file: string, changes: string) => {
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

  deleteFile = async (file: string) => {
    file = fuzzyMatchingFile(file, indexer.files) || file
    if (!fs.existsSync(file)) {
      return chalk.red('Error: ') + `File ${file} does not exist.`
    }

    fs.unlinkSync(file)
    return null
  }

  doClone = async (plan: Plan, file: string) => {
    const dest = plan.clone![file]
    file = fuzzyMatchingFile(file, indexer.files) || file

    if (!fs.existsSync(file)) {
      return chalk.red('Error: ') + `File ${file} does not exist.`
    }

    const dir = dirname(dest.dest)
    fs.mkdirSync(dir, { recursive: true })

    return await this.doChange(plan, file, dest.edits, dest.dest)
  }

  doChange = async (plan: Plan, inputFile: string, changes: string, outputFile?: string) => {
    inputFile = fuzzyMatchingFile(inputFile, indexer.files) || inputFile
    if (!fs.existsSync(inputFile)) return chalk.red('Error: ') + `File ${inputFile} does not exist.`
    const fileContents = fs.readFileSync(inputFile, 'utf8')
    if (!outputFile) outputFile = inputFile

    const fromReferences =
      this.referencesIndex && (await this.referencesIndex.vectorDB.search(changes, 4))
    const referenceSet = new Set(fromReferences?.map((s) => s.metadata.path))
    const similar = await indexer.vectorDB.searchWithScores(plan.request + '\n' + changes, 6)
    const similarFuncs = similar
      ?.filter((s) => {
        const [doc, score] = s
        if (score < 0.15) return false
        if (doc.metadata.path.includes(inputFile)) return false
        if (referenceSet.has(doc.metadata.path)) return false
        return true
      })
      .map((s) => s[0])

    const fileLines = fileContents.split('\n')
    const outputFormat = fileLines.length < 200 ? 'full' : 'diff'

    const decoratedLines =
      outputFormat == 'full' ? fileLines : fileLines.map((l, i) => `${i + 1}: ${l}`)

    let tokenBudget = 5000 - encode(outputFile).length
    const funcsToShow = (similarFuncs || []).concat(fromReferences || []).filter((doc) => {
      const encoded = encode(doc.pageContent).length
      if (tokenBudget > encoded) {
        tokenBudget -= encoded
        return true
      }
      return false
    })
    const decoratedFuncs = funcsToShow.length
      ? 'Possibly related code:\n' + funcsToShow.map((s) => s.pageContent).join('\n---\n')
      : ''

    const prompt = `${decoratedFuncs} 
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
