import ReactTextareaAutocomplete, { TriggerType } from '@webscopeio/react-textarea-autocomplete'
import { fileStore } from '@/react/stores/fileStore'
import { messageStore } from '@/react/stores/messageStore'
import { PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef } from 'react'

export default () => {
  const rtaRef = useRef<ReactTextareaAutocomplete<string> | null>(null)
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!ref.current) return
    fileStore.loadData()
    ref.current.focus()
  }, [ref.current])

  const send = () => {
    if (!ref.current || !ref.current.value) return

    messageStore.addMessage({ content: ref.current.value, role: 'user' })
    ref.current.value = ''
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

  return (
    <div className="bg-white shadow-md rounded flex relative">
      <ReactTextareaAutocomplete<string>
        ref={rtaRef}
        containerClassName="flex-1"
        autoFocus
        trigger={trigger}
        placeholder='Type "/" to reference a file or folder'
        loadingComponent={loadingComponent}
        innerRef={(textarea: HTMLTextAreaElement) => (ref.current = textarea)}
        className="p-4 w-full focus-visible:ring-0"
        dropdownClassName="bg-white shadow-md rounded absolute w-full"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
          }
        }}
      />
      <div
        className="hover:bg-gray-400 text-gray-500 hover:text-gray-800 mx-2 my-2 self-end cursor-pointer"
        onClick={send}
      >
        <PaperAirplaneIcon className="w-6 h-6 " />
      </div>
    </div>
  )
}

const FileRow = ({ selected, entity }: { selected: boolean; entity: string }) => (
  <div className={`p-2 ${selected ? 'bg-blue-200' : ''}`}>{entity}</div>
)
