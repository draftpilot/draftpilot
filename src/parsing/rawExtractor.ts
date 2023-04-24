import { Extractor, chunkLines } from '@/parsing/extractor'
import { CodeDoc, SourceFile } from '@/types'

// returns an entire file grouped into 100 line chunks
export class RawExtractor implements Extractor {
  async parse(file: SourceFile): Promise<CodeDoc[]> {
    const contents = file.contents
    const splitContents = contents.split('\n')

    const docs: CodeDoc[] = []
    chunkLines(file.name, splitContents, docs)
    return docs
  }
}
