import Message from '@/react/components/Message'
import Onboarding from '@/react/components/Onboarding'
import { messageStore } from '@/react/stores/messageStore'
import { ChatMessage } from '@/types'
import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'

export default () => {
  const ref = useRef<HTMLDivElement | null>(null)
  const messages = useStore(messageStore.messages)
  const inProgress = useStore(messageStore.inProgress)

  useEffect(() => {
    if (!ref.current) return
    // scroll to bottom
    ref.current.lastElementChild?.scrollIntoView()
  }, [messages])

  return (
    <div className="flex flex-col gap-4 my-4 pb-8" ref={ref}>
      {messages.map((message, i) => (
        <Message key={i} message={message} />
      ))}
      {inProgress && <Message loading />}

      {!messages.length && <Onboarding />}
    </div>
  )
}
