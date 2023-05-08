import chalk from 'chalk'
import fs from 'fs'
import { encode } from 'gpt-3-encoder'
import { IncomingMessage } from 'http'
import { Configuration, CreateChatCompletionResponse, OpenAIApi } from 'openai'

import config from '@/config'
import { cache } from '@/db/cache'
import { ChatMessage, Model } from '@/types'
import { log } from '@/utils/logger'
import { tracker } from '@/utils/tracker'

const tokenCount = (messages: ChatMessage[]) => {
  return messages.reduce((acc, message) => acc + encode(message.content).length, 0)
}
class OpenAI {
  openai: OpenAIApi
  logFolder: string

  constructor() {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    })

    this.openai = new OpenAIApi(configuration)

    if (process.cwd().includes('/tmp')) this.logFolder = config.configFolder
    else this.logFolder = '/tmp'
  }

  // --- completion api

  async chatCompletion(
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
    const responseContent = await this.chatWithHistory(messages, model, stop)
    cache.set(prompt, responseContent)
    tracker.chatCompletion(model, Date.now() - start, tokenCount(messages))
    return responseContent
  }

  async chatWithHistory(messages: ChatMessage[], model: Model, stop?: string | string[]) {
    try {
      const tempInput = this.writeTempFile(messages, model)
      if (this.fakeMode) {
        await new Promise((resolve) => setTimeout(resolve, 5000))
        return this.generateFakeResponse(model, messages)
      }

      const start = Date.now()
      const response = await this.openai.createChatCompletion({
        model: model == '3.5' ? 'gpt-3.5-turbo' : 'gpt-4',
        messages,
        temperature: config.temperature,
        stop: stop,
      })
      const output = response.data.choices[0].message?.content || ''
      tracker.chatCompletion(model, Date.now() - start, tokenCount(messages))
      this.writeTempFile(messages.concat({ content: output, role: 'assistant' }), model, tempInput)

      return output
    } catch (e) {
      throw parseError(e)
    }
  }

  async streamChatWithHistory(
    messages: ChatMessage[],
    model: Model,
    onChunk: (chunk: string) => void,
    stop?: string | string[]
  ) {
    try {
      const tempInput = this.writeTempFile(messages, model)
      if (this.fakeMode) {
        const response = this.generateFakeResponse(model, messages)
        for (let i = 0; i < response.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 20))
          onChunk(response[i])
        }
        return response
      }

      const start = Date.now()
      const response = await this.openai.createChatCompletion(
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
      this.writeTempFile(messages.concat({ content: output, role: 'assistant' }), model, tempInput)
      return output
    } catch (e) {
      throw parseError(e)
    }
  }

  writeTempFile(data: ChatMessage[], model: string, existingFile?: string) {
    const file = existingFile || this.logFolder + '/request-' + new Date().toISOString() + '.txt'
    const output = data.map((d) => d.role + ':\n' + d.content).join('\n---\n')
    fs.writeFileSync(file, output)
    if (!existingFile) log('wrote', 'gpt-' + model, 'request to', file)
    return file
  }
  // --- fake requests

  fakeMode = false
  fakeModeResponse: string | null = null

  setFakeMode() {
    log(chalk.yellow('FAKE MODE ENABLED'))
    this.fakeMode = true
  }

  setFakeModeResponse(response: string) {
    if (!this.fakeMode) return
    this.fakeModeResponse = response
  }

  generateFakeResponse(model: string, messages: ChatMessage[]) {
    if (this.fakeModeResponse) {
      const response = this.fakeModeResponse
      this.fakeModeResponse = null
      return response
    }

    const lastMessage = messages
      .slice()
      .reverse()
      .find((m) => m.role == 'user')
    const lastLine = (lastMessage?.content || 'unknown')
      .split('\n')
      .filter((x) => x.trim())
      .pop()

    return `fake GPT-${model} response to your request: ${lastLine}`.trim()
  }
}

function parseError(e: any) {
  if (e.response) {
    const data = e.response?.data
    if (data) {
      const error = data.error
      try {
        const dataResponse = JSON.stringify(error || data)
        return new Error(dataResponse)
      } catch (e) {
        // can't stringify, just return the error
      }
    }
  }
  return e
}

export function getModel(isCode: boolean) {
  const policy = config.gpt4
  if (policy == 'always' || (policy == 'code-only' && isCode)) return '4'
  return '3.5'
}

const openAIApi = new OpenAI()
export default openAIApi
