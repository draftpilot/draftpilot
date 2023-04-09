import { Indexer } from '@/db/indexer'
import { log } from '@/logger'
import { pluralize } from '@/utils'
import chalk from 'chalk'

type Options = {
  k?: string
  reindex: boolean
}

export default async function (query: string, options: Options) {
  const indexer = new Indexer()
  const { docs, newDocs, existing } = await indexer.load()

  if (!existing) await indexer.index(newDocs)
  else if (newDocs.length) {
    if (options.reindex) await indexer.index(newDocs)
    else
      log(
        chalk.yellow(
          `Found ${pluralize(newDocs.length, 'new function')}, run with --reindex to index them`
        )
      )
  }

  await indexer.loadVectors(docs)

  const similar = await indexer.vectorDB.searchWithScores(
    query,
    options.k ? parseInt(options.k) : undefined
  )
  log('results:', similar)
}
