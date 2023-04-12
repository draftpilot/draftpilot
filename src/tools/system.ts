import { Tool } from '@/tools/tool'
import inquirer from 'inquirer'

const askTool: Tool = {
  name: 'ask',
  description: 'Ask the user to provide text input. Input: prompt',
  run: async (input: string) => {
    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message: input,
      },
    ])
    return response.input
  },
}

export const systemTools = [askTool]
