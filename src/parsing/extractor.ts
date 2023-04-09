import { CodeDoc, SourceFile } from '@/types'

export interface Extractor {
  parse(file: SourceFile): Promise<CodeDoc[]>
}
