import { FullServiceDirector } from '@/directors/fullServiceDirector'
import { ChatMessage, MessagePayload } from '@/types'
import { Response } from 'express'

export class Messenger {
  agent = new FullServiceDirector()

  constructor() {
    this.agent.init()
  }

  respondToMessages = async (input: MessagePayload, res: Response) => {
    if (!input) {
      res.end()
      return
    }

    try {
      await this.agent.onMessage(input, (incoming: ChatMessage) => {
        res.write(JSON.stringify(incoming) + ',')
      })

      res.end()
    } catch (e: any) {
      const message = e.message || e.toString()
      res.sendStatus(400).json({ error: message }).end()
    }
  }

  respondToInterrupt = async (id: string) => {
    this.agent.onInterrupt(id)
  }
}
