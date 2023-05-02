import { log } from '@/utils/logger'

export const applyOps = (contents: string, ops: Op[]) => {
  let lines = contents.split('\n')
  let clipboard: string[] = []

  // for ops, line numbers apply to the initial contents, so they need to be offset
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]

    const line = isOpWithLine(op) ? findLineIndex(lines, op) : 0
    const updateLines = (delta: number) => {
      ops.slice(i + 1).forEach((op2) => {
        if (isOpWithLine(op2) && op2.lineNumber > line) op2.lineNumber += delta
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
        const { deleteLines, newText } = op
        const insertLines = newText.split('\n')
        matchIndent(lines[line], insertLines)
        lines = lines
          .slice(0, line)
          .concat(insertLines)
          .concat(lines.slice(line + deleteLines))
        updateLines(insertLines.length - deleteLines)
        break
      }
      case 'insert': {
        const { content } = op
        const insertLines = content.split('\n')
        matchIndent(lines[line], insertLines)
        lines = lines
          .slice(0, line + 1)
          .concat(insertLines)
          .concat(lines.slice(line + 1))
        updateLines(insertLines.length)
        break
      }
      case 'delete': {
        const { deleteLines } = op
        lines.splice(line, deleteLines)
        updateLines(-deleteLines)
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

  for (let i = 0; i < lines.length; i++) {
    const newLine = lines[i]
    const changedIndent = newLine.match(/^\s*/)?.[0] || ''
    const indentDiff = indent.slice(changedIndent.length)
    lines[i] = indentDiff + newLine
  }
}

const findLineIndex = (lines: string[], op: OpWithLine) => {
  const { lineNumber, startingLineContent, insertAfterLineContent, pasteAfterLineContent } = op
  const line = lineNumber - 1
  const lineRef = startingLineContent || insertAfterLineContent || pasteAfterLineContent

  if (!line) return 0
  if (!lineRef) return line
  const startLineSplit = lineRef.split('\n').map((l) => l.trim())

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
  lineNumber: number
  startingLineContent?: string
  insertAfterLineContent?: string
  pasteAfterLineContent?: string
}

function isOpWithLine(op: any): op is OpWithLine {
  return !!(op as OpWithLine).lineNumber
}

type EditOp = {
  op: 'edit'
  lineNumber: number
  startingLineContent: string
  deleteLines: number
  newText: string
}

type NewOp = {
  op: 'new'
  content: string
}

type InsertOp = {
  op: 'insert'
  lineNumber: number
  insertAfterLineContent: string
  content: string
}

type DeleteOp = {
  op: 'delete'
  lineNumber: number
  startingLineContent: string
  deleteLines: number
}

type CopyOp = {
  op: 'copy'
  lineNumber: number
  startingLineContent: string
  copyLines: number
}

type CutOp = {
  op: 'cut'
  lineNumber: number
  startingLineContent: string
  cutLines: number
}

type PasteOp = {
  op: 'paste'
  lineNumber: number
  pasteAfterLineContent: string
}

export type Op = ReplaceOp | InsertOp | DeleteOp | EditOp | CopyOp | CutOp | PasteOp | NewOp

export const EXAMPLE_OPS: Op[] = [
  {
    op: 'new',
    content: 'text to insert in new file',
  },
  {
    op: 'edit',
    lineNumber: 1,
    deleteLines: 1,
    startingLineContent: 'first line to alter',
    newText: 'goodbye',
  },
  {
    op: 'insert',
    content: 'hello',
    lineNumber: 3,
    insertAfterLineContent: 'existing line to insert below',
  },
  {
    op: 'delete',
    lineNumber: 1,
    startingLineContent: 'first line to delete',
    deleteLines: 5,
  },
  {
    op: 'copy',
    lineNumber: 1,
    startingLineContent: 'first line to copy',
    copyLines: 5,
  },
  {
    op: 'cut',
    lineNumber: 1,
    startingLineContent: 'first line to cut',
    cutLines: 5,
  },
  {
    op: 'paste',
    lineNumber: 1,
    pasteAfterLineContent: 'line content to paste after',
  },
]
