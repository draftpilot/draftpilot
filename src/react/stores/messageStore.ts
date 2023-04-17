import { API } from '@/react/api/api'
import { ChatMessage, MessagePayload } from '@/types'
import { atom } from 'nanostores'
import Dexie, { Table } from 'dexie'
import { fileStore } from '@/react/stores/fileStore'

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

  // --- fields

  session = atom<Session>({ id: new Date().toISOString(), name: '' })

  sessions = atom<Session[]>([])

  messages = atom<ChatMessage[]>([])

  inProgress = atom<boolean>(false)

  editMessage = atom<ChatMessage | null>(null)

  intent = atom<string | null>(null)

  // --- actions

  clearData = () => {
    this.messages.set([])
    this.intent.set(null)
  }

  sendMessage = async (message: ChatMessage) => {
    const payload: MessagePayload = { message, history: this.messages.get() }

    if (!this.session.get().name) this.updateSessionName(message)
    this.doCompletion(payload)
    this.updateMessages([...this.messages.get(), message])
  }

  doCompletion = async (payload: MessagePayload) => {
    this.inProgress.set(true)
    await API.sendMessage(payload, this.handleIncoming)
    this.inProgress.set(false)
    this.editMessage.set(null)
  }

  handleIncoming = (message: ChatMessage) => {
    if (message.intent) this.intent.set(message.intent)
    this.updateMessages([...this.messages.get(), message])
  }

  addSystemMessage = (message: ChatMessage) => {
    this.updateMessages([...this.messages.get(), message])
  }

  updateMessages = (messages: ChatMessage[]) => {
    this.messages.set(messages)
    const id = this.session.get().id
    this.sessionDb.messages.put({ id, messages })
  }

  popMessages = (target: ChatMessage) => {
    const messages = this.messages.get()
    const index = messages.indexOf(target)
    if (index === -1) return []
    const newMessages = messages.slice(0, index)

    // don't update session until we have a new message
    this.messages.set(newMessages)
    return newMessages
  }

  deleteMessage = (target: ChatMessage) => {
    const messages = this.messages.get()
    this.messages.set(messages.filter((message) => message !== target))
  }

  // --- session management

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
    this.clearData()
    this.session.set(session)
    const messages = await this.sessionDb.messages.get(id)
    this.messages.set(messages?.messages || [])
    const intent = this.messages
      .get()
      .slice()
      .reverse()
      .find((message) => message.intent)
    this.intent.set(intent?.intent || null)
  }

  newSession = () => {
    this.session.set({ id: new Date().toISOString(), name: '' })
    this.messages.set([])
  }

  deleteSession = async (id: string) => {
    await this.sessionDb.sessions.delete(id)
    await this.sessionDb.messages.delete(id)
    this.sessions.set(this.sessions.get().filter((session) => session.id !== id))
  }

  renameSession = async (id: string, name: string) => {
    const session = await this.sessionDb.sessions.get(id)
    if (!session) return
    session.name = name
    await this.sessionDb.sessions.put(session)
    this.sessions.set(this.sessions.get().map((s) => (s.id === id ? session : s)))
  }
}

declare global {
  interface Window {
    messageStore: MessageStore
  }
}

export const messageStore = new MessageStore()
window.messageStore = messageStore
