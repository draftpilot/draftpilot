import { CodeDoc } from '@/types/types'
import FlexSearch, { Index } from 'flexsearch'

export default class SearchDB {
  index: Index<string> = new (FlexSearch as any).Index()

  addDocuments = (docs: CodeDoc[]) => {
    docs.forEach((doc) => this.index.add(doc.path as any, doc.path + '\n' + doc.contents))
  }

  // returns the document name only
  search = (query: string, max?: number) => {
    return this.index.search(query, { limit: max })
  }

  searchDocuments = async (query: string, docs: CodeDoc[], max?: number) => {
    const results = new Set(await this.search(query, max))
    return docs.filter((doc) => results.has(doc.path))
  }
}
