import { ChatMessage, Intent } from '@/types'

import 'highlight.js/styles/github-dark.css'
import { useEffect, useRef, useState } from 'react'
import { Attachments } from './Attachments'
import { MessageActions } from './MessageActions'
import { MessageBody } from './MessageBody'
import Button from '@/react/components/Button'
import { messageStore } from '@/react/stores/messageStore'
import { useStore } from '@nanostores/react'
import ProgressBar from '@/react/components/ProgressBar'
import MarkdownParser from '@/react/components/MarkdownParser'
import FileEditMessage from '@/react/components/FileEditMessage'

export type Props = {
  message?: ChatMessage
  pos: { i: number; len: number }
}

const Message = (props: Props) => {
  const { message } = props
  if (!message) return <MessageLoading />

  if (message.role == 'assistant' && message.intent == Intent.EDIT_FILES)
    return <FileEditMessage message={message} />

  return (
    <>
      <div className="flex group mx-auto w-[768px] max-w-full">
        <MessageContents {...props} />
        <MessageActions {...props} />
      </div>
    </>
  )
}

const MessageLoading = () => {
  const partialMessage = useStore(messageStore.partialMessage)

  let bg = 'bg-blue-100'
  let partialContent: undefined | string | JSX.Element = partialMessage

  if (partialMessage && partialMessage.startsWith('PLAN:')) {
    bg = 'bg-yellow-100'
    partialContent = (
      <>
        <b>Action Plan:</b>
        {partialMessage.substring(5)}
      </>
    )
  } else if (partialMessage && partialMessage.startsWith('{')) {
    bg = 'bg-yellow-100'
    partialContent = (
      <>
        <b>Generating change operations...</b>
        <pre
          className="mt-4 whitespace-pre-wrap rounded bg-slate-950 p-2
            overflow-x-scroll text-xs text-slate-100"
        >
          {partialMessage}
        </pre>
      </>
    )
  }

  return (
    <div className="mr-8 mx-auto w-[768px] max-w-full">
      <div className={`flex-1 ${bg} p-4 shadow-md rounded whitespace-pre-wrap`}>
        {partialContent}
        <div className="dot-flashing ml-4 my-2" />
      </div>
      <div className="flex gap-4 text-sm items-center mt-4 text-gray-700">
        <div>Feel free to switch tabs, we'll play a ding when a new message arrives.</div>
        <a
          href="#"
          className="text-red-400 p-2 hover:bg-gray-300 rounded"
          onClick={() => messageStore.interruptRequest()}
        >
          Interrupt request?
        </a>
      </div>
    </div>
  )
}

const MessageContents = ({ message, pos }: Props) => {
  const autoExpand = pos.i >= pos.len - 2
  const [expanded, setExpanded] = useState(autoExpand)
  const contentRef = useRef<HTMLDivElement>(null)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (!contentRef.current) return
    const threshold = contentRef.current.scrollHeight - contentRef.current.offsetHeight
    setHasMore(threshold > 20)
    setExpanded(threshold <= 20)
  }, [message])

  if (!message) return null

  const content = message.content || ''
  let output = content
  let bgColor = 'bg-blue-300'
  let postMessageAction: JSX.Element | undefined

  if (message.role == 'user') {
    bgColor = 'bg-slate-100'
  } else if (message.role == 'system') {
    bgColor = 'bg-green-300'
  } else if (content.startsWith('Thought:')) {
    const thought = content.substring(9)
    bgColor = 'bg-blue-100'
    output = `*Thought*: ${thought}`
  } else if (content.startsWith('PLAN:')) {
    bgColor = 'bg-yellow-200'
    const proposal = content.substring(5)
    output = `**Action Plan**${proposal}*`
    postMessageAction = <ConfirmAction />
  } else if (content.startsWith('RESEARCH:')) {
    bgColor = 'bg-yellow-200'
    const ask = content.substring(9)
    output = `**Research Request:**\n\n${ask}`
  } else if (content.startsWith('SUGGESTION:')) {
    bgColor = 'bg-green-200'
    const ask = content.substring(11)
    output = `**Suggested Approach:**\n\n${ask}`
  } else if (content.startsWith('ANSWER:')) {
    const answer = content.substring(7)
    output = answer
    postMessageAction = <PossibleAction />
  } else if (content.startsWith('OUTCOME:')) {
    const answer = content.substring(8)
    bgColor = 'bg-green-200'
    output = answer
  } else if (message.intent == Intent.EDIT_FILES) {
    bgColor = 'bg-yellow-200'
  } else if (message.intent == Intent.ANSWER) {
    // if this is an answer, but it has a code block, then it's a possible action
    if (content.includes('```') && messageStore.messages.get().find((m) => m.attachments?.length)) {
      postMessageAction = <PossibleAction />
    }
    bgColor = 'bg-blue-200'
  }

  return (
    <div className="overflow-hidden">
      <div className={`flex-1 ${bgColor} shadow-md rounded-md relative overflow-hidden message`}>
        <div
          ref={contentRef}
          className={(expanded ? '' : 'max-h-60 ') + 'p-4 overflow-hidden ease-out'}
        >
          <MessageBody message={message} content={output} />

          {message.progressDuration !== undefined && (
            <ProgressBar
              start={message.progressStart || Date.now()}
              duration={message.progressDuration}
              className="mt-1"
            />
          )}

          {message.attachments && <Attachments attachments={message.attachments} />}

          {message.buttons && <MessageButtons message={message} />}
        </div>

        {hasMore && !expanded && (
          <div
            onClick={() => setExpanded(true)}
            className={`absolute bottom-0 left-0 right-0 text-center cursor-pointer bg-gray-200/80 p-1`}
          >
            Click to view full message
          </div>
        )}
      </div>
      {pos.i == pos.len - 1 ? postMessageAction : null}
    </div>
  )
}

function PossibleAction() {
  const onClick = () => {
    messageStore.sendMessage({
      content: 'Take action',
      role: 'user',
      intent: Intent.EDIT_FILES,
    })
  }
  return (
    <div className="flex justify-center items-center mt-4 gap-2">
      <Button className="bg-blue-500 hover:bg-blue-600" onClick={onClick}>
        Take action?
      </Button>
      <div>or, type below to continue conversation</div>
    </div>
  )
}

function MessageButtons({ message }: { message: ChatMessage }) {
  const buttons = message.buttons || []
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {buttons.map((button, i) => (
        <Button
          key={i}
          className={
            button.action == 'cancel'
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-blue-500 hover:bg-blue-600'
          }
          onClick={() => messageStore.handleMessageButton(message, button)}
        >
          {button.label}
        </Button>
      ))}
    </div>
  )
}

function ConfirmAction() {
  const onClick = () => {
    messageStore.sendMessage({
      content: 'Proceed',
      role: 'user',
      intent: Intent.EDIT_FILES,
    })
  }
  return (
    <div className="flex justify-center items-center mt-4 gap-2">
      <Button className="bg-blue-500 hover:bg-blue-600" onClick={onClick}>
        Proceed
      </Button>
      <div>or, type below to change the plan</div>
    </div>
  )
}

export default Message
