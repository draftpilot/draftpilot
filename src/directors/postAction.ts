// post-action is the class that deals with the result of a single dispatch flow.

import { ChatMessage, MessagePayload, PostMessage } from '@/types'

// it always tries to keep moving on to the next step if possible
export class PostAction {
  onMessage = async (
    payload: MessagePayload,
    newMessage: ChatMessage,
    postMessage: PostMessage
  ) => {}
}
