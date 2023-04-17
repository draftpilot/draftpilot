import Button from '@/react/components/Button'
import { messageStore } from '@/react/stores/messageStore'
import { ArrowPathIcon, PencilIcon, RocketLaunchIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Props } from './Message'

export function MessageActions({ message }: Props) {
  if (!message || message.role == 'system') return <div className="w-8" />

  const edit = () => {
    messageStore.editMessage.set(message)
  }

  const regenerate = () => {
    const history = messageStore.popMessages(message)
    messageStore.doCompletion({ message, history })
  }

  const useGPT4 = () => {
    const history = messageStore.popMessages(message)
    if (!message.options) message.options = {}
    message.options.model = '4'
    messageStore.doCompletion({ message, history })
  }

  const deleteMessage = () => {
    messageStore.deleteMessage(message)
  }

  if (message.role == 'user') {
    return (
      <div className="flex flex-col -mt-1 invisible group-hover:visible" onClick={edit}>
        <Button className="hover:bg-gray-300" title="Edit input">
          <PencilIcon className="h-4 w-4 text-gray-500" />
        </Button>
        <Button className="hover:bg-gray-300" title="Delete" onClick={deleteMessage}>
          <TrashIcon className="h-4 w-4 text-gray-500" />
        </Button>
      </div>
    )
  }

  if (message.role == 'assistant') {
    const options = message.options
    return (
      <div className="flex flex-col -mt-1 invisible group-hover:visible">
        <Button className="hover:bg-gray-300" title="Regenerate" onClick={regenerate}>
          <ArrowPathIcon className="h-4 w-4 text-gray-500" />
        </Button>
        <Button className="hover:bg-gray-300" title="Delete" onClick={deleteMessage}>
          <TrashIcon className="h-4 w-4 text-gray-500" />
        </Button>
        {/* <Button className="hover:bg-gray-300" title="Good Answer">
                  <HandThumbUpIcon className="h-4 w-4 text-gray-500" />
                </Button>
                <Button className="hover:bg-gray-300" title="Bad Answer">
                  <HandThumbDownIcon className="h-4 w-4 text-gray-500" />
                </Button> */}
      </div>
    )
  }

  return null
}
