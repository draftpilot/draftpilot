import { Indexer } from '@/db/indexer'
import { log } from '@/logger'

type Options = {}

export default async function (options: Options) {
  const indexer = new Indexer()
  const { docs, newDocs, existing } = await indexer.load()

  log(existing ? 're-indexing your project' : 'generating index for the first time...')

  await indexer.index(newDocs)

  log('done! processed', docs.length, 'functions, with', newDocs.length, 'changes')
}
