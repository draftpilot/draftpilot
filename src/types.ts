export type ProjectConfig = {
  server?: string
  language?: string
  purpose?: string
  techstack?: string
}

export type SourceFile = {
  name: string
  contents: string
  docs?: CodeDoc[]
}

// a code snippet that is extracted from a source file
// usually contains a function or logical grouping of code
export type CodeDoc = {
  path: string
  contents: string
  hash?: number
  vectors?: number[]
}

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type Plan = {
  // the overall request
  request: string
  read?: string[]
  change?: { [file: string]: string }
  create?: { [file: string]: string }
  rename?: { [file: string]: string }
  copyAndEdit?: {
    [file: string]: {
      dest: string
      edits: string
    }
  }
  delete?: string[]
}

export type FileInfo = {
  exclude?: boolean
  description?: string
  key?: boolean
}
export type FileManifest = { [file: string]: FileInfo }
