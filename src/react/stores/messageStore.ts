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
  }

  sendMessage = async (message: ChatMessage, skipHistory?: boolean) => {
    const id = generateUUID()
    const payload: MessagePayload = { id, message, history: this.messages.get() }
    log(payload)
    if (!message.intent && this.intent.get()) message.intent = this.intent.get()
    this.shouldDing = true

    if (!this.session.get().name) this.updateSessionName(message)
    this.doCompletion(payload)
    if (!skipHistory) this.updateMessages([...this.messages.get(), message])
  }

  doCompletion = async (payload: MessagePayload) => {
    this.inProgress.set(payload)
    this.partialMessage.set(undefined)
    try {
      await API.sendMessage(payload, this.handleIncoming)
    } catch (error: any) {
      const message = API.unwrapError(error)
      this.error.set(message)
    }
    if (!this.partialMessage.get()) {
      this.inProgress.set(undefined)
    }
    this.editMessage.set(null)
    this.error.set(undefined)
  }

  handleIncoming = (message: ChatMessage | string) => {
    if (typeof message === 'string') {
      const newMessage = (this.partialMessage.get() || '') + message
      this.partialMessage.set(newMessage)
    } else if (message.error) {
      if (typeof message.error == 'string') {
        this.error.set(message.error)
      } else if (message.error.message) {
        this.error.set(message.error.message)
      } else {
        this.error.set(JSON.stringify(message.error))
      }
    } else {
      this.maybePlayDingSound()
      if (this.partialMessage.get()) {
        this.partialMessage.set(undefined)
        this.inProgress.set(undefined)
      }
      const messages = this.messages.get()
      if (message.intent) this.intent.set(message.intent)
      if (message.progressDuration) message.progressStart = Date.now()
      else if (message.progressDuration == 0) {
        this.updateMessages(
          messages.filter((m) => {
            if (m.content == message.content && m.progressStart) return false
            return true
          })
        )
        return
      }
      this.updateMessages([...messages, message])

      if (message.intent == Intent.DONE) {
        fileStore.loadData()
      }

      if (message.content.endsWith('confidence: high')) {
        this.automaticAction()
      }

      if (message.content.startsWith('PLAN: ')) {
        this.maybeUpdateSessionName(message.content)
      }
    }
  }

  automaticAction = () => {
    const content = 'Proceeding in 5 seconds since confidence is high...'
    const clearMessage = () =>
      this.handleIncoming({
        content,
        role: 'system',
        progressDuration: 0,
      })
    const timeout = setTimeout(() => {
      clearMessage()
      const proceed: ChatMessage = {
        role: 'user',
        content: 'Automatically proceeding',
        intent: Intent.ACTION,
      }
      this.sendMessage(proceed)
    }, 5000)

    this.handleIncoming({
      content,
      role: 'system',
      progressDuration: 5000,
      buttons: [
        {
          label: 'Cancel',
          onClick: () => {
            clearTimeout(timeout)
            clearMessage()
          },
        },
      ],
    })
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

  interruptRequest = () => {
    const payload = this.inProgress.get()
    if (payload) API.interrupt(payload.id)
    this.inProgress.set(undefined)
  }

  // --- session management

  updateSessionName = (message: ChatMessage) => {
    const input = message.content
    const name = smartTruncate(input, 50)
    const session = { ...this.session.get(), name }
    this.session.set(session)
    this.sessionDb.sessions.put(session)

    this.sessions.set([session, ...this.sessions.get()])
  }

  maybeUpdateSessionName = (content: string) => {
    const name = content.substring(0, content.indexOf('\n')).replace('PLAN: ', '')
    if (name.length > 3) {
      this.renameSession(this.session.get().id, name)
    }
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
    this.intent.set(intent?.intent || undefined)
  }

  newSession = () => {
    this.session.set({ id: new Date().toISOString(), name: '' })
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
