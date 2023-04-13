import { Agent } from '@/agent/agent'
import { indexer } from '@/db/indexer'
import { getAllTools } from '@/agent'
import { log } from '@/utils/logger'
import inquirer from 'inquirer'

export default async function () {
  console.log('tool tester')

  await indexer.loadFilesIntoVectors()

  const tools = getAllTools()

  const agent = new Agent(tools, '', '')

  log('Available tools:', agent.toolDescriptions)

  while (true) {
    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'tool',
        message: 'Input action (e.g. findInsideFiles: foo)',
      },
    ])
    const action = response.tool
    const tools = agent.parseActions(action)
    if (!tools) {
      log('Invalid action')
      continue
    }
    const state = { thought: 'Tools test', action, parsedAction: tools, observation: '' }
    await agent.runTools(state, true)
    log(state.observation)
  }
}
