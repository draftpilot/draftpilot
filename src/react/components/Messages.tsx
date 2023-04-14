import Message from '@/react/components/Message'
import Onboarding from '@/react/components/Onboarding'
import { messageStore } from '@/react/stores/messageStore'
import { ChatMessage } from '@/types'
import { useStore } from '@nanostores/react'

export default () => {
  const messages = useStore(messageStore.messages)

  return (
    <div className="flex flex-col gap-4 my-4">
      {messages.map((message, i) => (
        <Message key={i} message={message.content} fromUser={message.role == 'user'} />
      ))}

      {!messages.length && <Onboarding />}
    </div>
  )
}
