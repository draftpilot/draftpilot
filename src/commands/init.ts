import { chatCompletion } from '@/ai/chat'
import { Indexer } from '@/db/indexer'
import { log, verboseLog } from '@/utils/logger'
import { oraPromise } from 'ora'
import open from 'open'
import { findRoot } from '@/utils/utils'
import { cache } from '@/db/cache'
import path from 'path'
import { filesToDirectoryTree, getManifestName, updateFileManifest } from '@/context/manifest'
import inquirer from 'inquirer'
import config from '@/config'
import { updateGitIgnores } from '@/git'

type Options = {
  glob?: string
}

const GIT_IGNORE_FILES = ['cache.json', 'history.json', 'docs.sqlite']

export default async function (options?: Options) {
  const indexer = new Indexer()

  await doInitialize(indexer, options)
}

export async function doInitialize(indexer: Indexer, options?: Options) {
  const files = await indexer.getFiles(options?.glob)
  files.sort((a, b) => a.localeCompare(b))

  const dirTree = filesToDirectoryTree(files)
  const fileListing = dirTree.join('\n')

  const fileLoadPromise = indexer.load(files)

  const prompt = `${fileListing}

Return only the folders, guessing the purpose of each folder with : in front. For example, if you 
see a folder called "components", you might guess that it contains React components. Example:

src: source folder
src/components: React components
src/jobs: background jobs
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
  verboseLog(guessedFiles)

  const root = findRoot()
  updateFileManifest(guessedFiles, dirTree, root)
  const fileName = getManifestName(root)

  await open(fileName)

  const { updatedDocs } = await fileLoadPromise
  indexer.index(updatedDocs)

  // Wait for user to press enter
  await inquirer.prompt([
    {
      type: 'input',
      name: 'done',
      message:
        "Save the file and press enter when done. While you do that, I'm indexing all files.",
    },
  ])

  cache.close()

  const gitIgnore = GIT_IGNORE_FILES.map((f) => path.join(config.configFolder, f))
  updateGitIgnores(gitIgnore)
}
