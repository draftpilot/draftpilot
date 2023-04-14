import Message from '@/react/components/Message'
import Onboarding from '@/react/components/Onboarding'
import { ChatMessage } from '@/types/types'

export default () => {
  const messages: ChatMessage[] = []

  return (
    <div className="flex flex-col gap-4 my-4">
      {messages.map((message, i) => (
        <Message key={i} message={message.content} fromUser={message.role == 'user'} />
      ))}

      {!messages.length && <Onboarding />}
    </div>
  )
}
