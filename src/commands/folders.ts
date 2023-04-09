import { chatCompletion } from '@/ai/chat'
import { Indexer } from '@/db/indexer'
import { getFolderFileName, writeFolderFile } from '@/knowledge/folders'
import { log, verboseLog } from '@/logger'
import { oraPromise } from 'ora'
import open from 'open'
import { findGitRoot } from '@/utils'
import { cache } from '@/db/cache'

type Options = {
  glob?: string
}

export default async function (query: string, options: Options) {
  const indexer = new Indexer()

  const files = await indexer.getFiles(options.glob)
  files.sort((a, b) => a.localeCompare(b))

  const dirTree = filesToDirectoryTree(files)

  const prompt = `Files:
${dirTree.join('\n')}

Based on the file/folder names, guess the purpose of each folder. For example, if you see a folder 
called "components", you might guess that it contains React components. Return in this format:

folder1: purpose1
folder2: purpose2`

  verboseLog(prompt)

  const promise = chatCompletion(
    prompt,
    '3.5',
    'Respond in the requested format with no extra comments'
  )
  log(
    `Just like any new member of your team, I’ll need some onboarding. I'm coming up with some ` +
      `guesses for the purpose of each folder. Once I'm done, please look over the list and correct ` +
      `anything I got wrong.`
  )

  const result = await oraPromise(promise, { text: 'Thinking...' })

  const root = findGitRoot()
  writeFolderFile(result, root)
  const fileName = getFolderFileName(root)

  await open(fileName)

  log('Press enter when done editing')
  await new Promise((resolve) => process.stdin.once('data', resolve))

  cache.close()
}

interface DirectoryNode {
  [key: string]: DirectoryNode | true
}

function addFileToDirectory(directory: string, fileTree: DirectoryNode) {
  const [firstDir, ...restDirs] = directory.split('/')
  if (!fileTree[firstDir]) {
    fileTree[firstDir] = restDirs.length ? {} : true
  }
  if (restDirs.length) {
    addFileToDirectory(restDirs.join('/'), fileTree[firstDir] as DirectoryNode)
  }
}

function getDirectoryPaths(fileTree: DirectoryNode, prefix: string): string[] {
  const paths: string[] = []
  for (const directory in fileTree) {
    if (fileTree[directory] === true) {
      paths.push(`- ${directory}`)
    } else {
      const subPaths = getDirectoryPaths(
        fileTree[directory] as DirectoryNode,
        `${prefix}/${directory}`
      )
      paths.push(`${prefix}/${directory}`, ...subPaths)
    }
  }
  return paths
}

function filesToDirectoryTree(files: string[]) {
  const fileTree: DirectoryNode = {}
  for (const file of files) {
    addFileToDirectory(file, fileTree)
  }

  const paths = ['/'].concat(getDirectoryPaths(fileTree, ''))
  return paths
}
