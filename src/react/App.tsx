import React, { useEffect } from 'react'
import ChatInput from '@/react/components/ChatInput'
import Messages from '@/react/components/Messages'
import NoMessages from '@/react/components/NoMessages'
import Sidebar from '@/react/components/Sidebar'
import { messageStore } from '@/react/stores/messageStore'
import { useStore } from '@nanostores/react'
import useWindowVisible from '@/react/hooks/useWindowVisible'
import uiStore from '@/react/stores/uiStore'
import ContextEditor from '@/react/components/ContextEditor'

function App() {
  const messages = useStore(messageStore.messages)
  const projectContext = useStore(uiStore.editingProjectContext)
  const editing = useStore(messageStore.editMessage)
  const noMessages = messages.length === 0 && !editing

  useWindowVisible()
  useEffect(() => {
    uiStore.init()
  }, [])

  return (
    <div className="flex h-full relative">
      <div className="hidden sm:block w-56 bg-gray-300">
        <Sidebar />
      </div>

      {projectContext ? (
        <div className="flex-1 overflow-y-auto pt-8 pb-40">
          <div className="mx-auto w-[768px] max-w-full gap-4 flex flex-col">
            <ContextEditor />
          </div>
        </div>
      ) : noMessages ? (
        <div className="flex-1 overflow-y-auto pt-8 pb-40">
          <div className="mx-auto w-[768px] max-w-full gap-4 flex flex-col">
            <NoMessages />
            <ChatInput initialMessage />
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto pb-40">
            <div className="mx-auto w-[768px] max-w-full">
              <Messages />
              {editing && <ChatInput />}
            </div>
          </div>

          {!editing && (
            <div className="fixed bottom-0 left-0 sm:left-56 right-0">
              <div className="mx-auto w-[768px] max-w-full">
                <div className="bg-gradient-to-b from-transparent to-gray-200 h-10" />
                <ChatInput />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default App
