import { Extractor } from '@/parsing/extractor'
import { CodeDoc, SourceFile } from '@/types'
import { cyrb53 } from '@/utils/utils'

// chunk every 10 lines
const CHUNK_SIZE = 30
const CHUNK_OVERLAP = 5

// returns an entire file grouped into 100 line chunks
export class RawExtractor implements Extractor {
  async parse(file: SourceFile): Promise<CodeDoc[]> {
    const contents = file.contents
    const splitContents = contents.split('\n')

    const docs: CodeDoc[] = []
    // chunk every 100 lines, but include the last 10 lines of prev chunk for context
    for (let i = 0; i < splitContents.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      const name = `${file.name}#${i}-${i + CHUNK_SIZE}`
      const contents = splitContents.slice(i, i + CHUNK_SIZE).join('\n')
      const hash = cyrb53(contents)
      docs.push({ path: name, contents, hash })
    }
    return docs
  }
}
