import { Tool } from '@/agent/tool'
import inquirer from 'inquirer'

const askUserTool: Tool = {
  name: 'askUser',
  description: 'Ask the user to provide text input. Input: prompt',
  serial: true,
  run: async (input: string | string[]) => {
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
const tellUserTool: Tool = {
  name: 'tellUser',
  description: 'Tell the user to do something. Input: prompt',
  serial: true,
  run: async (input: string | string[]) => {
    const response = await inquirer.prompt([
      {
        type: 'list',
        choices: ['Press enter to continue'],
        name: 'input',
        message: input,
      },
    ])
    return response.input
  },
}

export const systemTools = [askUserTool, tellUserTool]
