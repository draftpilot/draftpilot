import { log } from '@/logger'
import { FunctionDoc, SourceFile } from '@/types'
import { cyrb53 } from '@/utils'

import ts from 'typescript'

type FuncChunk = {
  name: string
  contents: string
  line: number
}

const CHUNK_SIZE = 100

// parses a javascript / typescript file and returns functions
export class JSExtractor {
  parse(file: SourceFile): FunctionDoc[] {
    const sourceFile = ts.createSourceFile(file.name, file.contents, ts.ScriptTarget.Latest, true)

    const functions: ts.Node[] = []
    findNodeRecursive(sourceFile, ['FunctionDeclaration', 'MethodDeclaration'], functions)

    const chunks: FuncChunk[] = functions
      .map((node) => {
        let name: string = 'fn'

        if (ts.isFunctionDeclaration(node)) {
          name = node.name?.getText() || 'function'
          if (!node.body) return []
        } else if (ts.isMethodDeclaration(node)) {
          if (!node.body) return []
          const parent = node.parent
          let parentName = 'parent'
          if (ts.isClassDeclaration(parent)) parentName = parent.name?.getText() || 'class'
          else {
            log('unknown parent', parent.kind)
          }
          name = parentName + '.' + (node.name?.getText() || 'method')
        }

        const contents = node.getText()
        const splitContents = contents.split('\n')
        const start = node.getStart(sourceFile)

        // chunk every 100 lines
        const chunks: FuncChunk[] = []
        for (let i = 0; i < splitContents.length; i += CHUNK_SIZE) {
          const chunk = splitContents.slice(i, i + CHUNK_SIZE).join('\n')
          chunks.push({ name, contents: chunk, line: start + i })
        }
        return chunks
      })
      .flat()

    const nameSet = new Set<string>()
    return chunks
      .map((chunk) => {
        if (nameSet.has(chunk.name)) {
          chunk.name += ':' + chunk.line
        }
        nameSet.add(chunk.name)
        const hash = cyrb53(chunk.contents)
        return {
          path: file.name + '#' + chunk.name,
          contents: chunk.contents,
          hash,
        }
      })
      .filter(Boolean) as FunctionDoc[]
  }
}

export function findNodeRecursive(
  node: ts.Node,
  type: string | string[],
  progress: ts.Node[],
  stopTypes?: string[],
  filterFunction?: (node: ts.Node) => boolean
) {
  const syntaxKind = ts.SyntaxKind[node.kind]
  if (syntaxKind == type || (Array.isArray(type) && type.includes(syntaxKind))) {
    if (!filterFunction || filterFunction(node)) {
      progress.push(node)
    }
  } else if (!stopTypes || !stopTypes.includes(syntaxKind)) {
    node.forEachChild((child) => {
      findNodeRecursive(child, type, progress, stopTypes, filterFunction)
    })
  }
  return progress
}
