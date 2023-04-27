import hljs from 'highlight.js/lib/common'
import { useState } from 'react'
import Button from '@/react/components/Button'
import CodeEditor from 'react-simple-code-editor'

function FileEditor({
  file,
  language,
  code,
  setCode,
  setEditing,
}: {
  file: string
  language: string
  code: string
  setCode: (code: string) => void
  setEditing: (editing: boolean) => void
}) {
  const [newCode, setNewCode] = useState(code)

  const save = () => {
    setCode(newCode)
    setEditing(false)
  }

  const discard = () => {
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-4 mx-auto w-[768px] max-w-full">
      <div className="mb-4 shadow-md flex-1 max-w-full overflow-x-auto font-mono">
        <CodeEditor
          className="w-full"
          autoFocus
          value={newCode}
          highlight={(code) => hljs.highlight(code, { language: language || 'plaintext' }).value}
          padding={10}
          onValueChange={(code) => setNewCode(code)}
        />
      </div>
      <div className="flex justify-center my-4 gap-4">
        <Button onClick={save} className="bg-blue-600">
          Save
        </Button>
        <Button onClick={discard} className="bg-red-600">
          Discard
        </Button>
      </div>
    </div>
  )
}

export default FileEditor
