import config from '@/config'
import { cache } from '@/db/cache'
import { ChatMessage, Model } from '@/types'
import { isAxiosError } from 'axios'
import { Configuration, OpenAIApi } from 'openai'
import fs from 'fs'
import { log } from '@/utils/logger'
import { IncomingMessage } from 'http'
import { tracker } from '@/utils/tracker'
import { encode } from 'gpt-3-encoder'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})

const openai = new OpenAIApi(configuration)

const tokenCount = (messages: ChatMessage[]) => {
  return messages.reduce((acc, message) => acc + encode(message.content).length, 0)
}

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

  const start = Date.now()
  const responseContent = await chatWithHistory(messages, model, stop)
  cache.set(prompt, responseContent)
  tracker.chatCompletion(model, Date.now() - start, tokenCount(messages))
  return responseContent
}

export async function chatWithHistory(
  messages: ChatMessage[],
  model: Model,
  stop?: string | string[]
) {
  try {
    const tempInput = writeTempFile(messages, model)

    const start = Date.now()
    const completion = await openai.createChatCompletion({
      model: model == '3.5' ? 'gpt-3.5-turbo' : 'gpt-4',
      messages,
      temperature: config.temperature,
      stop: stop,
    })
    tracker.chatCompletion(model, Date.now() - start, tokenCount(messages))

    const response = completion.data.choices[0].message
    const output = response?.content || ''

    writeTempFile(messages.concat({ content: output, role: 'assistant' }), model, tempInput)

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
    const tempInput = writeTempFile(messages, model)

    const start = Date.now()
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
              if (output) {
                outputs.push(output)
                onChunk(output)
              }
            } catch (error) {
              log(`Error with JSON.parse and ${payload}.\n${error}`)
            }
          }
        }
      })

      stream.on('end', () => resolve(outputs.join('')))
      stream.on('error', reject)
    })

    tracker.chatCompletion(model, Date.now() - start, tokenCount(messages))
    writeTempFile(messages.concat({ content: output, role: 'assistant' }), model, tempInput)
    // tracker.logStreamCompletion(messages, model, output)
    return output
  } catch (e) {
    throw parseError(e)
  }
}

function writeTempFile(data: ChatMessage[], requestNote: string, existingFile?: string) {
  const file = existingFile || '/tmp/' + Math.random().toString(36).substring(7) + '.txt'
  const output = data.map((d) => d.role + ':\n' + d.content).join('\n---\n')
  fs.writeFileSync(file, output)
  if (!existingFile) log('wrote', requestNote, 'request to', file)
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
