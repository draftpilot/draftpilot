import { Tool } from '@/agent/tool'
import { indexer } from '@/db/indexer'
import { ExtractorService } from '@/parsing/extractorService'
import { fuzzyMatchingFile } from '@/utils/utils'
import fs from 'fs'
import { encode } from 'gpt-3-encoder'

export const generateCodeTools = (): Tool[] => {
  const viewFileTool: Tool = {
    name: 'viewFile',
    description: 'Shows the entire contents of the file. Input: file',

    run: async (input: string, overallGoal: string) => {
      const file = fuzzyMatchingFile(input, indexer.files)
      if (!file) return 'File not found'

      const contents = fs.readFileSync(file, 'utf8')

      if (encode(contents).length > 3000) {
        const vectorDb = await indexer.createPartialIndex([file])
        const funcs = await vectorDb.search(overallGoal)

        return (
          'File too large, only displaying relevant functions\n\n' +
          funcs?.map((f) => f.pageContent).join('\n---\n')
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
      const results = await indexer.vectorAndCodeSearch(input, 4)
      return results?.map((r) => r.pageContent).join('\n') || ''
    },
  }

  const tools = [viewFileTool, searchCodeTool]

  if (indexer.files.includes('package.json')) {
    const listPackages: Tool = {
      name: 'listNPMPackages',
      description: `List installed npm packages. Optional input: filter query e.g. react`,

      run: async (input: string) => {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
        let deps = Object.keys(packageJson.dependencies || {})
        if (input) {
          deps = deps.filter((d) => d.includes(input))
        }

        if (deps.length == 0) return 'No packages found'
        return deps.join(', ')
      },
    }
    tools.push(listPackages)
  }

  return tools
}
