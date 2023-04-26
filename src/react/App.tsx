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
import { ChevronDoubleRightIcon } from '@heroicons/react/24/outline'

function App() {
  const messages = useStore(messageStore.messages)
  const projectContext = useStore(uiStore.editingProjectContext)
  const editing = useStore(messageStore.editMessage)
  const showSidebar = useStore(uiStore.sidebarVisible)
  const noMessages = messages.length === 0 && !editing

  useWindowVisible()
  useEffect(() => {
    uiStore.init()
    // if width is small, hide sidebar
    if (window.innerWidth < 640) uiStore.sidebarVisible.set(false)
  }, [])

  return (
    <div className="flex h-full relative">
      {showSidebar && (
        <div className="fixed bg-white w-72 z-20 sm:block sm:z-0">
          <Sidebar />
        </div>
      )}
      {!showSidebar && (
        <div className="fixed top-6 left-2 z-10 bg-white p-2">
          <ChevronDoubleRightIcon
            className="w-4 h-4 text-gray-500 cursor-pointer"
            onClick={() => uiStore.toggleSidebar()}
          />
        </div>
      )}

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
            <Messages />
            <div className="mx-auto w-[768px] max-w-full">{editing && <ChatInput />}</div>
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
