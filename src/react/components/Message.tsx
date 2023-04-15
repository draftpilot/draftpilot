import Button from '@/react/components/Button'
import CodeActions from '@/react/components/CodeActions'
import { messageStore } from '@/react/stores/messageStore'
import { Attachment, ChatMessage } from '@/types'
import { splitOnce } from '@/utils/utils'
import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ChevronDoubleUpIcon,
  ClipboardIcon,
  DocumentIcon,
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  PencilIcon,
  RectangleStackIcon,
  RocketLaunchIcon,
  TrashIcon,
  WrenchIcon,
} from '@heroicons/react/24/outline'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'
import { Fragment, useEffect, useRef, useState } from 'react'
import snarkdown from 'snarkdown'

type Props = {
  message?: ChatMessage
}

const Message = ({ message }: Props) => {
  return (
    <div className="flex group">
      <MessageContents message={message} />
      <MessageActions message={message} />
    </div>
  )
}

const MessageContents = ({ message }: Props) => {
  const [expanded, setExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (!contentRef.current) return
    const threshold = contentRef.current.scrollHeight - contentRef.current.offsetHeight
    setHasMore(threshold > 20)
    setExpanded(threshold <= 20)
  }, [message])

  if (!message)
    return (
      <div className={`flex-1 bg-blue-100 p-4 shadow-md rounded`}>
        <div className="dot-flashing ml-4 my-2" />
      </div>
    )

  if (message.role == 'user') {
    return (
      <div className={`flex-1 bg-white p-4 shadow-md rounded`}>
        <span className="whitespace-pre-wrap">{message.content}</span>
        {message.attachments && <Attachments attachments={message.attachments} />}
      </div>
    )
  }

  let content = message.content
  let output: string = content
  let bgColor = message.role == 'system' ? 'bg-green-300' : 'bg-blue-300'

  if (content.startsWith('Thought:')) {
    const thought = content.substring(9)
    bgColor = 'bg-blue-100'
    output = `*Thought*: ${thought}`
  } else if (content.startsWith('CONFIRM:')) {
    bgColor = 'bg-red-200'
    const proposal = content.substring(9)
    output = `**Confirm Action?**\n\n${proposal}*`
  } else if (content.startsWith('ASK:')) {
    bgColor = 'bg-yellow-200'
    const ask = content.substring(5)
    output = `**Question:**\n\n${ask}`
  } else if (content.startsWith('ANSWER:')) {
    const answer = content.substring(7)
    output = answer
  }

  const contentBlocks = splitCodeBlocks(output)

  return (
    <div className={`flex-1 ${bgColor} shadow-md rounded relative overflow-hidden`}>
      <div
        ref={contentRef}
        className={(expanded ? '' : 'max-h-60 ') + 'p-4 overflow-hidden ease-out'}
      >
        {contentBlocks.map((block, i) => {
          if (block.type === 'text') {
            return <Text key={i} children={block.content} />
          } else {
            return (
              <Fragment key={i}>
                <Code language={block.language} children={block.content} />
                <CodeActions code={block.content} message={message} />
              </Fragment>
            )
          }
        })}

        {message.attachments && <Attachments attachments={message.attachments} />}
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
  )
}

