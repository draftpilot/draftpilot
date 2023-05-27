import { filesToDirectoryTree, updateFileManifest } from '@/context/manifest'
import { Indexer, indexer } from '@/db/indexer'
import { log } from '@/utils/logger'

type Options = {
  batchSize: number
  reindex: boolean
  timeout: number
}

export default async function (options: Options) {
  const batchSize = options?.batchSize || 256
  const timeout = options?.timeout || 5000

  const indexer = new Indexer(true, batchSize, timeout)

  const files = await indexer.getFiles()
  const { docs, updatedDocs, existing } = await indexer.load(files)

  log(
    options.reindex
      ? 're-indexing your project'
      : existing
      ? 'updating existing index'
      : 'generating index for the first time...'
  )

  const toIndex = options.reindex ? docs : updatedDocs
  await indexer.index(toIndex)

  const dirTree = filesToDirectoryTree(files)
  updateFileManifest('', dirTree)

  log(
    'Done! processed',
    files.length,
    'files,',
    docs.length,
    'functions, with',
    toIndex.length,
    'changes'
  )
}
