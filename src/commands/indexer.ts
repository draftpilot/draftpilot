import { Indexer } from '@/db/indexer'
import { log } from '@/logger'

type Options = {}

export default async function (options: Options) {
  const indexer = new Indexer()
  const files = await indexer.getFiles()
  const { docs, newDocs, existing } = await indexer.load(files)

  log(existing ? 're-indexing your project' : 'generating index for the first time...')

  await indexer.index(newDocs)

  log('done! processed', docs.length, 'functions, with', newDocs.length, 'changes')
}
