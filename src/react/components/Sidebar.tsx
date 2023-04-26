import { fileStore } from '@/react/stores/fileStore'
import { messageStore } from '@/react/stores/messageStore'
import uiStore from '@/react/stores/uiStore'
import {
  ChevronDoubleLeftIcon,
  ChevronLeftIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

export default () => {
  const activeSession = useStore(messageStore.session)
  const sessions = useStore(messageStore.sessions)
  const projectContext = useStore(uiStore.editingProjectContext)

  const loadSession = (id: string) => {
    if (projectContext) uiStore.toggleProjectContext()
    messageStore.loadSession(id)
    fileStore.newSession()
  }

  const deleteSession = (sessionId: string) => {
    const sessionName = sessions.find((s) => s.id === sessionId)?.name
    if (confirm('Delete session named "' + sessionName + '"?')) {
      messageStore.deleteSession(sessionId)
    }
  }

  const renameSession = (sessionId: string) => {
    const sessionName = sessions.find((s) => s.id === sessionId)?.name
    const newName = prompt('Rename session', sessionName)
    if (newName) {
      messageStore.renameSession(sessionId, newName)
    }
  }

  const newSession = () => {
    messageStore.newSession()
    fileStore.newSession()
  }

  return (
    <div className="py-6 px-10 flex flex-col gap-2 overflow-y-auto h-full border-r border-gray-200">
      <div className="flex items-center mb-4">
        <h1 className="flex-1 text-xl font-bold">Draftpilot</h1>
        <ChevronDoubleLeftIcon
          className="w-4 h-4 text-gray-500 cursor-pointer"
          onClick={() => uiStore.toggleSidebar()}
        />
      </div>
      <button
        onClick={() => newSession()}
        className="p-2 rounded border-2 border-blue-700 text-blue-700 cursor-pointer hover:bg-gray-400 "
      >
        New Session
      </button>
      {sessions.length > 0 && <div className="my-2">Past Sessions</div>}
      <div className="overflow-y-auto flex-1 -mx-10 px-10">
        {sessions.map((session) => (
          <div key={session.id} className="flex flex-col group">
            <button
              className={
                'p-2 rounded border-2 border-gray-600 cursor-pointer hover:bg-gray-400 ' +
                'text-gray-700 overflow-ellipsis overflow-hidden ' +
                (session.id === activeSession?.id ? 'bg-blue-100' : '')
              }
              disabled={session.id === activeSession?.id}
              onClick={() => loadSession(session.id)}
            >
              {session.name}
            </button>
            <div className="text-xs text-gray-500 my-2 gap-2 flex items-center">
              <div className="flex-1">{new Date(session.id).toLocaleString()}</div>
              <button
                className="hidden group-hover:block"
                onClick={() => renameSession(session.id)}
                title="Rename"
              >
                <PencilIcon className="w-4 h-4 hover:text-gray-800" />
              </button>
              <button
                className="hidden group-hover:block"
                onClick={() => deleteSession(session.id)}
                title="Delete"
              >
                <TrashIcon className="w-4 h-4 hover:text-gray-800" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => uiStore.toggleProjectContext()}
        className={`p-2 rounded border-2 border-gray-600 cursor-pointer hover:bg-gray-400 
          ${projectContext ? 'bg-gray-400' : ''} text-gray-700`}
      >
        Project Context
      </button>
    </div>
  )
}
