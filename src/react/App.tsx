import ChatInput from '@/react/components/ChatInput'
import Messages from '@/react/components/Messages'
function App() {
  return (
    <div className="mx-auto max-w-3xl flex flex-col h-full p-8">
      <div className="flex-1 items-center overflow-y-auto">
        <Messages />
      </div>

      <ChatInput />
    </div>
  )
}

export default App
