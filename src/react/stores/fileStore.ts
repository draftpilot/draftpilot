import { API } from '@/react/api/api'
import { messageStore } from '@/react/stores/messageStore'
import { atom } from 'nanostores'

type MergeData = {
  file?: string
  base?: string
  changes?: string
}

class FileStore {
  // --- services

  cwd = atom<string>('')

  files = atom<string[]>([])

  mergeInfo = atom<MergeData | null>(null)

  // --- actions

  loadData = async () => {
    const response = await API.loadFiles()
    this.files.set(response.files || [])
    this.cwd.set(response.cwd || '')
  }

  search = (query: string) => {
    const files = this.files.get()
    const lowerQuery = query.toLowerCase()
    const filteredFiles = query
      ? files.filter((file) => file.toLowerCase().includes(lowerQuery))
      : files
    return filteredFiles.slice(0, 10)
  }

  initiateMerge = (file: string | undefined, changes: string) => {
    this.mergeInfo.set({ file, changes })
    if (file) {
      API.loadFile(file).then((response) => {
        this.mergeInfo.set({ file, base: response.file, changes })
      })
    }
  }

  clearMerge = () => {
    this.mergeInfo.set(null)
  }

  saveMerge = async (mergeInfo: MergeData, contents: string) => {
    API.saveFile(mergeInfo.file!, contents)
    this.mergeInfo.set(null)

    messageStore.addSystemMessage({
      role: 'system',
      content: `Saved changes to ${mergeInfo.file}`,
    })
  }

  newSession = () => {
    this.mergeInfo.set(null)
  }
}

declare global {
  interface Window {
    fileStore: FileStore
  }
}

export const fileStore = new FileStore()
window.fileStore = fileStore
