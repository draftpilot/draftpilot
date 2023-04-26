import CodeActions from '@/react/components/CodeActions'
import { ChatMessage } from '@/types'
import { fuzzyParseJSON, splitOnce } from '@/utils/utils'
import { ClipboardIcon } from '@heroicons/react/24/outline'
import hljs from 'highlight.js/lib/common'
import { Fragment, useEffect, useRef, useState } from 'react'
import MarkdownParser from './MarkdownParser'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer'
import { API } from '@/react/api/api'
import { Op, applyOps } from '@/utils/editOps'
import Loader from '@/react/components/Loader'
import Button from '@/react/components/Button'

type DiffState = 'accepted' | 'rejected' | undefined

type DiffMap = { [file: string]: DiffState }

export default function FileEditMessage({ message }: { message: ChatMessage }) {
  const content = message.content
  const [diffMap, setDiffMap] = useState<DiffMap>({})

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
      {json &&
        Object.keys(json).map((key) => (
          <DiffContent
            key={key}
            file={key}
            ops={json[key]}
            state={diffMap[key]}
            setState={(state) => setDiffMap({ ...diffMap, [key]: state })}
          />
        ))}
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

function DiffContent({
  file,
  ops,
  state,
  setState,
}: {
  file: string
  ops: Op[]
  state: DiffState
  setState: (state: DiffState) => void
}) {
  const [oldCode, setOldCode] = useState<string | null>(null)
  const [newCode, setNewCode] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    API.loadFile(file).then((res) => {
      setOldCode(res.file)

      const applied = applyOps(res.file, ops)
      setNewCode(applied)
    })
  }, [file, ops])

  return (
    <div>
      {(!state || open) && (
        <div className="diff-view mb-4 shadow-md text-xs flex-1 max-w-full overflow-x-auto">
          {!oldCode || (!newCode && <Loader />)}
          {oldCode && newCode && (
            <ReactDiffViewer
              oldValue={oldCode}
              newValue={newCode}
              compareMethod={DiffMethod.LINES}
              renderContent={HighlightedCode}
              leftTitle={file}
              splitView={false}
            />
          )}
        </div>
      )}
      {state && (
        <div
          className={`p-4 mx-auto w-[768px] max-w-full ${
            state == 'accepted' ? 'text-green-700' : 'text-red-700'
          }`}
        >
          <code>
            {file} - changes {state}
          </code>
        </div>
      )}
      <div className="flex justify-center my-4 gap-4 mx-auto w-[768px] max-w-full">
        {state != 'accepted' && (
          <Button onClick={() => setState('accepted')} className="bg-blue-600">
            Accept Diff
          </Button>
        )}
        {state != 'rejected' && (
          <Button onClick={() => setState('rejected')} className="bg-red-600">
            Reject Diff
          </Button>
        )}
        {state && (
          <Button onClick={() => setOpen(!open)} className="bg-gray-600">
            Toggle Diff
          </Button>
        )}
        <Button className="bg-gray-600">Edit File</Button>
      </div>
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