function MessageActions({ message }: Props) {
  if (!message || message.role == 'system') return <div className="w-8" />

  const edit = () => {
    messageStore.editMessage.set(message)
  }

  const regenerate = () => {
    const history = messageStore.popMessages(message)
    messageStore.doCompletion({ message, history })
  }

  const useGPT4 = () => {
    const history = messageStore.popMessages(message)
    if (!message.options) message.options = {}
    message.options.model = '4'
    messageStore.doCompletion({ message, history })
  }

  const deleteMessage = () => {
    messageStore.deleteMessage(message)
  }

  if (message.role == 'user') {
    return (
      <div className="flex flex-col gap-2 invisible group-hover:visible" onClick={edit}>
        <Button className="hover:bg-gray-300" title="Edit input">
          <PencilIcon className="h-4 w-4 text-gray-500" />
        </Button>
      </div>
    )
  }

  if (message.role == 'assistant') {
    const options = message.options
    return (
      <div className="flex flex-col invisible group-hover:visible">
        {options?.model != '4' && (
          <Button className="hover:bg-gray-300" title="Use GPT-4" onClick={useGPT4}>
            <RocketLaunchIcon className="h-4 w-4 text-gray-500" />
          </Button>
        )}
        <Button className="hover:bg-gray-300" title="Regenerate" onClick={regenerate}>
          <ArrowPathIcon className="h-4 w-4 text-gray-500" />
        </Button>
        <Button className="hover:bg-gray-300" title="Delete" onClick={deleteMessage}>
          <TrashIcon className="h-4 w-4 text-gray-500" />
        </Button>
        {/* <Button className="hover:bg-gray-300" title="Good Answer">
          <HandThumbUpIcon className="h-4 w-4 text-gray-500" />
        </Button>
        <Button className="hover:bg-gray-300" title="Bad Answer">
          <HandThumbDownIcon className="h-4 w-4 text-gray-500" />
        </Button> */}
      </div>
    )
  }

  return null
}

function Text({ children }: { children: string }) {
  return (
    <div
      className="whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: snarkdown(children) }}
    />
  )
}

function Code({ language, children }: { language: string | undefined; children: string }) {
  const ref = useRef<HTMLPreElement | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    hljs.highlightBlock(ref.current)
  }, [children])

  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  return (
    <pre className="rounded overflow-x-auto text-sm my-2 relative">
      <div
        className={`absolute top-1 right-1 text-gray-400px-1 rounded hover:bg-white/10 
        flex ${copied ? 'text-green-500' : 'text-white'} items-center p-1 cursor-pointer`}
        onClick={copy}
      >
        <ClipboardIcon className="h-4 w-4 mr-2" />
        {copied ? 'copied' : 'copy'}
      </div>
      <code ref={ref}>{children}</code>
    </pre>
  )
}

type Block = {
  type: 'text' | 'code'
  language?: string
  content: string
}

function splitCodeBlocks(str: string): Block[] {
  const codeBlockRegex = /```([\s\S]*?)```/g
  const codeBlocks: Block[] = []
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(str)) !== null) {
    const codeBlock = match[1]
    const [language, codeContent] = splitOnce(codeBlock, '\n')
    const startIndex = match.index
    const endIndex = codeBlockRegex.lastIndex

    if (startIndex > lastIndex) {
      codeBlocks.push({
        type: 'text',
        content: str.substring(lastIndex, startIndex).trim(),
      })
    }

    codeBlocks.push({
      type: 'code',
      content: codeContent,
      language: language.trim(),
    })

    lastIndex = endIndex
  }

  if (lastIndex < str.length) {
    codeBlocks.push({
      type: 'text',
      content: str.substring(lastIndex).trim(),
    })
  }

  return codeBlocks
}

function Attachments({ attachments }: { attachments: Attachment[] }) {
  return (
    <div className="flex flex-row gap-2 flex-wrap mt-2">
      {attachments.map((attachment, i) => (
        <div key={i} className="bg-white p-2 shadow rounded flex items-center">
          <AttachmentBody attachment={attachment} />
        </div>
      ))}
    </div>
  )
}

function AttachmentBody({ attachment }: { attachment: Attachment }) {
  const Icon =
    attachment.type == 'file'
      ? DocumentTextIcon
      : attachment.type == 'observation'
      ? attachment.name.startsWith('find')
        ? MagnifyingGlassIcon
        : attachment.name.startsWith('list')
        ? RectangleStackIcon
        : attachment.name.startsWith('view')
        ? DocumentMagnifyingGlassIcon
        : WrenchIcon
      : PaperClipIcon

  return (
    <>
      <Icon className="h-4 w-4 text-gray-500 mr-2" />
      {attachment.name}
    </>
  )
}

export default Message
