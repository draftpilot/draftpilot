import { HNSWLib } from 'langchain/vectorstores'
import { OpenAIEmbeddings } from 'langchain/embeddings'
import { FunctionDoc } from '@/types'
import type { Document } from 'langchain/dist/document'
import { log } from '@/logger'

export class VectorDB {
  db?: HNSWLib
  embeddings = new OpenAIEmbeddings()

  loadEmbeddings = async (docs: FunctionDoc[]) => {
    const texts = docs.map((d) => d.contents)
    const vectors = await this.embeddings.embedDocuments(texts)
    docs.forEach((d, i) => (d.vectors = vectors[i]))
  }

  init = async (funcDocs: FunctionDoc[], saveVectors: (newDocs: FunctionDoc[]) => void) => {
    const existingVectors: number[][] = [],
      existingDocs: Document[] = []

    const newDocs: FunctionDoc[] = funcDocs.filter((f) => !f.vectors)
    log('loading embeddings for', newDocs.length, 'new docs')
    await this.loadEmbeddings(newDocs)
    saveVectors(newDocs)

    funcDocs.forEach((f) => {
      const doc = { pageContent: f.contents, metadata: { path: f.path } }
      if (f.vectors) {
        existingVectors.push(f.vectors)
        existingDocs.push(doc)
      }
    })

    this.db = await HNSWLib.fromDocuments([], this.embeddings)
    this.db.addVectors(existingVectors, existingDocs)
  }

  search = async (query: string, limit = 10) => {
    const result = await this.db?.similaritySearch(query, limit)
    return result
  }
}
