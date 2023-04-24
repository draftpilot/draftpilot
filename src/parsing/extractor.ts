import { CodeDoc, SourceFile } from '@/types'
import { cyrb53 } from '@/utils/utils'

const CHUNK_SIZE = 30
const CHUNK_OVERLAP = 5

export interface Extractor {
  parse(file: SourceFile): Promise<CodeDoc[]>
}

export const chunkLines = (baseName: string, lines: string[], docs: CodeDoc[]) => {
  for (let i = 0; i < lines.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const name = `${baseName}#${i}-${i + CHUNK_SIZE}`
    const contents = lines.slice(i, i + CHUNK_SIZE).join('\n')
    const hash = cyrb53(contents)
    docs.push({ path: name, contents, hash })
  }
}
