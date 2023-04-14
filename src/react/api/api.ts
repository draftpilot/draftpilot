import { ChatMessage } from '@/types'
import { log, warn } from '@/utils/logger'
import axios, { AxiosError } from 'axios'
class APIService {
  endpoint = '/api'

  loadFiles = async (): Promise<{ files: string[] }> => {
    const response = await axios.get(`${this.endpoint}/files`)
    return response.data
  }

  sendMessage = (
    message: ChatMessage,
    onMessage: (message: ChatMessage) => void
  ): Promise<void> => {
    // use fetch since this use of axios doesn't support streaming
    return new Promise<void>((resolve, reject) => {
      fetch(`${this.endpoint}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      })
        .then((response) => {
          if (!response.body) reject(new Error('No response body'))

          // Create a ReadableStream from the response body
          const reader = response.body!.getReader()

          // Define a function to read the stream
          function readStream(): any {
            return reader.read().then(({ done, value }) => {
              if (done) {
                resolve()
                return
              }

              try {
                const text = new TextDecoder().decode(value)
                const messages = parsePartialMessages(text)
                messages.forEach((m) => onMessage(m))
              } catch (error) {
                reject(error)
              }

              // Continue reading the stream
              return readStream()
            })
          }

          // Start reading the stream
          return readStream()
        })
        .catch((error) => {
          reject(error)
        })
    })
  }
}

const parsePartialMessages = (text: string): ChatMessage[] => {
  return JSON.parse('[' + (text.endsWith(',') ? text.slice(0, -1) : text) + ']')
}

export const API = new APIService()

export const isAxiosError = (item: Error): item is AxiosError => (item as AxiosError).isAxiosError
