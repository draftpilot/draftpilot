import { log } from '@/utils/logger'
import { Extractor } from '@/parsing/extractor'
import { CodeDoc, SourceFile } from '@/types'
import { cyrb53 } from '@/utils/utils'

import ts, { isObjectLiteralExpression, isVariableDeclarationList } from 'typescript'

type FuncChunk = {
  name: string
  contents: string
  line: number
}

// chunk every 100 lines for long functions
const CHUNK_SIZE = 100

// parses a javascript / typescript file and returns functions
export class TSExtractor implements Extractor {
  async parse(file: SourceFile): Promise<CodeDoc[]> {
    const sourceFile = ts.createSourceFile(file.name, file.contents, ts.ScriptTarget.Latest, true)

    const functions: ts.Node[] = []
    findNodeRecursive(
      sourceFile,
      ['FunctionDeclaration', 'MethodDeclaration', 'ArrowFunction'],
      functions
    )

    const chunks: FuncChunk[] = functions
      .map((node) => {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
        let name: string = 'L' + line

        if (ts.isFunctionDeclaration(node)) {
          if (node.name) name = node.name?.getText()
          if (!node.body) return []
        } else if (ts.isArrowFunction(node)) {
          const parent = node.parent
          const grandParent = parent.parent
          if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent))
            name = parent.name.getText()
          if (
            grandParent.kind == ts.SyntaxKind.ObjectLiteralExpression ||
            grandParent.kind == ts.SyntaxKind.VariableDeclarationList
          ) {
            const greatGrandParent = grandParent.parent
            if (
              ts.isVariableDeclaration(greatGrandParent) ||
              ts.isPropertyAssignment(greatGrandParent)
            ) {
              name = greatGrandParent.name.getText() + '.' + name
            }
          }

          if (!node.body || node.body.getText().length < 100) return []
        } else if (ts.isMethodDeclaration(node)) {
          if (!node.body) return []
          const parent = node.parent
          let parentName: string | undefined
          if (ts.isClassDeclaration(parent)) parentName = parent.name?.getText()
          if (parentName) name = parentName + '.' + (node.name?.getText() || 'method')
        }

        const contents = node.getText()
        const splitContents = contents.split('\n')

        const chunks: FuncChunk[] = []
        // chunk every 100 lines, but include the last 10 lines of prev chunk for context
        for (let i = 0; i < splitContents.length; i += CHUNK_SIZE - 10) {
          const chunk = splitContents.slice(i, i + CHUNK_SIZE).join('\n')
          chunks.push({ name, contents: chunk, line })
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
      .filter(Boolean) as CodeDoc[]
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
