import MergeTool from '@/react/components/MergeTool'
import Message from '@/react/components/Message'
import Onboarding from '@/react/components/Onboarding'
import { fileStore } from '@/react/stores/fileStore'
import { messageStore } from '@/react/stores/messageStore'
import { ChatMessage } from '@/types'
import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'

export default () => {
  const ref = useRef<HTMLDivElement | null>(null)
  const messages = useStore(messageStore.messages)
  const inProgress = useStore(messageStore.inProgress)
  const mergeInfo = useStore(fileStore.mergeInfo)

  useEffect(() => {
    if (!ref.current) return
    // scroll to bottom
    ref.current.lastElementChild?.scrollIntoView()
  }, [messages, mergeInfo])

  return (
    <div className="flex flex-col gap-4 my-4 pb-8" ref={ref}>
      {messages.map((message, i) => (
        <Message key={i} message={message} />
      ))}
      {inProgress && <Message />}
      {mergeInfo && <MergeTool />}

      {!messages.length && <Onboarding />}
    </div>
  )
}
