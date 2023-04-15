import { Attachment, ChatMessage } from '@/types'
import { splitOnce } from '@/utils/utils'
import {
  ClipboardIcon,
  DocumentIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  RectangleStackIcon,
  WrenchIcon,
} from '@heroicons/react/24/outline'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'
import { useEffect, useRef, useState } from 'react'
import snarkdown from 'snarkdown'

type Props = {
  message?: ChatMessage
  loading?: boolean
}

const Message = ({ message, loading }: Props) => {
  const [expanded, setExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (!contentRef.current) return
    const threshold = contentRef.current.scrollHeight - contentRef.current.offsetHeight
    setHasMore(threshold > 20)
    setExpanded(threshold <= 20 && threshold > 0)
  }, [message])

  if (loading || !message)
    return (
      <div className={`bg-blue-100 p-4 shadow-md rounded`}>
        <div className="dot-flashing ml-4 my-2" />
      </div>
    )

  if (message.role == 'user') {
    return (
      <div className={`bg-white p-4 shadow-md rounded whitespace-pre-wrap`}>{message.content}</div>
    )
  }

  let content = message.content
  let output: string = content
  let bgColor = 'blue-300'

  if (content.startsWith('Thought:')) {
    const thought = content.substring(9)
    bgColor = 'blue-100'
    output = `*Thought*: ${thought}`
  } else if (content.startsWith('CONFIRM:')) {
    bgColor = 'red-200'
    const proposal = content.substring(9)
    output = `### Confirm Action?\n\n${proposal}*`
  } else if (content.startsWith('ASK:')) {
    bgColor = 'yellow-200'
    const ask = content.substring(5)
    output = `### Question:\n\n${ask}*`
  } else if (content.startsWith('ANSWER:')) {
    const answer = content.substring(7)
    output = answer
  }

  const contentBlocks = splitCodeBlocks(output)

  return (
    <div className={`bg-${bgColor} shadow-md rounded relative`}>
      <div
        ref={contentRef}
        className={(expanded ? '' : 'max-h-60') + ' p-4 overflow-hidden ease-out'}
      >
        {contentBlocks.map((block, i) => {
          if (block.type === 'text') {
            return <Text key={i} children={block.content} />
          } else {
            return <Code key={i} language={block.language} children={block.content} />
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
      ? DocumentIcon
      : attachment.type == 'observation'
      ? attachment.name.startsWith('find')
        ? MagnifyingGlassIcon
        : attachment.name.startsWith('list')
        ? RectangleStackIcon
        : attachment.name.startsWith('view')
        ? DocumentIcon
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
