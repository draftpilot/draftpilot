import { Indexer } from '@/db/indexer'
import { log } from '@/logger'
import { pluralize } from '@/utils'
import chalk from 'chalk'

type Options = {
  count?: number
  reindex: boolean
}

export default async function (query: string, options: Options) {
  const indexer = new Indexer()
  const { docs, newDocs, existing } = await indexer.load()

  if (!existing) throw new Error('you must index your project first')
  if (newDocs.length) {
    if (options.reindex) await indexer.index(newDocs)
    else
      log(
        chalk.yellow(
          `Found ${pluralize(newDocs.length, 'new function')}, run with --reindex to index them`
        )
      )
  }

  await indexer.loadVectors(docs)

  const similar = await indexer.vectorDB.search(query)
  log('results:', similar)
}
