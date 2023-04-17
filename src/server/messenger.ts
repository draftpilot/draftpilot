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

    await this.agent.onMessage(input, (incoming: ChatMessage) => {
      res.write(JSON.stringify(incoming) + ',')
    })

    res.end()
  }

  respondToInterrupt = async (id: string) => {
    this.agent.onInterrupt(id)
  }
}
