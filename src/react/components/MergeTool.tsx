import { fileStore } from '@/react/stores/fileStore'
import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'
import * as Diff from 'diff'
import { log } from '@/utils/logger'
import Button from '@/react/components/Button'
import { API } from '@/react/api/api'
import { XMarkIcon } from '@heroicons/react/24/outline'

export default () => {
  const mergeInfo = useStore(fileStore.mergeInfo)
  const [fileSelector, setFileSelector] = useState(false)
  const [fileInput, setFileInput] = useState('')

  const [diff, setDiff] = useState<Diff.Change[] | null>(null)

  useEffect(() => {
    if (!mergeInfo) return

    if (!mergeInfo.file) {
      setFileSelector(true)
      setFileInput('')
    }

    if (mergeInfo.base && mergeInfo.changes) {
      const diff = Diff.diffTrimmedLines(mergeInfo.base, mergeInfo.changes, {})
      log('diff', diff)

      // whitespace-insensitive diff lines are trimmed, so we need to re-generate the changes
      const base = mergeInfo.base.split('\n')
      const changes = mergeInfo.changes.split('\n')

      // we follow the diff, but since it's trimmed, we can't actually use the contents
      const newDiff: Diff.Change[] = []
      let baseIndex = 0,
        changesIndex = 0

      for (let i = 0; i < diff.length; i++) {
        const part = diff[i]
        const lines = part.value.split('\n').length - 1

        if (part.removed) {
          const baseLines = base.slice(baseIndex, baseIndex + lines)
          newDiff.push({ removed: true, value: baseLines.join('\n') })
          baseIndex += lines
        } else if (part.added) {
          // try to match previous indent
          const baseLine = base.slice(baseIndex, baseIndex + 1)[0]
          const indent = baseLine?.match(/^\s*/)?.[0] || ''
          const changeLines = changes.slice(changesIndex, changesIndex + lines)
          const changedIndent = changeLines[0].match(/^\s*/)?.[0] || ''
          const indentDiff = indent.slice(changedIndent.length)
          const indentedChangeLines = changeLines.map((line) => indentDiff + line)
          newDiff.push({ added: true, value: indentedChangeLines.join('\n') })
          changesIndex += lines
        } else {
          const baseLines = base.slice(baseIndex, baseIndex + lines)
          newDiff.push({ value: baseLines.join('\n') })
          baseIndex += lines
          changesIndex += lines
        }
      }
      setDiff(newDiff)
    }
  }, [mergeInfo])

  if (!mergeInfo) return null

  const save = () => {
    if (!mergeInfo.base || !mergeInfo.changes || !diff) return

    const newFile: string[] = []
    for (let i = 0; i < diff.length; i++) {
      const part = diff[i]
      if (part.removed && (i == 0 || i == diff.length - 1)) {
        newFile.push(part.value)
      } else if (part.added) {
        newFile.push(part.value)
      } else if (part.removed) {
        // nothing
      } else {
        newFile.push(part.value)
      }
    }

    const newContents = newFile.join('\n')
    fileStore.saveMerge(mergeInfo, newContents)
  }

  return (
    <div className={`bg-orange-100 p-4 shadow-md rounded`}>
      <div className="flex">
        <h2 className={`flex-1 text-lg font-bold text-gray-800 mb-4`}>Merge Changes</h2>
        <XMarkIcon
          className={`h-6 w-6 text-gray-500 cursor-pointer`}
          onClick={() => fileStore.clearMerge()}
        />
      </div>

      {mergeInfo.file && (
        <div className="">
          <span className="font-semibold">File:</span> {mergeInfo.file}
          <a href="#" className={`text-blue-500 ml-2`} onClick={() => setFileSelector(true)}>
            (Change)
          </a>
        </div>
      )}

      {fileSelector && (
        <div className="my-2 flex items-center">
          <input
            type="text"
            value={fileInput}
            className="p-1 rounded w-72"
            onChange={(e) => setFileInput(e.target.value)}
            list="file-list"
          />
          <datalist id="file-list">
            {fileStore.files.get().map((file) => (
              <option key={file} value={file} />
            ))}
          </datalist>
          <button
            className={`ml-2 px-2 py-1 rounded bg-blue-500 text-white`}
            onClick={() => fileStore.initiateMerge(fileInput, mergeInfo.changes!)}
          >
            Change
          </button>
        </div>
      )}

      {diff && (
        <div className="my-2">
          <div className="font-semibold">Delta:</div>
          <pre className="whitespace-pre text-sm overflow-x-auto my-2 hljs rounded p-2">
            {diff.map((part, index) => {
              // frequently the patches only include a snippet of the full code, hence we suppress
              // leading and trailing hunks
              if (index == 0 && part.removed) return null
              if (index == diff.length - 1 && part.removed) return null

              const color = part.added ? 'green' : part.removed ? 'red' : 'grey'
              const lines = part.value.split('\n')
              const prefix = part.added ? '+' : part.removed ? '-' : ' '
              const content = lines.map((line) => `${prefix} ${line}`).join('\n')
              return (
                <div key={index} style={{ color }}>
                  {content}
                </div>
              )
            })}
          </pre>
          {diff.some((part) => part.added || part.removed) && (
            <Button className={`bg-blue-500 hover:bg-blue-700`} onClick={() => save()}>
              Save Changes
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
