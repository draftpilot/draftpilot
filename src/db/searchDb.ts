import { CodeDoc } from '@/types'
import FlexSearch, { Index } from 'flexsearch'

export default class SearchDB {
  index: Index<string> = new (FlexSearch as any).Index()

  addDocuments = (docs: CodeDoc[]) => {
    docs.forEach((doc) => this.index.add(doc.path as any, doc.path + '\n' + doc.contents))
  }

  // returns the document name
  search = (query: string, max?: number) => {
    return this.index.search(query, { limit: max })
  }
}
