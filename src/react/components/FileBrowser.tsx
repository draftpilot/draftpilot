import { extToLanguage } from '@/context/language'
import { API } from '@/react/api/api'
import Button from '@/react/components/Button'
import FileTree from '@/react/components/FileTree'
import { fileStore } from '@/react/stores/fileStore'
import { messageStore } from '@/react/stores/messageStore'
import { useStore } from '@nanostores/react'
import hljs from 'highlight.js'
import { useEffect, useRef, useState } from 'react'

export default function FileBrowser() {
  const selected = useStore(fileStore.selectedFile) || ''
  const [contents, setContents] = useState('')
  const curRequest = useRef<string>('')

  useEffect(() => {
    setContents('')
    if (!selected) return
    curRequest.current = selected
    API.loadFile(selected)
      .then((res) => {
        if (curRequest.current !== selected) return
        setContents(res.file)
      })
      .catch((err) => {
        setContents(err.message)
      })

    // expand all file parts
    const parts = selected.split('/')
    const expanded = fileStore.expanded.get()
    parts.forEach((part) => (expanded[part] = true))
    fileStore.expanded.set({ ...expanded })
  }, [selected])

  const selectFile = (file: string) => {
    fileStore.selectedFile.set(file)
  }

  const extension = selected.split('.').pop() || ''
  let language = extToLanguage['.' + extension]
  if (!language && hljs.getLanguage(extension)) language = extension
  const html = hljs.highlight(contents, { language: language || 'plaintext' }).value

  const attachments = useStore(messageStore.attachments)
  const isAttached = attachments.find((a) => a.name == selected)

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-56 overflow-scroll ">
        <FileTree selected={selected} setSelected={selectFile} />
      </div>
      <div className="flex-1 editor">
        {selected && (
          <>
            <div className="border-b border-gray-100 p-2 flex items-center gap-2">
              <div className="text-sm font-mono">{selected || 'Select a file to display'}</div>
              {!isAttached && (
                <Button
                  className="bg-blue-400 py-1 px-1 text-sm"
                  onClick={() => messageStore.attachFile(selected)}
                >
                  Add to prompt
                </Button>
              )}
            </div>
            <pre
              className="h-full hljs overflow-scroll rounded-md p-4 text-sm whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </>
        )}
      </div>
    </div>
  )
}
