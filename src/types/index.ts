export type ProjectConfig = {
  server?: string
  glob?: string
  testDir?: string
  excludeDir?: string
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'none'
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

export type Attachment = {
  type: string
  name: string
  content?: string
}

export type Model = '3.5' | '4'

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: Attachment[]
  state?: any
  intent?: string
  progressDuration?: number
  progressStart?: number
  options?: { model?: Model; tools?: boolean; type?: string }
}

export type Plan = {
  // the overall request
  request: string
  reference?: string[]
  change?: { [file: string]: string }
  create?: { [file: string]: string }
  rename?: { [file: string]: string }
  clone?: {
    [file: string]: {
      dest: string
      edits: string
    }
  }
  delete?: string[]
  shellCommands?: string[]
}

export type FileInfo = {
  exclude?: boolean
  description?: string
  key?: boolean
}

export type FileManifest = { [file: string]: FileInfo }

export type LearningItem = {
  request: string
  output: string
  accepted: boolean
  feedback?: string
}

export type LearningLog = {
  planner: LearningItem[]
  executor: LearningItem[]
}

export type MessagePayload = {
  id: string
  message: ChatMessage
  history: ChatMessage[]
}

export type PostMessage = (message: ChatMessage | string) => void

export enum Intent {
  ANSWER = 'DIRECT_ANSWER',
  COMPLEX = 'COMPLEX_ANSWER',
  PLANNER = 'PLANNER',
  ACTION = 'ACTION',
  PRODUCT = 'PRODUCT',
}
