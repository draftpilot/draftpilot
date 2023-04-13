import { Agent } from '@/agent/agent'
import { indexer } from '@/db/indexer'
import { getAllTools } from '@/agent'
import { log } from '@/utils/logger'
import inquirer from 'inquirer'

export default async function (command: string) {
  await indexer.loadFilesIntoVectors()

  const tools = getAllTools()

  const agent = new Agent(tools, '', '')

  if (!command) log('Available tools:', agent.toolDescriptions)

  while (true) {
    const tools = agent.parseActions(command)
    if (!tools) {
      log('Invalid action')
      continue
    }
    const state = { thought: 'Tools test', action: command, parsedAction: tools, observation: '' }
    await agent.runTools(state, true)
    log(state.observation)

    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'tool',
        message: 'Input action (e.g. findInsideFiles: foo)',
      },
    ])
    command = response.tool
  }
}
