import { HNSWLib } from 'langchain/vectorstores'
import { OpenAIEmbeddings } from 'langchain/embeddings'
import { FunctionDoc } from '@/types'
import type { Document } from 'langchain/dist/document'
import { log } from '@/logger'

export class VectorDB {
  db?: HNSWLib
  embeddings = new OpenAIEmbeddings({
    verbose: true,
    stripNewLines: true,
  })

  loadEmbeddings = async (docs: FunctionDoc[]) => {
    const texts = docs.map((d) => d.contents)
    const vectors = await this.embeddings.embedDocuments(texts)
    docs.forEach((d, i) => (d.vectors = vectors[i]))
  }

  init = async (funcDocs: FunctionDoc[]) => {
    const existingVectors: number[][] = [],
      existingDocs: Document[] = []

    funcDocs.forEach((f) => {
      const doc = { pageContent: f.contents, metadata: { path: f.path } }
      if (f.vectors) {
        existingVectors.push(f.vectors)
        existingDocs.push(doc)
      }
    })

    this.db = await HNSWLib.fromDocuments([], this.embeddings)
    await this.db.addVectors(existingVectors, existingDocs)
  }

  search = async (query: string) => {
    const result = await this.db?.similaritySearchWithScore(query)
    return result
  }

  topResults = async (query: string, limit = 3) => {
    const result = await this.search(query)
    if (!result) return []
    result.sort((a, b) => b[1] - a[1])

    return result.map((r) => r[0]).slice(0, limit) as Document[]
  }
}
