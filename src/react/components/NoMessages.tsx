import { fileStore } from '@/react/stores/fileStore'
import { useStore } from '@nanostores/react'
import Button from './Button'
import { Intent } from '@/types'
import { messageStore } from '@/react/stores/messageStore'

const MODES = [
  {
    name: 'DraftPilot',
    intent: Intent.DRAFTPILOT,
    desc: 'Edit your code',
  },
  {
    name: 'CrashPilot',
    intent: Intent.CRASHPILOT,
    desc: 'Fix bugs and crashes',
  },
  {
    name: 'Product Manager',
    intent: Intent.PRODUCT,
    desc: 'Talk to a "PM"',
  },
  { name: 'Chat', intent: Intent.CHAT, desc: 'Talk about your code' },
]

export default () => {
  const cwd = useStore(fileStore.cwd)
  const intent = useStore(messageStore.intent)

  const setIntent = (intent: Intent) => {
    messageStore.intent.set(intent)
  }

  return (
    <>
      <div className="bg-green-100 justify-self-center p-4 shadow rounded">
        <h1 className="text-2xl font-bold text-gray-800">Welcome to draftpilot!</h1>

        <p className="my-4">
          Running in: <code>{cwd}</code>
        </p>

        <a
          href="https://teamstory-ai.notion.site/Tips-for-prompting-Draftpilot-d650ce4ff055421bbd46e8ab704c815a"
          target="_blank"
          className="text-blue-700 hover:underline"
        >
          Tips for prompting
        </a>
      </div>

      <div className="flex justify-self-center gap-4">
        {MODES.map((m) => (
          <Button
            key={m.intent}
            onClick={() => setIntent(m.intent)}
            className={
              (m.intent == intent ? 'bg-blue-700' : 'bg-blue-500') + ' hover:bg-blue-600 flex-1'
            }
          >
            <div className="font-bold">{m.name}</div>
            <div className="text-sm">{m.desc}</div>
          </Button>
        ))}
      </div>
    </>
  )
}
