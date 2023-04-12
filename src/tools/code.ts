import { Indexer } from '@/db/indexer'
import { Tool } from '@/tools/tool'
import { fuzzyMatchingFile } from '@/utils/utils'
import fs from 'fs'

export const generateCodeTools = (indexer: Indexer): Tool[] => {
  const viewFileTool: Tool = {
    name: 'viewFile',
    description: 'Shows the entire contents of the file. Input: file',

    run: async (input: string) => {
      const file = fuzzyMatchingFile(input, indexer.files)
      if (!file) return 'File not found'

      const contents = fs.readFileSync(file, 'utf8')
      const lines = contents.split('\n')

      if (lines.length > 500) {
        return (
          'File too large, only displaying first 500 lines\n\n' +
          lines.slice(0, 500).join('\n') +
          '\n\n...'
        )
      }

      if (file != input) return 'Actual path: ' + file + '\n' + contents
      return contents
    },
  }

  const searchCodeTool: Tool = {
    name: 'searchCode',
    description: 'Search for code snippets simliar to the input. Input: search query',

    run: async (input: string) => {
      const results = await indexer.vectorDB.search(input, 4)
      return results?.map((r) => r.pageContent).join('\n') || ''
    },
  }

  const searchFunctionsTool: Tool = {
    name: 'searchFunctions',
    description:
      'Search for file/function names with contents similar to the input. Input: search query',

    run: async (input: string) => {
      const results = await indexer.vectorDB.searchWithScores(input, 10)
      return results?.map(([r, score]) => `${r.metadata.path} - score: ${score}`).join('\n') || ''
    },
  }

  return [viewFileTool, searchCodeTool, searchFunctionsTool]
}
