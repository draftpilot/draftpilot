import { log } from '@/logger'
import { FunctionDoc, SourceFile } from '@/types'
import { cyrb53 } from '@/utils'

import ts from 'typescript'

// parses a javascript / typescript file and returns functions
export class JSExtractor {
  parse(file: SourceFile): FunctionDoc[] {
    const sourceFile = ts.createSourceFile(file.name, file.contents, ts.ScriptTarget.Latest, true)

    const functions: ts.Node[] = []
    findNodeRecursive(sourceFile, ['FunctionDeclaration', 'MethodDeclaration'], functions)

    const nameSet = new Set<string>()
    return functions
      .map((node) => {
        let name: string = 'fn'

        if (ts.isFunctionDeclaration(node)) {
          name = node.name?.getText() || 'function'
          if (!node.body) return null
        } else if (ts.isMethodDeclaration(node)) {
          if (!node.body) return null
          const parent = node.parent
          let parentName = 'parent'
          if (ts.isClassDeclaration(parent)) parentName = parent.name?.getText() || 'class'
          else {
            log('unknown parent', parent.kind)
          }
          name = parentName + '.' + (node.name?.getText() || 'method')
        }

        if (nameSet.has(name)) {
          name += ':' + node.getStart(sourceFile)
        }
        nameSet.add(name)

        const contents = node.getText()
        const hash = cyrb53(contents)

        return {
          path: file.name + '#' + name,
          contents,
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
