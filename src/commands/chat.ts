import { indexer } from '@/db/indexer'
import { log } from '@/utils/logger'

type Options = {
  k?: string
  reindex: boolean
}

export default async function (query: string, options: Options) {
  await indexer.loadFilesIntoVectors()

  const similar = await indexer.vectorDB.searchWithScores(
    query,
    options.k ? parseInt(options.k) : undefined
  )
  log('vector results:', similar)

  const wordSearch = await indexer.searchDB.search(query)
  log('word results:', wordSearch)
}
