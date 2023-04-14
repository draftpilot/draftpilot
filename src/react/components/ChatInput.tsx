import ReactTextareaAutocomplete, { TriggerType } from '@webscopeio/react-textarea-autocomplete'
import { fileStore } from '@/react/stores/fileStore'
import { messageStore } from '@/react/stores/messageStore'
import { PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef } from 'react'
import { useStore } from '@nanostores/react'
import Loader from '@/react/components/Loader'

export default () => {
  const rtaRef = useRef<ReactTextareaAutocomplete<string> | null>(null)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const inProgress = useStore(messageStore.inProgress)

  useEffect(() => {
    if (!ref.current) return
    fileStore.loadData()
    ref.current.focus()
  }, [ref.current])

  const send = () => {
    if (!ref.current || !ref.current.value || !rtaRef.current) return
    if (inProgress) return

    messageStore.sendMessage({ content: ref.current.value, role: 'user' })
    rtaRef.current.setState({ value: '' })
  }

  const trigger: TriggerType<string> = {
    '/': {
      dataProvider: async (token: string) => {
        return fileStore.search(token)
      },
      component: FileRow,
      output: (entity: string) => entity,
    },
  }

  const loadingComponent = () => <div>Loading...</div>

  const placeholder = inProgress ? 'Sending...' : 'Type "/" to reference a file'

  return (
    <div className="bg-white shadow-md rounded flex relative mt-4">
      <ReactTextareaAutocomplete<string>
        ref={rtaRef}
        containerClassName="flex-1"
        autoFocus
        trigger={trigger}
        placeholder={placeholder}
        loadingComponent={loadingComponent}
        innerRef={(textarea: HTMLTextAreaElement) => (ref.current = textarea)}
        className="p-4 w-full focus:ring-0 focus-visible:ring-0"
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
  )
}

const FileRow = ({ selected, entity }: { selected: boolean; entity: string }) => (
  <div className={`p-2 ${selected ? 'bg-blue-200' : ''}`}>{entity}</div>
)
