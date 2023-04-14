import { API } from '@/react/api/api'
import { ChatMessage } from '@/types'
import { atom } from 'nanostores'

class MessageStore {
  // --- services

  messages = atom<ChatMessage[]>([])

  inProgress = atom<boolean>(false)

  // --- actions

  clearData = () => {
    this.messages.set([])
  }

  sendMessage = async (message: ChatMessage) => {
    this.messages.set([...this.messages.get(), message])

    this.inProgress.set(true)
    await API.sendMessage(message, (incoming) => {
      this.messages.set([...this.messages.get(), incoming])
    })
    this.inProgress.set(false)
  }
}

declare global {
  interface Window {
    messageStore: MessageStore
  }
}

export const messageStore = new MessageStore()
window.messageStore = messageStore
