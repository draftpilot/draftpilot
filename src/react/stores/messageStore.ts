import { API, isAxiosError } from '@/react/api/api'
import { ChatMessage, Intent, MessagePayload } from '@/types'
import { atom } from 'nanostores'
import Dexie, { Table } from 'dexie'
import { fileStore } from '@/react/stores/fileStore'
import { generateUUID, smartTruncate } from '@/utils/utils'
import { log } from '@/utils/logger'
import uiStore from '@/react/stores/uiStore'

type Session = {
  id: string
  name: string
  cwd: string
}

class SessionDatabase extends Dexie {
  public sessions!: Table<Session, string>
  public messages!: Table<{ id: string; messages: ChatMessage[] }, string>

  public constructor() {
    super('sessionDb')
    this.version(1).stores({
      sessions: 'id,name',
      messages: 'id',
    })

    this.version(2).stores({
      sessions: '&id,name,cwd',
      messages: '&id',
    })
  }
}

class MessageStore {
  sessionDb = new SessionDatabase()

  // --- fields

  session = atom<Session>({ id: new Date().toISOString(), name: '', cwd: '' })

  sessions = atom<Session[]>([])

  messages = atom<ChatMessage[]>([])

  inProgress = atom<MessagePayload | undefined>()

  partialMessage = atom<string | undefined>()

  editMessage = atom<ChatMessage | null>(null)

  intent = atom<string | undefined>(Intent.DRAFTPILOT)

  error = atom<string | undefined>()

  // --- actions

  clearData = () => {
    this.messages.set([])
    this.intent.set(Intent.DRAFTPILOT)
    this.error.set(undefined)
    this.partialMessage.set(undefined)
    this.editMessage.set(null)
  }

  sendMessage = async (message: ChatMessage, skipHistory?: boolean, sessionId?: string) => {
    this.editMessage.set(null)
    const id = generateUUID()
    const payload: MessagePayload = { id, message, history: this.messages.get() }
    log(payload)
    if (!message.intent && this.intent.get()) message.intent = this.intent.get()
    this.shouldDing = true

    if (!sessionId && !this.session.get().name) this.updateSessionName(message)
    if (!sessionId) sessionId = this.session.get().id
    this.doCompletion(sessionId, payload)
    if (!skipHistory) this.updateMessages(sessionId, [...this.messages.get(), message])
  }

  doCompletion = async (sessionId: string, payload: MessagePayload) => {
    this.inProgress.set(payload)
    this.partialMessage.set(undefined)
    this.error.set(undefined)
    try {
      await API.sendMessage(payload, (msg) => this.handleIncoming(sessionId, msg))
    } catch (error: any) {
      const message = API.unwrapError(error)
      this.error.set(message)
    }
    if (!this.partialMessage.get()) {
      this.inProgress.set(undefined)
    }
    this.editMessage.set(null)
  }

  handleIncoming = async (sessionId: string, message: ChatMessage | string) => {
    const isCurrentSession = sessionId == this.session.get().id
    if (typeof message === 'string') {
      // streaming completion
      if (!isCurrentSession) return
      const newMessage = (this.partialMessage.get() || '') + message
      this.partialMessage.set(newMessage)
    } else if (message.error) {
      // received error
      if (typeof message.error == 'string') {
        this.error.set(message.error)
      } else if (message.error.message) {
        this.error.set(message.error.message)
      } else {
        this.error.set(JSON.stringify(message.error))
      }
    } else {
      // received full message
      this.maybePlayDingSound()
      if (isCurrentSession && this.partialMessage.get()) {
        this.partialMessage.set(undefined)
        this.inProgress.set(undefined)
      }
      const messages = isCurrentSession
        ? this.messages.get()
        : (await this.sessionDb.messages.get(sessionId))?.messages || []

      if (isCurrentSession && message.intent) this.intent.set(message.intent)
      if (message.progressDuration) message.progressStart = Date.now()
      else if (message.progressDuration == 0) {
        this.updateMessages(
          sessionId,
          messages.filter((m) => {
            if (m.content == message.content && m.progressStart) return false
            return true
          })
        )
        return
      }
      this.updateMessages(sessionId, [...messages, message])

      if (message.intent == Intent.DONE) {
        fileStore.loadData()
      }

      if (message.content.startsWith('PLAN: ')) {
        this.maybeUpdateSessionName(sessionId, message.content)
      }
    }
  }

  addSystemMessage = (message: ChatMessage, sessionId?: string) => {
    this.updateMessages(sessionId || this.session.get().id, [...this.messages.get(), message])
  }

  updateMessages = (sessionId: string, messages: ChatMessage[]) => {
    const currentSessionId = this.session.get().id
    if (sessionId == currentSessionId) {
      this.messages.set(messages)
    }
    this.sessionDb.messages.put({ id: sessionId, messages })
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

  interruptRequest = () => {
    const payload = this.inProgress.get()
    if (payload) API.interrupt(payload.id)
    this.inProgress.set(undefined)
  }

  // --- session management

  cwd: string = ''
  setCwd = (cwd: string) => {
    this.cwd = cwd
    this.loadSessions()
    this.session.set({ ...this.session.get(), cwd })
  }

  updateSessionName = (message: ChatMessage) => {
    const input = message.content
    const name = smartTruncate(input, 50)
    const session = { ...this.session.get(), name }
    this.session.set(session)
    this.sessionDb.sessions.put(session)

    this.sessions.set([session, ...this.sessions.get()])
  }

  maybeUpdateSessionName = (sessionId: string, content: string) => {
    const name = content.substring(0, content.indexOf('\n')).replace('PLAN: ', '')
    if (name.length > 3) {
      this.renameSession(sessionId, name)
    }
  }

  loadSessions = async () => {
    const sessions = await this.sessionDb.sessions.where('cwd').equals(this.cwd).reverse().toArray()
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
    this.intent.set(intent?.intent || undefined)
  }

  newSession = () => {
    const cwd = this.cwd
    this.session.set({ id: new Date().toISOString(), name: '', cwd })
    this.clearData()
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
    if (this.session.get().id == id) this.session.set(session)
  }

  shouldDing = true
  dingSound = new Audio('/ding.mp3')
  maybePlayDingSound = () => {
    if (!this.shouldDing) return
    if (uiStore.windowVisible.get()) return
    this.dingSound.play().catch(console.warn)
    this.shouldDing = false
  }
}

declare global {
  interface Window {
    messageStore: MessageStore
  }
}

export const messageStore = new MessageStore()
window.messageStore = messageStore
