import { extToLanguage } from '@/context/language'
import { API } from '@/react/api/api'
import FileTree from '@/react/components/FileTree'
import { fileStore } from '@/react/stores/fileStore'
import { useStore } from '@nanostores/react'
import hljs from 'highlight.js'
import { useRef, useState } from 'react'

export default function FileBrowser() {
  const selected = useStore(fileStore.selectedFile) || ''
  const [contents, setContents] = useState('')
  const curRequest = useRef<string>('')

  const selectFile = (file: string) => {
    setContents('')
    fileStore.selectedFile.set(file)
    curRequest.current = file
    API.loadFile(file).then((res) => {
      if (curRequest.current !== file) return
      setContents(res.file)
    })
  }

  const extension = selected.split('.').pop() || ''
  let language = extToLanguage['.' + extension]
  if (!language && hljs.getLanguage(extension)) language = extension
  const html = hljs.highlight(contents, { language: language || 'plaintext' }).value

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="p-4 w-56 border-r border-gray-200 overflow-scroll ">
        <FileTree selected={selected} setSelected={selectFile} />
      </div>
      <div className="flex-1 editor overflow-scroll ">
        <pre
          className="hljs rounded-md p-4 text-sm whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}
