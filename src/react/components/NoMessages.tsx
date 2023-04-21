import { fileStore } from '@/react/stores/fileStore'
import { useStore } from '@nanostores/react'
import Button from './Button'
import { Intent } from '@/types'
import { messageStore } from '@/react/stores/messageStore'

const MODES = [
  {
    name: 'DraftPilot',
    intent: Intent.DRAFTPILOT,
    desc: 'Make changes to code',
    color: 'bg-blue-500',
  },
  { name: 'Chat', intent: Intent.CHAT, desc: 'Chat about your code', color: 'bg-blue-500' },
  {
    name: 'TestPilot',
    intent: Intent.TESTPILOT,
    desc: 'Write tests with ease',
    color: 'bg-gray-500',
  },
  {
    name: 'CrashPilot',
    intent: Intent.CRASHPILOT,
    desc: 'Fix bugs and crashes',
    color: 'bg-gray-500',
  },
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

        <p>Here are some things you can ask me to do:</p>

        <ul className="list-disc list-inside mt-2 flex flex-col gap-2">
          <li>
            Write tests for <code>transformer.ts</code>
          </li>
          <li>Find a package for a fuzzy string matcher</li>
          <li>
            For all instances of <code>FOO</code>, add <code>BAR</code> next to it
          </li>
          <li>
            Look for bugs in <code>importantFile.ts</code>
          </li>
          <li>Create a React hook for auto-expanding textarea and save it to src/components</li>
        </ul>
      </div>

      <div className="flex justify-self-center gap-4">
        {MODES.map((m) => (
          <Button
            key={m.intent}
            onClick={() => setIntent(m.intent)}
            className={(m.intent == intent ? 'bg-blue-700' : m.color) + ' hover:bg-blue-600 flex-1'}
          >
            <div className="font-bold">{m.name}</div>
            <div className="text-sm">{m.desc}</div>
          </Button>
        ))}
      </div>
    </>
  )
}