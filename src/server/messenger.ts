import { ChatMessage } from '@/types'
import { Response } from 'express'

export function respondToMessages(input: ChatMessage, res: Response) {
  res.write(
    JSON.stringify({
      content: 'I got: ' + input?.content,
      role: 'assistant',
    }) + ','
  )

  // Send JSON messages every second
  const intervalId = setInterval(() => {
    const message = { content: 'Hello, world! ' + Date.now(), role: 'assistant' }
    // Send message as JSON string
    res.write(JSON.stringify(message) + ',')
  }, 1000)

  // Stop sending messages after 5 seconds
  setTimeout(() => {
    clearInterval(intervalId)
    res.end()
  }, 5000)
}
