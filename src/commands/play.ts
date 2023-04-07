import inquirer from 'inquirer'
import { Configuration, OpenAIApi } from 'openai'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_KEY,
})

const openai = new OpenAIApi(configuration)

export default async function play() {
  const response = await inquirer.prompt([
    {
      type: 'input',
      name: 'prompt',
      message: 'Prompt:',
    },
  ])
  const prompt = response.prompt
  const completion = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  })
  console.log(completion.data.choices[0].message)
}
