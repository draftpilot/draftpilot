import CodeActions from '@/react/components/CodeActions'
import { ChatMessage } from '@/types'
import { fuzzyParseJSON, splitOnce } from '@/utils/utils'
import { ClipboardIcon } from '@heroicons/react/24/outline'
import hljs from 'highlight.js/lib/common'
import { Fragment, useEffect, useRef, useState } from 'react'
import MarkdownParser from './MarkdownParser'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer'
import { API } from '@/react/api/api'
import { applyOps } from '@/utils/editOps'
import Loader from '@/react/components/Loader'

export default function FileEditMessage({ message }: { message: ChatMessage }) {
  const content = message.content

  const jsonStart = content.indexOf('{')
  const preContent = content.slice(0, jsonStart).replace(/```.*/g, '').trim()
  const jsonEnd = content.lastIndexOf('}')
  const jsonContent = content.slice(jsonStart, jsonEnd + 1)
  const postContent = content
    .slice(jsonEnd + 1)
    .replace(/```.*/g, '')
    .trim()

  const json = fuzzyParseJSON(jsonContent)

  return (
    <div className="flex flex-col gap-4">
      <TextContent content={preContent} />
      {!json && (
        <div className="flex-1 bg-red-600 text-white shadow-md rounded message p-4">
          Error parsing JSON content
        </div>
      )}
      {json && Object.keys(json).map((key) => <DiffContent key={key} file={key} ops={json[key]} />)}
      <TextContent content={postContent} />
    </div>
  )
}

function TextContent({ content }: { content: string }) {
  if (!content) return null

  return (
    <div className="flex-1 shadow-md rounded message p-4 mx-auto w-[768px] max-w-full">
      {content}
    </div>
  )
}

function DiffContent({ file, ops }: { file: string; ops: any[] }) {
  const [oldCode, setOldCode] = useState<string | null>(null)
  const [newCode, setNewCode] = useState<string | null>(null)

  useEffect(() => {
    API.loadFile(file).then((res) => {
      setOldCode(res.file)

      const applied = applyOps(res.file, ops)
      setNewCode(applied)
    })
  }, [file, ops])

  return (
    <div className="diff-view shadow-md text-xs flex-1 max-w-full overflow-x-auto">
      {!oldCode || (!newCode && <Loader />)}
      {oldCode && newCode && (
        <ReactDiffViewer
          oldValue={oldCode}
          newValue={newCode}
          compareMethod={DiffMethod.LINES}
          renderContent={HighlightedCode}
          leftTitle={file}
          splitView
        />
      )}
    </div>
  )
}

function HighlightedCode(children: string) {
  return <Code children={children} />
}

function Code({ children }: { children: string }) {
  const ref = useRef<HTMLPreElement | null>(null)
  useEffect(() => {
    if (!ref.current) return
    hljs.highlightBlock(ref.current)
  }, [children])

  return (
    <pre className="inline" ref={ref}>
      {children}
    </pre>
  )
}
