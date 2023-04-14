import Textarea from '@/react/components/Textarea'
import { messageStore } from '@/react/stores/messageStore'
import { PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef } from 'react'

export default () => {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!ref.current) return

    ref.current.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        send()
      }
    })
  }, [ref.current])

  const send = () => {
    if (!ref.current || !ref.current.value) return

    messageStore.addMessage({ content: ref.current.value, role: 'user' })
    ref.current.value = ''
  }

  return (
    <div className="bg-white shadow-md rounded flex">
      <Textarea innerRef={ref} className="p-4 w-full focus-visible:ring-0" />
      <div
        className="hover:bg-gray-400 text-gray-500 hover:text-gray-800 mx-2 my-2 self-end cursor-pointer"
        onClick={send}
      >
        <PaperAirplaneIcon className="w-6 h-6 " />
      </div>
    </div>
  )
}
