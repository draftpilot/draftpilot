import { chatWithHistory } from '@/ai/chat'
import { cache } from '@/db/cache'
import { ChatMessage } from '@/types'
import inquirer from 'inquirer'
import { oraPromise } from 'ora'

export default async function play() {
  const chatHistory: ChatMessage[] = []

  while (true) {
    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'prompt',
        message: 'Prompt (Enter to exit):',
      },
    ])

    const prompt = response.prompt
    if (!prompt) {
      cache.close()
      return
    }

    chatHistory.push({ role: 'user', content: prompt })
    const promise = chatWithHistory(chatHistory, '3.5')

    const result = await oraPromise(promise, 'Thinking...')
    chatHistory.push({ role: 'assistant', content: result })

    console.log(response)
  }
}
