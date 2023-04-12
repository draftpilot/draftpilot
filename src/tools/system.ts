import { Tool } from '@/tools/tool'
import inquirer from 'inquirer'

const askUserTool: Tool = {
  name: 'askUser',
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
const tellUserTool: Tool = {
  name: 'tellUser',
  description: 'Tell the user to do something. Input: prompt',
  run: async (input: string) => {
    const response = await inquirer.prompt([
      {
        type: 'list',
        choices: ['Continue'],
        name: 'input',
        message: input,
      },
    ])
    return response.input
  },
}

export const systemTools = [askUserTool, tellUserTool]
