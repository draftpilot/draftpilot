import { CodeDoc, SourceFile } from '@/types'
import { Extractor, chunkLines } from './extractor'

type Func = { name: string; contents: string }

export class PyExtractor implements Extractor {
  private readonly wordRegex = /(\w+)/

  parse = async (file: SourceFile): Promise<CodeDoc[]> => {
    const functions: Func[] = []
    let match: RegExpExecArray | null

    const lines = file.contents.split('\n')
    const context = { lines, i: 0, functions }

    this.parseLoop('', '', false, context)

    const docs: CodeDoc[] = []
    context.functions.forEach((func) => {
      const lines = func.contents.split('\n')
      chunkLines(file.name + '#' + func.name, lines, docs)
    })

    return docs
  }

  private parseLoop = (
    indent: string,
    prefix: string,
    inFunction: boolean,
    context: {
      lines: string[]
      i: number
      functions: Func[]
    }
  ) => {
    for (const start = context.i; context.i < context.lines.length; context.i++) {
      const line = context.lines[context.i]
      const match = line.match(/^(\s*)([^\s]+)/)
      if (!match) continue

      const newIndent = match[1]

      // we've left this loop
      if (prefix && newIndent.length <= indent.length) {
        if (inFunction) {
          const contents = context.lines.slice(start, context.i).join('\n')
          context.functions.push({ name: prefix, contents })
        }
        context.i--
        break
      }

      const firstWord = match[2]
      const firstWordEnd = newIndent.length + firstWord.length + 1

      if (firstWord === 'class' || firstWord === 'def') {
        const contextName = line.slice(firstWordEnd).match(this.wordRegex)?.[0] || firstWord
        const newPrefix = prefix ? prefix + '.' + contextName : contextName
        const isFunction = firstWord === 'def'

        context.i++
        this.parseLoop(newIndent, newPrefix, isFunction, context)
      }
    }
  }
}
