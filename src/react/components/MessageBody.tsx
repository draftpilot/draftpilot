import CodeActions from '@/react/components/CodeActions'
import { ChatMessage } from '@/types'
import { splitOnce } from '@/utils/utils'
import { ClipboardIcon } from '@heroicons/react/24/outline'
import hljs from 'highlight.js/lib/common'
import { Fragment, useEffect, useRef, useState } from 'react'
import MarkdownParser from './MarkdownParser'

export function MessageBody({ message, content }: { message: ChatMessage; content: string }) {
  const contentBlocks = splitCodeBlocks(content)

  return (
    <>
      {contentBlocks.map((block, i) => {
        if (block.type === 'text') {
          if (message.role === 'user') {
            // user isn't writing markdown
            return <div className="whitespace-pre-wrap">{block.content}</div>
          } else {
            return <MarkdownParser key={i} inputString={block.content} />
          }
        } else {
          return (
            <Fragment key={i}>
              <Code language={block.language} children={block.content} />
              <CodeActions code={block.content} message={message} />
            </Fragment>
          )
        }
      })}
    </>
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
