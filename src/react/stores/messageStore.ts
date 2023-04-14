import { ChatMessage } from '@/types/types'
import { atom } from 'nanostores'

class MessageStore {
  // --- services

  messages = atom<ChatMessage[]>([])

  // --- actions

  clearData = () => {
    this.messages.set([])
  }

  addMessage = (message: ChatMessage) => {
    this.messages.set([...this.messages.get(), message])
  }
}

declare global {
  interface Window {
    messageStore: MessageStore
  }
}

export const messageStore = new MessageStore()
window.messageStore = messageStore
