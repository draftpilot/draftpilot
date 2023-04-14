import { CodeDoc, SourceFile } from '@/types/types'

export interface Extractor {
  parse(file: SourceFile): Promise<CodeDoc[]>
}
