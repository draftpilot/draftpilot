import { cache } from '@/db/cache'
import { Configuration, OpenAIApi } from 'openai'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})

const openai = new OpenAIApi(configuration)

export async function chatCompletion(prompt: string, model: '3.5' | '4') {
  const existing = await cache.get(prompt)
  if (existing) return existing

  const completion = await openai.createChatCompletion({
    model: model == '3.5' ? 'gpt-3.5-turbo' : 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  })
  const response = completion.data.choices[0].message
  const responseContent = response?.content || ''

  cache.set(prompt, responseContent)
  return responseContent
}
