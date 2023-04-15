import { filesToDirectoryTree, updateFileManifest } from '@/context/manifest'
import { indexer } from '@/db/indexer'
import { log } from '@/utils/logger'

type Options = {
  reindex: boolean
}

export default async function (options: Options) {
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