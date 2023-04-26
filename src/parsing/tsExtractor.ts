import { log } from '@/utils/logger'
import { Extractor, chunkLines } from '@/parsing/extractor'
import { CodeDoc, SourceFile } from '@/types'

import ts from 'typescript'

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

    const docs: CodeDoc[] = []
    functions.forEach((node) => {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
      let name: string = 'function'

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

      chunkLines(file.name + ':' + name, splitContents, docs)
    })

    return docs
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
