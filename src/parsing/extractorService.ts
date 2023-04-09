import { Extractor } from '@/parsing/extractor'
import { RawExtractor } from '@/parsing/rawExtractor'
import { TSExtractor } from '@/parsing/tsExtractor'
import { CodeDoc, SourceFile } from '@/types'
import path from 'path'

export class ExtractorService implements Extractor {
  extractors: { [key: string]: Extractor } = {
    ts: new TSExtractor(),
    raw: new RawExtractor(),
  }

  extensions: { [key: string]: string } = {
    '.ts': 'ts',
    '.tsx': 'ts',
    '.js': 'ts',
    '.jsx': 'ts',
  }

  parse = (file: SourceFile): Promise<CodeDoc[]> => {
    const ext = path.extname(file.name)
    if (this.extensions[ext]) {
      const extractor = this.extractors[this.extensions[ext]]
      return extractor.parse(file)
    }

    const rawExtractor = this.extractors['raw']
    return rawExtractor.parse(file)
  }
}
