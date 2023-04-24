import ReactTextareaAutocomplete, { TriggerType } from '@webscopeio/react-textarea-autocomplete'
import { fileStore } from '@/react/stores/fileStore'
import { messageStore } from '@/react/stores/messageStore'
import { PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'
import Loader from '@/react/components/Loader'
import Checkbox from '@/react/components/Checkbox'
import useAutosizeTextArea from '@/react/hooks/useAutosizeTextArea'
import { Attachment, Intent } from '@/types'

export default () => {
  const rtaRef = useRef<ReactTextareaAutocomplete<string> | null>(null)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const inProgress = useStore(messageStore.inProgress)
  const session = useStore(messageStore.session)
  const editMessage = useStore(messageStore.editMessage)

  const [useTools, setUseTools] = useState(true)
  const [useGPT4, setUseGPT4] = useState(false)

  const [value, setValue] = useState('')
  const filesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    fileStore.loadData()
  }, [])

  useEffect(() => {
    if (editMessage) {
      setValue(editMessage.content)
      if (editMessage.attachments)
        filesRef.current = new Set(editMessage.attachments.map((a) => a.name))
      ref.current?.focus()
    }
  }, [editMessage])

  useEffect(() => {
    ref.current?.focus()
  }, [session.id])

  const send = useCallback(() => {
    if (!ref.current || !rtaRef.current) return
    if (inProgress) {
      messageStore.interruptRequest()
      return
    }
    const message = ref.current.value
    if (!message) return

    const toAttach: Attachment[] = Array.from(filesRef.current)
      .filter((f) => message.includes(f))
      .map((f) => ({
        type: 'file',
        name: f,
      }))
    fileStore.clearMerge()
    messageStore.sendMessage({
      content: ref.current.value,
      role: 'user',
      attachments: toAttach,
      options: { tools: useTools, model: useGPT4 ? '4' : '3.5' },
    })
    setValue('')
    filesRef.current.clear()
  }, [useTools, useGPT4, inProgress])

  const trigger: TriggerType<string> = useMemo(
    () => ({
      '@': {
        dataProvider: async (token: string) => {
          return fileStore.search(token)
        },
        component: FileRow,
        output: (entity: string) => {
          filesRef.current.add(entity)
          return entity
        },
      },
    }),
    []
  )

  const loadingComponent = useCallback(() => <div>Loading...</div>, [])

  useAutosizeTextArea(ref.current, value)

  const intent = useStore(messageStore.intent)

  const placeholder = inProgress
    ? 'Sending...'
    : (intent == Intent.CRASHPILOT
        ? 'Paste a bug report or crash log.'
        : 'What would you like to do?') + ' Type "@" to reference a file'

  if (intent == Intent.TESTPILOT) {
    return <div className="text-center text-gray-500">This feature is coming soon.</div>
  }

  return (
    <div className="pb-4 bg-gray-200">
      <div className="bg-white shadow-md rounded flex relative">
        <ReactTextareaAutocomplete<string>
          value={value}
          onChange={(e) => setValue(e.target.value)}
          ref={rtaRef}
          containerClassName="flex-1"
          autoFocus
          trigger={trigger}
          placeholder={placeholder}
          loadingComponent={loadingComponent}
          innerRef={(textarea: HTMLTextAreaElement) => (ref.current = textarea)}
          className="p-4 h-14 w-full focus:ring-0 focus-visible:ring-0"
          dropdownClassName="bg-white shadow-md rounded absolute z-10"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <div
          className=" text-gray-500 hover:text-gray-800 mx-2 my-2 self-end cursor-pointer"
          onClick={send}
        >
          {inProgress ? <Loader size={20} /> : <PaperAirplaneIcon className="w-6 h-6 " />}
        </div>
      </div>
      <div className="flex my-2 gap-4 text-sm">
        <span>
          <b>Mode:</b>{' '}
          {!intent
            ? 'Automatic'
            : intent == Intent.ACTION
            ? 'Take Action'
            : intent == Intent.PLANNER
            ? 'Planning'
            : intent == Intent.PRODUCT
            ? 'Product Manager'
            : intent == Intent.DRAFTPILOT
            ? 'Draftpilot'
            : intent == Intent.TESTPILOT
            ? 'Testpilot'
            : intent == Intent.CRASHPILOT
            ? 'Crashpilot'
            : 'Chat'}
        </span>
        {intent == Intent.PLANNER && (
          <a
            href="#"
            className="text-red-600 cursor-pointer"
            onClick={() => messageStore.intent.set(Intent.ACTION)}
          >
            Execution Mode
          </a>
        )}
        {intent != Intent.PLANNER && (
          <a
            href="#"
            className="text-blue-600 cursor-pointer"
            onClick={() => messageStore.intent.set(Intent.DRAFTPILOT)}
          >
            Planning Mode
          </a>
        )}
        {intent != Intent.PRODUCT && (
          <a
            href="#"
            className="text-blue-600 cursor-pointer"
            onClick={() => messageStore.intent.set(Intent.PRODUCT)}
          >
            Product Manager Mode
          </a>
        )}
        {intent && intent != Intent.CHAT && (
          <a href="#" onClick={() => messageStore.intent.set(Intent.ANSWER)}>
            Chat Mode
          </a>
        )}
      </div>
    </div>
  )
}

const FileRow = ({ selected, entity }: { selected: boolean; entity: string }) => (
  <div className={`p-2 ${selected ? 'bg-blue-200' : ''}`}>{entity}</div>
)
