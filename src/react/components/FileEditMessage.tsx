import hljs from 'highlight.js/lib/common'
import { useEffect, useState } from 'react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer'

import { extToLanguage } from '@/context/language'
import { API } from '@/react/api/api'
import Button from '@/react/components/Button'
import Loader from '@/react/components/Loader'
import { messageStore } from '@/react/stores/messageStore'
import { ChatMessage } from '@/types'
import { applyOps, Op } from '@/utils/editOps'
import { fuzzyParseJSON } from '@/utils/utils'

import FileEditor from './FileEditor'

type DiffState = 'accepted' | 'rejected' | 'edited' | undefined

type DiffMap = { [file: string]: DiffState }
type CodeMap = { [file: string]: string }

type EditPlan = { [file: string]: string | Op[] }

export default function FileEditMessage({ message }: { message: ChatMessage }) {
  const content = message.content
  const [diffMap, setDiffMap] = useState<DiffMap>(message.state || {})
  const [codeMap, setCodeMap] = useState<CodeMap>({})

  let preContent: string | undefined
  let postContent: string | undefined
  let plan: EditPlan | null
  if (typeof content == 'string') {
    const jsonStart = content.indexOf('{')
    if (jsonStart == -1) return <TextContent content={content} />

    preContent = content.slice(0, jsonStart).replace(/```.*/g, '').trim()
    const jsonEnd = content.lastIndexOf('}')
    const jsonContent = content.slice(jsonStart, jsonEnd + 1)
    postContent = content
      .slice(jsonEnd + 1)
      .replace(/```.*/g, '')
      .trim()
    plan = fuzzyParseJSON(jsonContent)
  } else {
    plan = content
  }

  const onSetState = (file: string, state: DiffState) => {
    const newMap = { ...diffMap, [file]: state }
    setDiffMap(newMap)
    message.state = newMap
    messageStore.onUpdateSingleMessage(message)
  }

  const allDecided =
    plan &&
    Object.keys(diffMap).length &&
    Object.keys(diffMap).every((k) => k == SAVED_KEY || diffMap[k] !== undefined) &&
    Object.keys(diffMap).length >= Object.keys(plan).length

  return (
    <div className="flex flex-col gap-4">
      {preContent && <TextContent content={preContent} />}
      {(!plan || Object.keys(plan).length == 0) && (
        <div className="flex-1 bg-red-600 text-white shadow-md rounded message p-4">
          Error parsing JSON content
        </div>
      )}
      {plan &&
        Object.keys(plan).map((key) => (
          <DiffContent
            key={key}
            file={key}
            ops={plan![key]}
            stateMap={diffMap}
            setState={(state) => onSetState(key, state)}
            setCode={(code) => setCodeMap({ ...codeMap, [key]: code })}
          />
        ))}
      {postContent && <TextContent content={postContent} />}
      {allDecided && <PostDiffActions code={codeMap} state={diffMap} setState={onSetState} />}
    </div>
  )
}

function TextContent({ content }: { content: string }) {
  if (!content) return null

  return (
    <div className="mx-auto w-[768px] max-w-full">
      <div className="shadow-md rounded message p-4">{content}</div>
    </div>
  )
}

const SAVED_KEY = 'saved'

function DiffContent({
  file,
  ops,
  stateMap,
  setState,
  setCode,
}: {
  file: string
  ops: string | Op[]
  stateMap: DiffMap
  setState: (state: DiffState) => void
  setCode: (code: string) => void
}) {
  const [oldCode, setOldCode] = useState<string | null>(null)
  const [newCode, setNewCode] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [splitView, setSplitView] = useState(false)

  const state = stateMap[file]

  useEffect(() => {
    API.loadFile(file).then((res) => {
      setOldCode(res.file)
    })
  }, [file])

  useEffect(() => {
    if (oldCode == null) return
    ;(async () => {
      try {
        const applied = stateMap[SAVED_KEY]
          ? oldCode
          : Array.isArray(ops)
          ? await applyOps(oldCode, ops, null)
          : ops
        setNewCode(applied)
        setCode(applied)
      } catch (e: any) {
        setNewCode(e.message || e.toString())
      }
    })()
  }, [oldCode, ops])

  const ext = file.split('.').pop()
  const language = extToLanguage['.' + ext!]

  if (editing) {
    return (
      <FileEditor
        file={file}
        language={language}
        code={newCode!}
        setCode={(code) => {
          setCode(code)
          setNewCode(code)
        }}
        setEditing={setEditing}
      />
    )
  }

  return (
    <div>
      {state ? null : newCode == null ? (
        <Loader className="text-black mx-auto my-4" />
      ) : (
        <div className="diff-view mb-4 shadow-md text-xs flex-1 max-w-full overflow-x-auto">
          <ReactDiffViewer
            oldValue={oldCode || ''}
            newValue={newCode!}
            compareMethod={DiffMethod.LINES}
            renderContent={(line) => <Code language={language} code={line} />}
            leftTitle={file}
            splitView={splitView}
          />
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
        {!state && (
          <Button onClick={() => setState('accepted')} className="bg-blue-600">
            Accept Diff
          </Button>
        )}
        {!state && (
          <Button onClick={() => setState('rejected')} className="bg-red-600">
            Reject Diff
          </Button>
        )}
        {state && (
          <Button onClick={() => setState(undefined)} className="bg-gray-600">
            Review Diff
          </Button>
        )}
        {!state && (
          <>
            <Button onClick={() => setSplitView(!splitView)} className="bg-gray-600">
              Toggle Split View
            </Button>

            <Button className="bg-gray-600" onClick={() => setEditing(true)}>
              Edit File
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function Code({ code, language }: { code: string; language: string }) {
  if (!code) return null

  const html = hljs.highlight(code, { language: language || 'plaintext' }).value
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: html,
      }}
    />
  )
}

function PostDiffActions({
  code,
  state,
  setState,
}: {
  code: CodeMap
  state: DiffMap
  setState: (file: string, state: DiffState) => void
}) {
  const allRejected = Object.values(state).every((v) => v == 'rejected')

  if (allRejected) {
    return (
      <div className="flex justify-center my-4 gap-4 mx-auto w-[768px] max-w-full">
        You rejected all changes.
      </div>
    )
  }

  // you already did this
  if (state[SAVED_KEY])
    return (
      <div className="text-xl font-bold flex items-center justify-center my-4 gap-4 mx-auto w-[768px] max-w-full">
        Changes persisted!
        <a
          href="#"
          onClick={() => setState(SAVED_KEY, undefined)}
          className="text-gray-500 hover:underline text-sm"
        >
          (Reset)
        </a>
      </div>
    )

  const save = () => {
    Object.keys(state).forEach((file) => {
      if (state[file] == 'accepted') API.saveFile(file, code[file])
    })
    setState(SAVED_KEY, 'accepted')
  }

  return (
    <div className="text-xl font-bold flex justify-center my-4 gap-4 mx-auto w-[768px] max-w-full">
      <Button onClick={save} className="bg-blue-600">
        Persist all changes?
      </Button>
    </div>
  )
}
