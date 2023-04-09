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

  const prompt = `Files:
${fileListing}

Based on the file/folder names, guess the purpose of each folder. For example, if you see a folder 
called "components", you might guess that it contains React components. Return in this format:

src/api: api utilities
src/components: react components`

  verboseLog(prompt)

  const promise = chatCompletion(
    prompt,
    '3.5',
    'Respond in the requested format with no extra comments'
  )
  log(
    `Just like any new member of your team, I’ll need some onboarding. I'm scanning your folders. When I'm done, please:

- correct anything that looks wrong
- add explanation to important files I’ll probably need
- put ! in front of any folders/files i should not read when generating code (e.g. tests, generated files, build scripts, etc)
- put * in front of the files that are most commonly accessed in the project (e.g. api or db access)`
  )

  const folderGuesses = await oraPromise(promise, { text: 'Scanning and summarizing...' })
  const folderGuessMap: { [key: string]: string } = {}
  folderGuesses.split('\n').forEach((line) => {
    let [folder, purpose] = line.split(':', 2).map((s) => s.trim())
    if (purpose.startsWith('(')) purpose = purpose.slice(1, -1)
    if (folder && purpose) folderGuessMap[folder] = purpose
  })

  const decoratedFiles: string[] = []

  dirTree.forEach((line) => {
    const isFile = line.startsWith('- ')
    const file = isFile ? line.slice(2) : line

    const existing = existingInfos[file]
    const prefix = (isFile ? '- ' : '') + (existing?.exclude ? '!' : existing?.key ? '*' : '')
    const guess = folderGuessMap[file]
    if (guess) delete folderGuessMap[file]

    decoratedFiles.push(`${prefix}${file}: ${existing?.description || guess || ''}`)
  })

  Object.keys(folderGuessMap).forEach((folder) => {
    decoratedFiles.push(`${folder}: ${folderGuessMap[folder]}`)
  })

  writeFileInfos(decoratedFiles.join('\n'), root)
  const fileName = getInfoFileName(root)

  await open(fileName)

  const { newDocs } = await fileLoadPromise
  indexer.index(newDocs)

  // Wait for user to press enter
  inquirer.prompt([
    {
      type: 'input',
      name: 'done',
      message: "Press enter when done editing. While you do that, I'm indexing all files.",
    },
  ])

  cache.close()
}
