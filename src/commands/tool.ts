import { Agent } from '@/agent/agent'
import { indexer } from '@/db/indexer'
import { getAllTools } from '@/agent'
import { log } from '@/utils/logger'
import inquirer from 'inquirer'

export default async function (initialCommand: string | undefined) {
  await indexer.loadFilesIntoVectors()

  const tools = getAllTools()

  const agent = new Agent(tools, '', '')

  if (!initialCommand) log('Available tools:', agent.toolNames)

  let command = initialCommand
  if (!initialCommand) {
    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'tool',
        message: 'Input action (e.g. { "tool": "findInsideFiles", "input": "foo" })',
      },
    ])
    command = response.tool
    initialCommand = undefined
  }

  const parsed = agent.parseActions(command!) || undefined
  if (!tools) {
    log('Invalid action')
    return
  }
  const state = { thought: 'Tools test', action: command, parsedAction: parsed, observations: [] }
  await agent.runTools(state, true)
  log(state.observations)
}
