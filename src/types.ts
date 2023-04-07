export type ProjectConfig = {
  server?: string
  language?: string
  purpose?: string
  techstack?: string
}

export type SourceFile = {
  name: string
  contents: string
  docs?: FunctionDoc[]
}

export type FunctionDoc = {
  path: string
  contents: string
  hash?: number
  vectors?: number[]
}
