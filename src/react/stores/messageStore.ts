import { API } from '@/react/api/api'
import { ChatMessage } from '@/types'
import { atom } from 'nanostores'
import Dexie, { Table } from 'dexie'

type Session = {
  id: string
  name: string
}

class SessionDatabase extends Dexie {
  public sessions!: Table<Session, string>
  public messages!: Table<{ id: string; messages: ChatMessage[] }, string>

  public constructor() {
    super('sessionDb')
    this.version(1).stores({
      sessions: 'id,name',
      messages: 'id,messages',
    })
  }
}

class MessageStore {
  sessionDb = new SessionDatabase()

  // --- services

  session = atom<Session>({ id: new Date().toISOString(), name: '' })

  sessions = atom<Session[]>([])

  messages = atom<ChatMessage[]>([])

  inProgress = atom<boolean>(false)

  // --- actions

  clearData = () => {
    this.messages.set([])
  }

  sendMessage = async (message: ChatMessage, options?: any) => {
    const payload = { message, history: this.messages.get(), options }

    if (!this.session.get().name) this.updateSessionName(message)
    this.updateMessages([...this.messages.get(), message])

    this.inProgress.set(true)
    await API.sendMessage(payload, (incoming) => {
      this.updateMessages([...this.messages.get(), incoming])
    })
    this.inProgress.set(false)
  }

  addSystemMessage = (message: ChatMessage) => {
    this.updateMessages([...this.messages.get(), message])
  }

  updateMessages = (messages: ChatMessage[]) => {
    this.messages.set(messages)
    const id = this.session.get().id
    this.sessionDb.messages.put({ id, messages })
  }

  updateSessionName = (message: ChatMessage) => {
    const name = message.content.slice(0, 50)
    const session = { ...this.session.get(), name }
    this.session.set(session)
    this.sessionDb.sessions.put(session)

    this.sessions.set([session, ...this.sessions.get()])
  }

  loadSessions = async () => {
    const sessions = await this.sessionDb.sessions.orderBy('id').reverse().toArray()
    this.sessions.set(sessions)
  }

  loadSession = async (id: string) => {
    const session = await this.sessionDb.sessions.get(id)
    if (!session) return
    this.session.set(session)
    const messages = await this.sessionDb.messages.get(id)
    this.messages.set(messages?.messages || [])
  }

  newSession = () => {
    this.session.set({ id: new Date().toISOString(), name: '' })
    this.messages.set([])
  }
}

declare global {
  interface Window {
    messageStore: MessageStore
  }
}

export const messageStore = new MessageStore()
window.messageStore = messageStore
