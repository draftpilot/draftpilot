import { filesToDirectoryTree } from '@/context/manifest'
import { Indexer } from '@/db/indexer'
import { log } from '@/logger'

export default async function () {
  console.log('hello world')

  const indexer = new Indexer()
  const files = await indexer.getFiles()
  const dirTree = filesToDirectoryTree(files)

  log(dirTree)
}
