import { HNSWLib } from '@/langchain/hnswlib'
import { OpenAIEmbeddings } from '@/langchain/openai_embeddings'
import { CodeDoc } from '@/types'

import type { Document } from '@/langchain/document'

export class VectorDB {
  db?: HNSWLib

  embeddings: OpenAIEmbeddings

  constructor(verbose: boolean = false, batchSize: number = 512, timeout: number = 5000) {
    this.embeddings = new OpenAIEmbeddings({
      stripNewLines: true,
      verbose,
      batchSize,
      timeout,
    })
  }

  loadEmbeddings = async (docs: CodeDoc[]) => {
    const texts = docs.map((d) => d.contents).filter(t => t.length < 10_000)
    const vectors = await this.embeddings.embedDocuments(texts)
    docs.forEach((d, i) => {
      if (vectors[i]) d.vectors = vectors[i]
    })
  }

  init = async (funcDocs: CodeDoc[]) => {
    const existingVectors: number[][] = [],
      existingDocs: Document[] = []

    funcDocs.forEach((f) => {
      const contents = f.path + ':\n' + f.contents
      const doc = { pageContent: contents, metadata: { path: f.path } }
      if (f.vectors) {
        existingVectors.push(f.vectors)
        existingDocs.push(doc)
      }
    })

    this.db = await HNSWLib.fromDocuments([], this.embeddings)
    await this.db.addVectors(existingVectors, existingDocs)
  }

  search = async (query: string, k?: number) => {
    const result = await this.db?.similaritySearch(query, k)
    return result
  }

  searchWithScores = async (query: string, k?: number) => {
    const result = await this.db?.similaritySearchWithScore(query, k)
    return result as [Document, number][]
  }
}
