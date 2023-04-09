import { chatCompletion } from '@/ai/chat'
import { Indexer } from '@/db/indexer'
import { log, verboseLog } from '@/logger'
import { oraPromise } from 'ora'
import open from 'open'
import { findGitRoot } from '@/utils'
import { cache } from '@/db/cache'
import path from 'path'
import {
  filesToDirectoryTree,
  getInfoFileName,
  readFileInfos,
  writeFileInfos,
} from '@/context/filetree'
import inquirer from 'inquirer'
import config from '@/config'

type Options = {
  glob?: string
}

export default async function (query: string, options: Options) {
  const indexer = new Indexer()

  const files = await indexer.getFiles(options.glob)
  files.sort((a, b) => a.localeCompare(b))

  const dirTree = filesToDirectoryTree(files)
  const fileListing = dirTree.join('\n')

  const fileLoadPromise = indexer.load(files)

  const root = findGitRoot()
  const existingInfos = readFileInfos(root) || {}

  const prompt = `${fileListing}

Based on the above files/folders, append ':' + guessed the purpose of each item.
For example, if you see a folder called "components", you might guess that it contains React
components. If uncertain, just leave it blank. Be concise and don't repeat things 
like "for the application" on every line. e.g.

src: source folder
- main.ts: entry point
src/components: React components
`

  verboseLog(prompt)

  const model = config.gpt4 == 'always' ? '4' : '3.5'

  const promise = chatCompletion(
    prompt,
    model,
    'Respond in the requested format with no extra comments'
  )
  log(
    `Just like any new member of your team, I’ll need some onboarding. I'm scanning your folders. When I'm done, please:

- correct anything that looks wrong
- add explanation to important files I’ll probably need
- put ! in front of any folders/files i should not read when generating code (e.g. tests, generated files, build scripts, etc)
- put * in front of the files that are most commonly accessed in the project (e.g. api or db access)`
  )

  const guessedFiles = await oraPromise(promise, { text: 'Scanning and summarizing...' })
  const guessedFileLines = guessedFiles.trim().split('\n')

  if (guessedFileLines.length > 0 && guessedFileLines[0] == 'name,description')
    guessedFileLines.shift()

  const outputLines: string[] = []
  guessedFileLines.forEach((line) => {
    outputLines.push(line)
    //   const isFile = line.startsWith('- ')
    //   const file = isFile ? line.slice(2) : line
    //   const existing = existingInfos[file]
    //   const prefix = (isFile ? '- ' : '') + (existing?.exclude ? '!' : existing?.key ? '*' : '')
    //   const guess = folderGuessMap[file]
    //   if (guess) delete folderGuessMap[file]
    //   decoratedFiles.push(`${prefix}${file}: ${existing?.description || guess || ''}`)
  })

  // Object.keys(folderGuessMap).forEach((folder) => {
  //   decoratedFiles.push(`${folder}: ${folderGuessMap[folder]}`)
  // })

  writeFileInfos(outputLines.join('\n'), root)
  const fileName = getInfoFileName(root)

  await open(fileName)

  const { newDocs } = await fileLoadPromise
  indexer.index(newDocs)

  // Wait for user to press enter
  inquirer.prompt([
    {
      type: 'input',
      name: 'done',
      message:
        "Save the file and press enter when done. While you do that, I'm indexing all files.",
    },
  ])

  cache.close()
}
