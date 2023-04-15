import { messageStore } from '@/react/stores/messageStore'
import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

export default () => {
  const session = useStore(messageStore.session)
  const sessions = useStore(messageStore.sessions)

  useEffect(() => {
    messageStore.loadSessions()
  }, [])

  return (
    <div className="p-4 flex flex-col gap-2">
      <button className="p-2 rounded border-2 border-gray-600 cursor-pointer hover:bg-gray-400">
        New Session
      </button>

      {sessions.map((session) => (
        <button
          key={session.id}
          className="p-2 rounded border-2 border-gray-600 cursor-pointer hover:bg-gray-400"
        >
          {session.name}
        </button>
      ))}
    </div>
  )
}
