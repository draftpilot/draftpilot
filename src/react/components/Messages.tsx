import MergeTool from '@/react/components/MergeTool'
import Message from '@/react/components/Message'
import Onboarding from '@/react/components/NoMessages'
import ProgressBar from '@/react/components/ProgressBar'
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
  const error = useStore(messageStore.error)

  useEffect(() => {
    if (!ref.current) return
    // scroll to bottom
    ref.current.lastElementChild?.scrollIntoView()
  }, [messages, mergeInfo])

  return (
    <div className="flex flex-col gap-4 my-4 pb-8" ref={ref}>
      {messages.map((message, i) => (
        <Message key={i} message={message} pos={{ i, len: messages.length }} />
      ))}
      {inProgress && <Message pos={{ i: messages.length, len: messages.length }} />}
      {error && <div className="my-2 text-red-600">Error: {error}</div>}
      {mergeInfo && <MergeTool />}
    </div>
  )
}
