import { Agent } from '@/ai/agent'
import { filesToDirectoryTree } from '@/context/manifest'
import { Indexer } from '@/db/indexer'
import { generateCodeTools } from '@/tools/code'
import { generateEditingTools } from '@/tools/editing'
import { systemTools } from '@/tools/system'
import { unixTools } from '@/tools/unix'
import { log } from '@/utils/logger'
import inquirer from 'inquirer'

export default async function () {
  console.log('tool tester')

  const indexer = new Indexer()
  await indexer.loadFilesIntoVectors()

  const tools = [
    ...unixTools,
    ...systemTools,
    ...generateCodeTools(indexer),
    ...generateEditingTools(indexer),
  ]

  const agent = new Agent(tools, '')

  log('Available tools:', agent.toolDescriptions)

  while (true) {
    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'tool',
        message: 'Input action (e.g. grep: foo)',
      },
    ])
    const action = response.tool
    const tools = agent.parseActions(action)
    if (!tools) {
      log('Invalid action')
      continue
    }
    const state = { thought: 'Tools test', action, parsedAction: tools, observation: '' }
    await agent.runTools(state)
    log(state.observation)
  }
}
