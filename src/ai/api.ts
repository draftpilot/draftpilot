import config from '@/config'
import { cache } from '@/db/cache'
import { ChatMessage, Model } from '@/types'
import { isAxiosError } from 'axios'
import { Configuration, OpenAIApi } from 'openai'
import fs from 'fs'
import { log } from '@/utils/logger'
import { IncomingMessage } from 'http'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})

const openai = new OpenAIApi(configuration)

export async function chatCompletion(
  prompt: string,
  model: Model,
  systemMessage?: string,
  stop?: string | string[]
) {
  const existing = await cache.get(prompt)
  if (existing) return existing

  const messages: ChatMessage[] = systemMessage
    ? [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt },
      ]
    : [{ role: 'user', content: prompt }]

  const responseContent = await chatWithHistory(messages, model, stop)
  cache.set(prompt, responseContent)
  return responseContent
}

export async function chatWithHistory(
  messages: ChatMessage[],
  model: Model,
  stop?: string | string[]
) {
  try {
    const tempInput = writeTempFile(messages)

    const completion = await openai.createChatCompletion({
      model: model == '3.5' ? 'gpt-3.5-turbo' : 'gpt-4',
      messages,
      temperature: config.temperature,
      stop: stop,
    })
    const response = completion.data.choices[0].message
    const output = response?.content || ''

    writeTempFile(
      {
        output,
        messages,
      },
      tempInput
    )

    return output
  } catch (e) {
    throw parseError(e)
  }
}

export async function streamChatWithHistory(
  messages: ChatMessage[],
  model: Model,
  onChunk: (chunk: string) => void,
  stop?: string | string[]
) {
  try {
    const tempInput = writeTempFile(messages)

    const response = await openai.createChatCompletion(
      {
        model: model == '3.5' ? 'gpt-3.5-turbo' : 'gpt-4',
        messages,
        temperature: config.temperature,
        stop: stop,
        stream: true,
      },
      { responseType: 'stream' }
    )
    const stream = response.data as unknown as IncomingMessage

    const output = await new Promise<string>((resolve, reject) => {
      const outputs: string[] = []

      stream.on('data', (chunk: Buffer) => {
        // Messages in the event stream are separated by a pair of newline characters.
        const payloads = chunk.toString().split('\n\n')
        for (const payload of payloads) {
          if (payload.includes('[DONE]')) return
          if (payload.startsWith('data:')) {
            const data = payload.replaceAll(/(\n)?^data:\s*/g, '') // in case there's multiline data event
            try {
              const delta = JSON.parse(data.trim())
              const output = delta.choices[0].delta?.content
              outputs.push(output)
              onChunk(output)
            } catch (error) {
              log(`Error with JSON.parse and ${payload}.\n${error}`)
            }
          }
        }
      })

      stream.on('end', () => resolve(outputs.join('')))
      stream.on('error', reject)
    })

    writeTempFile({ output, messages }, tempInput)
    return output
  } catch (e) {
    throw parseError(e)
  }
}

function writeTempFile(data: any, existingFile?: string) {
  const file = existingFile || '/tmp/' + Math.random().toString(36).substring(7) + '.json'
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
  if (!existingFile) log('wrote rquest to', file)
  return file
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
