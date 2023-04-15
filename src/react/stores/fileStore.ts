import { API } from '@/react/api/api'
import { atom } from 'nanostores'

type MergeData = {
  file?: string
  base?: string
  changes?: string
}

class FileStore {
  // --- services

  files = atom<string[]>([])

  mergeInfo = atom<MergeData | null>(null)

  // --- actions

  loadData = async () => {
    const response = await API.loadFiles()
    this.files.set(response.files || [])
  }

  search = (query: string) => {
    const files = this.files.get()
    const filteredFiles = query ? files.filter((file) => file.includes(query)) : files
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
}

declare global {
  interface Window {
    fileStore: FileStore
  }
}

export const fileStore = new FileStore()
window.fileStore = fileStore
