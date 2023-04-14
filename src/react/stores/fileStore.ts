import { API } from '@/react/api/api'
import { atom } from 'nanostores'

class FileStore {
  // --- services

  files = atom<string[]>([])

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
}

declare global {
  interface Window {
    fileStore: FileStore
  }
}

export const fileStore = new FileStore()
window.fileStore = fileStore
