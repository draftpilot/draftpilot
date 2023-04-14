import ChatInput from '@/react/components/ChatInput'
import Messages from '@/react/components/Messages'
function App() {
  return (
    <div className="flex flex-col h-full p-8">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-[768px] max-w-full">
          <Messages />
        </div>
      </div>

      <div className="mx-auto w-[768px] max-w-full">
        <ChatInput />
      </div>
    </div>
  )
}

export default App
