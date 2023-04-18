import Button from '@/react/components/Button'
import { fileStore } from '@/react/stores/fileStore'
import { messageStore } from '@/react/stores/messageStore'
import { ChatMessage } from '@/types'
import { splitOnce } from '@/utils/utils'
import { useState } from 'react'

type Props = {
  code: string
  message: ChatMessage
  prevBlock?: string
}

export default ({ code, message, prevBlock }: Props) => {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  const merge = () => {
    // check the prev text block for a file name
    const prevBlockMatch = prevBlock?.match(/`([^`]+\.[^`]+)`/)
    if (prevBlockMatch) {
      const filename = prevBlockMatch[1]
      fileStore.initiateMerge(filename, code)
      return
    }

    const messages = messageStore.messages.get()
    const index = messages.indexOf(message)
    for (let i = index - 1; i >= 0; i--) {
      const prevMessage = messages[i]
      const attachments = prevMessage.attachments
      if (attachments?.length) {
        for (const attachment of attachments) {
          if (attachment.type == 'file') {
            fileStore.initiateMerge(attachment.name, code)
            return
          } else if (attachment.type == 'observation') {
            if (attachment.name.startsWith('viewFile')) {
              const [, filename] = splitOnce(attachment.name, ' ')
              fileStore.initiateMerge(filename, code)
              return
            }
          }
        }
      }
    }

    fileStore.initiateMerge(undefined, code)
  }

  const gpt4 = () => {
    messageStore.popMessages(message)
    if (!message.options) {
      message.options = {}
    }
    message.options.model = '4'
    messageStore.sendMessage(message, true)
  }

  const buttonClass = 'bg-gray-600 hover:bg-gray-700'
  return (
    <div className="flex justify-center items-center mb-2 gap-2">
      <Button onClick={copy} className={buttonClass}>
        {copied ? 'Copied' : 'Copy to Clipboard'}
      </Button>
      <Button onClick={merge} className={buttonClass}>
        Merge into file
      </Button>
      {message.options?.model != '4' && (
        <Button onClick={gpt4} className={buttonClass}>
          Retry with GPT-4
        </Button>
      )}
    </div>
  )
}
