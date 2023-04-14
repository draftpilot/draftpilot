import config from '@/config'
import { cache } from '@/db/cache'
import { ChatMessage } from '@/types/types'
import { isAxiosError } from 'axios'
import { Configuration, OpenAIApi } from 'openai'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})

const openai = new OpenAIApi(configuration)

export async function chatCompletion(
  prompt: string,
  model: '3.5' | '4',
  systemMessage?: string,
  stop?: string | string[]
) {
  const existing = await cache.get(prompt)
  if (existing) return existing

  try {
    const completion = await openai.createChatCompletion({
      model: model == '3.5' ? 'gpt-3.5-turbo' : 'gpt-4',
      temperature: config.temperature,
      stop: stop,
      messages: systemMessage
        ? [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt },
          ]
        : [{ role: 'user', content: prompt }],
    })
    const response = completion.data.choices[0].message
    const responseContent = response?.content || ''

    cache.set(prompt, responseContent)
    return responseContent
  } catch (e) {
    throw parseError(e)
  }
}

export async function chatWithHistory(messages: ChatMessage[], model: '3.5' | '4') {
  try {
    const completion = await openai.createChatCompletion({
      model: model == '3.5' ? 'gpt-3.5-turbo' : 'gpt-4',
      messages,
    })
    const response = completion.data.choices[0].message
    const responseContent = response?.content || ''

    return responseContent
  } catch (e) {
    throw parseError(e)
  }
}

function parseError(e: any) {
  if (isAxiosError(e)) {
    const data = e.response?.data
    if (data) {
      const error = data.error
      const dataResponse = JSON.stringify(error || data)
      return new Error(dataResponse)
    }
  }
  return e
}
