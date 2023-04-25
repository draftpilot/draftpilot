// post-action is the class that deals with the result of a single dispatch flow.

import { ChatMessage, MessagePayload, PostMessage } from '@/types'
import { generateUUID } from '@/utils/utils'

const DEFAULT_TIME = 15

// it always tries to keep moving on to the next step if possible
export class PostAction {
  constructor(public interrupted: Set<string>) {}

  onMessage = async (
    payload: MessagePayload,
    newMessage: ChatMessage,
    postMessage: PostMessage
  ) => {
    const id = generateUUID()

    const message = `Automatically taking next action in ${DEFAULT_TIME} seconds...`
    postMessage({
      content: message,
      role: 'system',
      progressDuration: DEFAULT_TIME * 1000,
      state: id,
      buttons: [
        { label: 'Continue', action: 'continue' },
        { label: 'Cancel', action: 'cancel' },
      ],
    })

    setTimeout(() => {
      if (this.interrupted.has(id)) {
        this.interrupted.delete(id)
        return
      }

      console.log('123 times up')

      postMessage({
        content: message,
        role: 'system',
        progressDuration: 0,
      })

      this.doFollowup(payload, newMessage, postMessage)
    }, DEFAULT_TIME * 1000)
  }

  doFollowup = async (
    payload: MessagePayload,
    newMessage: ChatMessage,
    postMessage: PostMessage
  ) => {
    postMessage({
      content: 'doing the thang',
      role: 'assistant',
    })
  }
}
