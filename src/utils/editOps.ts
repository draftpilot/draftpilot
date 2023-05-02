import fs from 'fs'

import { log } from '@/utils/logger'

export const applyOps = (contents: string, ops: Op[], writeToFile: string | null): string => {
  let lines = contents.split('\n')
  let clipboard: string[] = []

  let outputFileName = writeToFile

  // for ops, line numbers apply to the initial contents, so they need to be offset
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]

    const line = isOpWithLine(op) ? findLineIndex(lines, op) : 0
    const updateLines = (delta: number) => {
      ops.slice(i + 1).forEach((op2) => {
        if (isOpWithLine(op2) && op2.line > line) op2.line += delta
      })
    }

    switch (op.op) {
      case 'replace': {
        const { search, replace } = op
        lines = lines.map((l) => l.replaceAll(search, replace))
        break
      }
      case 'new': {
        lines = op.content.split('\n').concat(lines)
        break
      }
      case 'edit': {
        const { delLines, content } = op
        const insertLines = content ? content.split('\n') : []
        matchIndent(lines[line], insertLines)
        lines = lines
          .slice(0, line)
          .concat(insertLines)
          .concat(lines.slice(line + delLines))
        updateLines(insertLines.length - delLines)
        break
      }
      case 'insert': {
        const { content } = op
        const insertLines = content.split('\n')
        matchIndent(lines[line], insertLines)
        lines = lines.slice(0, line).concat(insertLines).concat(lines.slice(line))
        updateLines(insertLines.length)
        break
      }
      case 'delete': {
        const { delLines } = op
        lines.splice(line, delLines)
        updateLines(-delLines)
        break
      }
      case 'copy': {
        const { copyLines } = op
        clipboard = lines.slice(line, line + copyLines)
        break
      }
      case 'paste': {
        matchIndent(lines[line], clipboard)
        lines = lines.slice(0, line).concat(clipboard).concat(lines.slice(line))
        updateLines(clipboard.length)
        break
      }
      case 'cut': {
        const { cutLines } = op
        clipboard = lines.splice(line, cutLines)
        lines = lines.slice(0, line).concat(lines.slice(line + cutLines))
        updateLines(-cutLines)
        break
      }
      case 'renameFile': {
        outputFileName = op.newFile
        if (writeToFile) fs.unlinkSync(writeToFile)
        break
      }
      case 'deleteFile': {
        outputFileName = null
        if (writeToFile) fs.unlinkSync(writeToFile)
        break
      }
      case 'import': {
        const { content } = op
        const insertLines = content.split('\n')
        lines = insertLines.concat(lines)
        updateLines(insertLines.length)
        break
      }
      default:
        log('unknown op', op)
    }
  }

  const result = lines.join('\n')
  if (outputFileName) fs.writeFileSync(outputFileName, result)
  return result
}

const matchIndent = (line: string, lines: string[]) => {
  // try to match previous indent
  const indent = line?.match(/^\s*/)?.[0] || ''

  for (let i = 0; i < lines.length; i++) {
    const newLine = lines[i]
    const changedIndent = newLine.match(/^\s*/)?.[0] || ''
    const indentDiff = indent.slice(changedIndent.length)
    lines[i] = indentDiff + newLine
  }
}

const findLineIndex = (lines: string[], op: OpWithLine) => {
  const { line, curLine } = op
  if (!line) return -1
  if (!curLine) return line
  const startLineSplit = curLine.split('\n').map((l) => l.trim())

  const matches = (line: number) => {
    for (let i = 0; i < startLineSplit.length; i++) {
      if (startLineSplit[i] != lines[line + i]?.trim()) return false
    }
    return true
  }

  // do a search starting from the provided line number
  // GPT is real bad with line numbers so it could be anywhere though
  const maxSearch = Math.max(line, lines.length - line)
  for (let i = 0; i < maxSearch; i++) {
    if (i < lines.length && matches(line + i)) return line + i
    if (i >= 0 && matches(line - i)) return line - i
  }
  log('could not find starting line for op, searched', maxSearch, op)
  if (line > lines.length - 1) return lines.length - 1
  return line
}

type ReplaceOp = {
  op: 'replace'
  search: string
  replace: string
}

type OpWithLine = {
  op: string
  line: number
  curLine?: string
}

function isOpWithLine(op: any): op is OpWithLine {
  return !!(op as OpWithLine).line
}

type EditOp = {
  op: 'edit'
  line: number
  curLine: string
  delLines: number
  content: string
}

type NewOp = {
  op: 'new'
  content: string
}

type InsertOp = {
  op: 'insert'
  line: number
  curLine: string
  content: string
}

type DeleteOp = {
  op: 'delete'
  line: number
  curLine: string
  delLines: number
}

type CopyOp = {
  op: 'copy'
  line: number
  curLine: string
  copyLines: number
}

type CutOp = {
  op: 'cut'
  line: number
  curLine: string
  cutLines: number
}

type PasteOp = {
  op: 'paste'
  line: number
}

type RenameFile = {
  op: 'renameFile'
  newFile: string
}

type DeleteFile = {
  op: 'deleteFile'
}

// the following are ops taht gpt-4 tends to hallucinate

type ImportOp = {
  op: 'import'
  content: string
}

export type Op =
  | ReplaceOp
  | InsertOp
  | DeleteOp
  | EditOp
  | CopyOp
  | CutOp
  | PasteOp
  | NewOp
  | RenameFile
  | DeleteFile
  | ImportOp

export const EXAMPLE_OPS: Op[] = [
  // not sure if this is a good idea.
  // {
  //   op: 'replace',
  //   search: 'text to search (case sensitive)',
  //   replace: 'global file text replacement',
  // },
  { op: 'new', content: 'text to insert in new file' },
  {
    op: 'edit',
    line: 1,
    delLines: 1,
    curLine: 'first line to alter',
    content: 'new content to insert',
  },
  {
    op: 'insert',
    content: 'hello',
    line: 3,
    curLine: 'content will be inserted ABOVE this line',
  },
  { op: 'delete', line: 1, curLine: 'first line to delete', delLines: 5 },
  { op: 'copy', line: 1, curLine: 'first line to copy', copyLines: 5 },
  { op: 'cut', line: 1, curLine: 'first line to cut', cutLines: 5 },
  { op: 'paste', line: 1 },
  { op: 'renameFile', newFile: 'newName.ext' },
  { op: 'deleteFile' },
]
