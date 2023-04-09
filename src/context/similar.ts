import { Indexer } from '@/db/indexer'

export async function getSimilarMethods(indexer: Indexer, prompt: string, count: number) {
  const similar = await indexer.vectorDB.search(prompt, count)
  if (!similar) return null

  return similar.map((s) => s.pageContent).join('```\n\n')
}
