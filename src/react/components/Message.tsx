import { Attachment, ChatMessage } from '@/types'
import {
  DocumentIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  RectangleStackIcon,
  WrenchIcon,
} from '@heroicons/react/24/outline'

type Props = {
  message?: ChatMessage
  fromUser?: boolean
  loading?: boolean
}

const Message = ({ message, fromUser, loading }: Props) => {
  let bgColor = fromUser ? 'bg-white' : 'bg-blue-300'

  if (loading || !message)
    return (
      <div className={`bg-blue-100 p-4 shadow-md rounded`}>
        <div className="dot-flashing ml-4 my-2" />
      </div>
    )

  let content = message.content
  let output: string | JSX.Element = message.content
  if (content.startsWith('Thought:')) {
    bgColor = 'bg-blue-100'
    output = <span className="italic">{content}</span>
  } else if (content.startsWith('CONFIRM:')) {
    bgColor = 'bg-red-200'
    const proposal = content.substring(9)
    output = (
      <>
        <div className="font-bold">Confirm Action?</div>
        {proposal}
      </>
    )
  } else if (content.startsWith('ASK:')) {
    bgColor = 'bg-yellow-200'
    const ask = content.substring(5)
    output = (
      <>
        <div className="font-bold">Question:</div>
        {ask}
      </>
    )
  } else if (content.startsWith('ANSWER:')) {
    const answer = content.substring(7)
    output = <>{answer}</>
  }

  return (
    <div className={`${bgColor} p-4 shadow-md rounded`}>
      <span className="whitespace-pre-wrap">{output}</span>
      {message.attachments && <Attachments attachments={message.attachments} />}
    </div>
  )
}

function Attachments({ attachments }: { attachments: Attachment[] }) {
  return (
    <div className="flex flex-row gap-2 flex-wrap mt-2">
      {attachments.map((attachment, i) => (
        <div key={i} className="bg-white p-2 shadow rounded flex items-center">
          <AttachmentBody attachment={attachment} />
        </div>
      ))}
    </div>
  )
}

function AttachmentBody({ attachment }: { attachment: Attachment }) {
  const Icon =
    attachment.type == 'file'
      ? DocumentIcon
      : attachment.type == 'observation'
      ? attachment.name.startsWith('find')
        ? MagnifyingGlassIcon
        : attachment.name.startsWith('list')
        ? RectangleStackIcon
        : attachment.name.startsWith('view')
        ? DocumentIcon
        : WrenchIcon
      : PaperClipIcon

  return (
    <>
      <Icon className="h-4 w-4 text-gray-500 mr-2" />
      {attachment.name}
    </>
  )
}

export default Message
