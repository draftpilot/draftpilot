import { Indexer } from '@/db/indexer'
import { log } from '@/utils/logger'
import { pluralize } from '@/utils/utils'
import chalk from 'chalk'

type Options = {
  k?: string
  reindex: boolean
}

export default async function (query: string, options: Options) {
  const indexer = new Indexer()

  await indexer.loadFilesIntoVectors()

  const similar = await indexer.vectorDB.searchWithScores(
    query,
    options.k ? parseInt(options.k) : undefined
  )
  log('results:', similar)
}
