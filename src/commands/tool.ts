import inquirer from 'inquirer'

import { getAllTools } from '@/agent'
import { indexer } from '@/db/indexer'
import { log } from '@/utils/logger'
import { fuzzyParseJSON } from '@/utils/utils'

export default async function (initialCommand: string | undefined) {
  await indexer.loadFilesIntoVectors()

  const tools = getAllTools()

  if (!initialCommand) log('Available tools:', tools.map((t) => t.name).join(', '))

  let command = initialCommand
  if (!initialCommand) {
    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'tool',
        message: 'Input action (e.g. { "name": "findInsideFiles", "input": "foo" })',
      },
    ])
    command = response.tool
    initialCommand = undefined
  }

  const parsed = fuzzyParseJSON(command!)
  if (!parsed) throw new Error('Invalid JSON')

  const tool = tools.find((t) => t.name == parsed.name)
  if (!tool) throw new Error('Tool not found')

  const response = await tool.run(parsed.input, 'tool test')
  log(response)
}
