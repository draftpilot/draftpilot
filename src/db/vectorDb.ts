import { HNSWLib } from 'langchain/vectorstores'
import { OpenAIEmbeddings } from 'langchain/embeddings'
import { CodeDoc } from '@/types'
import type { Document } from 'langchain/dist/document'

export class VectorDB {
  db?: HNSWLib
  embeddings = new OpenAIEmbeddings({
    verbose: true,
    stripNewLines: true,
  })

  loadEmbeddings = async (docs: CodeDoc[]) => {
    const texts = docs.map((d) => d.contents)
    const vectors = await this.embeddings.embedDocuments(texts)
    docs.forEach((d, i) => (d.vectors = vectors[i]))
  }

  init = async (funcDocs: CodeDoc[]) => {
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

  search = async (query: string, k?: number) => {
    const result = await this.db?.similaritySearch(query, k)
    return result
  }

  searchWithScores = async (query: string, k?: number) => {
    const result = await this.db?.similaritySearchWithScore(query, k)
    return result
  }
}
