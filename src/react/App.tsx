import ChatInput from '@/react/components/ChatInput'
import Messages from '@/react/components/Messages'
function App() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pt-8 pb-40">
        <div className="mx-auto w-[768px] max-w-full">
          <Messages />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0">
        <div className="mx-auto w-[768px] max-w-full">
          <div className="bg-gradient-to-b from-transparent to-gray-200 h-10" />
          <ChatInput />
        </div>
      </div>
    </div>
  )
}

export default App
