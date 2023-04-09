import { Indexer } from '@/db/indexer'
import { log } from '@/logger'

type Options = {
  reindex: boolean
}

export default async function (options: Options) {
  const indexer = new Indexer()
  const files = await indexer.getFiles()
  const { docs, newDocs, existing } = await indexer.load(files)

  log(
    options.reindex
      ? 're-indexing your project'
      : existing
      ? 'updating existing index'
      : 'generating index for the first time...'
  )

  const toIndex = options.reindex ? docs : newDocs
  await indexer.index(toIndex)

  log('done! processed', docs.length, 'functions, with', toIndex.length, 'changes')
}
