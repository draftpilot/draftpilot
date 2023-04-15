import ReactTextareaAutocomplete, { TriggerType } from '@webscopeio/react-textarea-autocomplete'
import { fileStore } from '@/react/stores/fileStore'
import { messageStore } from '@/react/stores/messageStore'
import { PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'
import Loader from '@/react/components/Loader'
import Checkbox from '@/react/components/Checkbox'
import useAutosizeTextArea from '@/react/hooks/useAutosizeTextArea'

export default () => {
  const rtaRef = useRef<ReactTextareaAutocomplete<string> | null>(null)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const inProgress = useStore(messageStore.inProgress)

  const [useTools, setUseTools] = useState(true)
  const [useGPT4, setUseGPT4] = useState(false)

  const [value, setValue] = useState('')

  useEffect(() => {
    if (!ref.current) return
    fileStore.loadData()
    ref.current.focus()
  }, [ref.current])

  const send = useCallback(() => {
    if (!ref.current || !ref.current.value || !rtaRef.current) return
    if (inProgress) return

    const options = { tools: useTools, model: useGPT4 ? '4' : '3.5' }
    messageStore.sendMessage({ content: ref.current.value, role: 'user' }, options)
    setValue('')
  }, [useTools, useGPT4, inProgress])

  const trigger: TriggerType<string> = useMemo(
    () => ({
      '@': {
        dataProvider: async (token: string) => {
          return fileStore.search(token)
        },
        component: FileRow,
        output: (entity: string) => entity,
      },
    }),
    []
  )

  const loadingComponent = useCallback(() => <div>Loading...</div>, [])

  const placeholder = inProgress ? 'Sending...' : 'Type "@" to reference a file'

  useAutosizeTextArea(ref.current, value)

  return (
    <div className="my-4">
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
          dropdownClassName="bg-white shadow-md rounded absolute w-full"
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
      <div className="flex my-2 gap-4">
        <Checkbox label="Use codebase tools" setChecked={setUseTools} checked={useTools} />
        <Checkbox label="Use GPT-4" setChecked={setUseGPT4} checked={useGPT4} />
      </div>
    </div>
  )
}

const FileRow = ({ selected, entity }: { selected: boolean; entity: string }) => (
  <div className={`p-2 ${selected ? 'bg-blue-200' : ''}`}>{entity}</div>
)
