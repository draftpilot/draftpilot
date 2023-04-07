import { chatCompletion } from '@/ai/chat'
import inquirer from 'inquirer'

export default async function play() {
  const response = await inquirer.prompt([
    {
      type: 'input',
      name: 'prompt',
      message: 'Prompt:',
    },
  ])
  const prompt = response.prompt

  const completion = await chatCompletion(prompt, '3.5')

  console.log(completion)
}
