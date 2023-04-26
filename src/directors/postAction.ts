// post-action is the class that deals with the result of a single dispatch flow.

import { Dispatcher } from '@/directors/dispatcher'
import { ChatMessage, Intent, MessagePayload, PostMessage } from '@/types'
import { log } from '@/utils/logger'
import { tracker } from '@/utils/tracker'
import { generateUUID } from '@/utils/utils'

const DEFAULT_TIME = 15

// it always tries to keep moving on to the next step if possible
type PostActionData = {
  payload: MessagePayload
  nextMessage: ChatMessage
  postMessage: PostMessage
}
export class PostAction {
  constructor(public dispatcher: Dispatcher, public interrupted: Set<string>) {}

  onMessage = async (data: PostActionData) => {
    const { nextMessage } = data
    if (nextMessage.intent == Intent.DRAFTPILOT) {
      if (nextMessage.content.startsWith('PLAN:')) {
        await this.doNextActionAfterTimeout(
          'executing plan',
          DEFAULT_TIME,
          data,
          async (postMessage: PostMessage) => {
            tracker.autoMessage(Intent.EDIT_FILES)
            const messagePayload = { ...data.payload, message: nextMessage }
            await this.dispatcher.handleDetectedIntent(
              Intent.EDIT_FILES,
              messagePayload,
              undefined,
              postMessage
            )
          }
        )
      }
    }
  }

  actions: { [id: string]: (postMessage: PostMessage) => Promise<void> } = {}
  timers: { [id: string]: NodeJS.Timeout } = {}
  messageToId: { [messageId: string]: string } = {}

  doNextActionAfterTimeout = async (
    nextAction: string,
    nextTimeSeconds: number,
    data: PostActionData,
    followup: (postMessage: PostMessage) => Promise<void>
  ) => {
    const { payload, postMessage } = data
    const id = 'post-' + generateUUID()

    const message = `Automatically ${nextAction} in ${nextTimeSeconds} seconds...`
    data.postMessage({
      content: message,
      role: 'system',
      progressDuration: nextTimeSeconds * 1000,
      state: id,
      buttons: [
        { label: 'Continue', action: 'continue' },
        { label: 'Cancel', action: 'cancel' },
      ],
    })

    // keep awaiting to keep the HTTP connection open
    this.actions[id] = followup
    this.messageToId[payload.id] = id
    await new Promise<void>((res) => {
      const timeout = setTimeout(async () => {
        this.clear(id)
        await followup(postMessage)
        res()
      }, nextTimeSeconds * 1000)
      this.timers[id] = timeout
    })
  }

  interrupt = (messageId: string) => {
    if (this.messageToId[messageId]) {
      const id = this.messageToId[messageId]
      this.takeAction(id, 'cancel', (stuff) => log('post-action interrupted', stuff))
    }
  }

  clear = (id: string) => {
    if (this.timers[id]) {
      clearTimeout(this.timers[id])
      delete this.timers[id]
    }
    if (this.actions[id]) {
      delete this.actions[id]
    }
    Object.values(this.messageToId).forEach((messageId) => {
      if (this.messageToId[messageId] == id) {
        delete this.messageToId[messageId]
      }
    })
  }

  takeAction = async (id: string, action: string, postMessage: PostMessage) => {
    if (action == 'continue') {
      const action = this.actions[id]
      this.clear(id)
      if (action) await action(postMessage)
    } else if (action == 'cancel') {
      this.clear(id)
    }
  }
}
