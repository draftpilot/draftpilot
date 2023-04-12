import { Tool } from '@/agent/tool'
import { indexer } from '@/db/indexer'
import { fuzzyMatchingFile } from '@/utils/utils'
import fs from 'fs'

export const generateCodeTools = (): Tool[] => {
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

  const tools = [viewFileTool, searchCodeTool]

  if (indexer.files.includes('package.json')) {
    const isYarn = fs.existsSync('yarn.lock')

    const listPackages: Tool = {
      name: 'listPackages',
      description: `List installed ${
        isYarn ? 'yarn' : 'npm'
      } packages. Optional input: filter query e.g. react`,

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
