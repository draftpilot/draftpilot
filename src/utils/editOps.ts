import { log } from '@/utils/logger'

export const applyOps = (contents: string, ops: Op[]) => {
  let lines = contents.split('\n')
  let clipboard: string[] = []

  // for ops, line numbers apply to the initial contents, so they need to be offset
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    if (op.op == 'replace') {
      const { search, replace } = op
      lines = lines.map((l) => l.replaceAll(search, replace))
      continue
    }

    const line = findLineIndex(lines, op)
    const updateLines = (delta: number) => {
      ops.slice(i + 1).forEach((op2) => {
        if (isOpWithLine(op2) && op2.line > line) op2.line += delta
      })
    }

    switch (op.op) {
      case 'edit': {
        const { delLines, insert } = op
        const insertLines = insert.split('\n')
        matchIndent(lines[line], insertLines)
        lines = lines
          .slice(0, line)
          .concat(insertLines)
          .concat(lines.slice(line + delLines))
        updateLines(insertLines.length - delLines)
        break
      }
      case 'insert': {
        const { insert } = op
        const insertLines = insert.split('\n')
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
      default:
        log('unknown op', op)
    }
  }

  return lines.join('\n')
}

const matchIndent = (line: string, lines: string[]) => {
  // try to match previous indent
  const indent = line?.match(/^\s*/)?.[0] || ''
  const changedIndent = lines[0].match(/^\s*/)?.[0] || ''
  const indentDiff = indent.slice(changedIndent.length)

  for (let i = 0; i < lines.length; i++) {
    lines[i] = indentDiff + lines[i]
  }
}

const findLineIndex = (lines: string[], op: OpWithLine) => {
  const { line, startLine } = op
  if (!line) return -1
  if (!startLine) return line
  const startLineSplit = startLine.split('\n').map((l) => l.trim())

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
  startLine?: string
}

function isOpWithLine(op: any): op is OpWithLine {
  return !!(op as OpWithLine).line
}

type EditOp = {
  op: 'edit'
  line: number
  startLine: string
  delLines: number
  insert: string
}

type InsertOp = {
  op: 'insert'
  line: number
  startLine: string
  insert: string
}

type DeleteOp = {
  op: 'delete'
  line: number
  startLine: string
  delLines: number
}

type CopyOp = {
  op: 'copy'
  line: number
  startLine: string
  copyLines: number
}

type CutOp = {
  op: 'cut'
  line: number
  startLine: string
  cutLines: number
}

type PasteOp = {
  op: 'paste'
  line: number
}

export type Op = ReplaceOp | InsertOp | DeleteOp | EditOp | CopyOp | CutOp | PasteOp

export const EXAMPLE_OPS: Op[] = [
  // not sure if this is a good idea.
  // {
  //   op: 'replace',
  //   search: 'text to search (case sensitive)',
  //   replace: 'global file text replacement',
  // },
  { op: 'edit', line: 1, delLines: 1, startLine: 'first line to alter', insert: 'goodbye' },
  { op: 'insert', insert: 'hello', line: 3, startLine: 'existing line to insert below' },
  { op: 'delete', line: 1, startLine: 'first line to delete', delLines: 5 },
  { op: 'copy', line: 1, startLine: 'first line to copy', copyLines: 5 },
  { op: 'cut', line: 1, startLine: 'first line to cut', cutLines: 5 },
  { op: 'paste', line: 1 },
]
