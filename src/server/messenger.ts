import { Dispatcher } from '@/directors/dispatcher'
import { ChatMessage, MessagePayload } from '@/types'
import { Response } from 'express'

export class Messenger {
  dispatcher = new Dispatcher()

  async init() {
    await this.dispatcher.init()
  }

  respondToMessages = async (input: MessagePayload, res: Response) => {
    if (!input) {
      res.end()
      return
    }

    try {
      await this.dispatcher.onMessage(input, (incoming: ChatMessage | string) => {
        res.write(JSON.stringify(incoming) + ',')
      })

      res.end()
    } catch (e: any) {
      console.error(e)
      const message = e.message || e.toString()
      res.write(JSON.stringify({ error: message }) + ',')
      res.end()
    }
  }

  respondToInterrupt = async (id: string) => {
    this.dispatcher.onInterrupt(id)
  }
}
