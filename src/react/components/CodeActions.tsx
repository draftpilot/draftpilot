import { ChatMessage } from '@/types'

type Props = {
  code: string
  message: ChatMessage
}

export default ({ code, message }: Props) => {
  const buttonClass = 'p-2 rounded bg-gray-600 text-white cursor-pointer hover:bg-gray-700'
  return (
    <div className="flex justify-center items-center mb-2 gap-2">
      <button className={buttonClass}>Copy to Clipboard</button>
      <button className={buttonClass}>Merge into file</button>
    </div>
  )
}
