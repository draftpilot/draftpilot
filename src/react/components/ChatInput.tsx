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

import EncouragingInput from '@/react/components/EncouragingInput'
import { Attachments } from '@/react/components/Attachments'
export default ({ initialMessage }: { initialMessage?: boolean }) => {
  const rtaRef = useRef<ReactTextareaAutocomplete<string> | null>(null)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const inProgress = useStore(messageStore.inProgress)
  const session = useStore(messageStore.session)
  const editMessage = useStore(messageStore.editMessage)
  const attachments = useStore(messageStore.attachments)

  const [value, setValue] = useState('')

  useEffect(() => {
    fileStore.loadData()
  }, [])

  useEffect(() => {
    if (editMessage) {
      setValue(editMessage.content)
      messageStore.attachments.set(editMessage.attachments || [])
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

    fileStore.clearMerge()
    messageStore.sendMessage({
      content: ref.current.value,
      role: 'user',
      attachments,
    })
    setValue('')
  }, [inProgress, attachments])

  const trigger: TriggerType<string> = useMemo(
    () => ({
      '@': {
        dataProvider: async (token: string) => {
          return fileStore.search(token)
        },
        component: FileRow,
        output: (entity: string) => {
          messageStore.attachFile(entity)
          fileStore.selectedFile.set(entity)
          return entity
        },
      },
    }),
    []
  )

  const loadingComponent = useCallback(() => <div>Loading...</div>, [])

  useAutosizeTextArea(ref.current, value)

  const intent = useStore(messageStore.intent)
  const firstMessage = useStore(messageStore.messages).length == 0

  const placeholder = inProgress
    ? 'Sending...'
    : firstMessage
    ? (intent == Intent.CRASHPILOT
        ? 'Paste a stack trace or describe the bug to fix.'
        : intent == Intent.CHAT
        ? 'Ask a question or generate some code.'
        : intent == Intent.PRODUCT
        ? 'Get product and user-related advice.'
        : 'What would you like to create today?') + ' Type "@" to reference a file'
    : 'Type a response. Use "@" to reference a file'

  if (intent == Intent.TESTPILOT) {
    return <div className="text-center text-gray-500">This feature is coming soon.</div>
  }

  return (
    <div className="">
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
      {initialMessage && <EncouragingInput value={value} />}
      {attachments?.length > 0 && <Attachments attachments={attachments} canDelete />}
      <div className="flex my-2 gap-4 text-sm">
        <span>
          <b>Mode:</b>{' '}
          {!intent
            ? 'Automatic'
            : intent == Intent.EDIT_FILES
            ? 'Edit Files'
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
        {intent == Intent.EDIT_FILES && (
          <a
            href="#"
            className="text-blue-600 cursor-pointer"
            onClick={() => messageStore.intent.set(Intent.DRAFTPILOT)}
          >
            Return to Planning Mode
          </a>
        )}
      </div>
    </div>
  )
}

const FileRow = ({ selected, entity }: { selected: boolean; entity: string }) => (
  <div className={`p-2 ${selected ? 'bg-blue-200' : ''}`}>{entity}</div>
)
