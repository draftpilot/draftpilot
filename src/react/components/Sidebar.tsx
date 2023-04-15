import { fileStore } from '@/react/stores/fileStore'
import { messageStore } from '@/react/stores/messageStore'
import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

export default () => {
  const activeSession = useStore(messageStore.session)
  const sessions = useStore(messageStore.sessions)

  useEffect(() => {
    messageStore.loadSessions()
  }, [])

  const loadSession = (id: string) => {
    messageStore.loadSession(id)
    fileStore.newSession()
  }

  const newSession = () => {
    messageStore.newSession()
    fileStore.newSession()
  }

  return (
    <div className="p-4 flex flex-col gap-2 overflow-y-auto">
      <button
        onClick={() => newSession()}
        className="p-2 rounded border-2 border-gray-600 cursor-pointer hover:bg-gray-400 text-gray-700"
      >
        New Session
      </button>

      {sessions.length && <div className="my-2">Past Sessions</div>}

      {sessions.map((session) => (
        <div key={session.id} className="flex flex-col">
          <button
            className={
              'p-2 rounded border-2 border-gray-600 cursor-pointer hover:bg-gray-400 text-gray-700 ' +
              (session.id === activeSession?.id ? 'bg-blue-100' : '')
            }
            disabled={session.id === activeSession?.id}
            onClick={() => loadSession(session.id)}
          >
            {session.name}
          </button>
          <div className="text-xs text-gray-500 m-2">{new Date(session.id).toLocaleString()}</div>
        </div>
      ))}
    </div>
  )
}
