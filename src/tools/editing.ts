import { chatCompletion } from '@/ai/api'
import config from '@/config'
import { Indexer } from '@/db/indexer'
import { Tool } from '@/tools/tool'
import { fuzzyMatchingFile, splitOnce } from '@/utils/utils'
import fs from 'fs'
import { basename } from 'path'
import * as Diff from 'diff'
import { oraPromise } from 'ora'
import { git } from '@/utils/git'

export const generateEditingTools = (indexer: Indexer): Tool[] => {
  const editFileTool: Tool = {
    name: 'editFile',
    description:
      'Uses AI to edit the file according to instructions. e.g. editFile path/to/foo.ts rename foo to bar',

    run: async (input: string, overallGoal?: string) => {
      const [file, change] = splitOnce(input, ' ')

      return await doChange(overallGoal || '', indexer, file, change)
    },
  }

  const cloneFileTool: Tool = {
    name: 'cloneFile',
    description:
      'Clones the source file and uses AI to edit it according to instructions. e.g. cloneFile source/file dest/file rename foo to bar',

    run: async (input: string, overallGoal?: string) => {
      const [file, destAndChange] = splitOnce(input, ' ')
      const [dest, change] = splitOnce(destAndChange, ' ')

      return await doChange(overallGoal || '', indexer, file, change, dest)
    },
  }

  const verifyDiffTool: Tool = {
    name: 'verifyDiff',
    description:
      'Prints git diff of file and verifies if it makes the requested change. e.g. verifyDiff path/to/foo.ts rename foo to bar',

    run: async (input: string, overallGoal?: string) => {
      const [file, change] = splitOnce(input, ' ')

      const inputFile = fuzzyMatchingFile(file, indexer.files) || file
      if (!fs.existsSync(inputFile)) return `File ${inputFile} does not exist.`

      const history = git(['diff', '--pretty=format:%H', inputFile])

      const prompt = `Verify that the following diff makes the requested change: ${change}.

${history}`

      const promise = chatCompletion(prompt, '3.5')
      const response = await oraPromise(promise, 'Waiting for AI to respond')

      return response
    },
  }

  return [editFileTool, cloneFileTool, verifyDiffTool]
}

async function doChange(
  overallGoal: string,
  indexer: Indexer,
  inputFile: string,
  changes: string,
  outputFile?: string
) {
  inputFile = fuzzyMatchingFile(inputFile, indexer.files) || inputFile
  if (!fs.existsSync(inputFile)) return `File ${inputFile} does not exist.`
  const fileContents = fs.readFileSync(inputFile, 'utf8')
  if (!outputFile) outputFile = inputFile

  const similar = await indexer.vectorDB.searchWithScores(overallGoal + '\n' + changes, 4)
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
Overall goal: ${overallGoal}

Apply the following changes to the ${outputFile}: ${changes}.

If you are unable to make the changes or need more information, respond HELP: <detailed question or reason>
`

  const model = config.gpt4 == 'never' ? '3.5' : '4'

  const systemMessage = outputFormat == 'full' ? FULL_FORMAT : DIFF_FORMAT

  const tempInput = '/tmp/' + basename(outputFile) + '.prompt'
  fs.writeFileSync(tempInput, systemMessage + '\n\n' + prompt)

  const promise = chatCompletion(prompt, model, systemMessage)
  const text =
    model == '3.5' ? 'Executing...' : 'Executing (GPT-4 is slow so this may take a while)...'
  const result = await oraPromise(promise, { text })

  if (result.startsWith('HELP:')) {
    return 'Unable to edit file, the AI needs: ' + result.substring(5)
  }

  if (outputFormat == 'full') {
    fs.writeFileSync(outputFile, result)
  } else {
    const tempOutput = '/tmp/' + basename(outputFile) + '.patch'
    fs.writeFileSync(tempOutput, 'changing ' + outputFile + '\n\n' + result)

    if (!result.startsWith('@@')) {
      return `AI completion did not return a valid patch file. Please check ${tempOutput} for details.`
    }

    try {
      const output = Diff.applyPatch(fileContents, result.trim(), { fuzzFactor: 30 })
      if (output) fs.writeFileSync(outputFile, output)
      throw 'Unable to apply patch'
    } catch (e: any) {
      if (inputFile != outputFile) fs.writeFileSync(outputFile, fileContents)
      return (
        `Unable to apply patch to ${outputFile}. The AI is not very good at ` +
        `producing diffs, so you can try to apply it yourself: ${tempOutput}.`
      )
    }
  }

  return 'Successfully edited file.'
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
