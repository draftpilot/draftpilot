import fs from 'fs'
import { encode } from 'gpt-3-encoder'

import { Tool } from '@/agent/tool'
import { indexer } from '@/db/indexer'
import { ExtractorService } from '@/parsing/extractorService'
import { fuzzyMatchingFile } from '@/utils/utils'

const showFiles: Tool = {
  name: 'showFiles',
  description:
    'Shows the entire contents of the file. e.g. { name: "showFiles", input: "comma separated files" }',

  run: async (input: string, overallGoal: string) => {
    const files = input.split(',')
    const output = await Promise.all(
      files.map(async (file) => {
        file = file.trim()
        const matchedFile = fuzzyMatchingFile(file, indexer.files)
        if (!matchedFile) {
          return file + ': File not found'
          return
        }

        const contents = fs.readFileSync(matchedFile, 'utf8')
        if (encode(contents).length > 1000) {
          const vectorDb = await indexer.createPartialIndex([file])
          const funcs = await vectorDb.search(overallGoal)

          return (
            matchedFile +
            '\n' +
            'File too large, only displaying relevant functions\n\n' +
            funcs?.map((f) => f.pageContent).join('\n---\n')
          )
        }
        return matchedFile + '\n' + contents
      })
    )
    return output.join('\n\n')
  },
}

const searchCodeTool: Tool = {
  name: 'searchCode',
  description:
    'Search for code snippets simliar to the input. e.g. { name: "searchCode", input: "comma-separated queries" }',

  run: async (input: string) => {
    const queries = input.split(',')
    const output = await Promise.all(
      queries.map(async (query) => {
        const results = await indexer.vectorAndCodeSearch(query.trim(), 4)
        return results?.map((r) => r.pageContent).join('\n') || ''
      })
    )
    return output.join('\n\n')
  },
}

export const codeTools = [showFiles, searchCodeTool]
