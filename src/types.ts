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
