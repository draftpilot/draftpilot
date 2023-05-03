import fs from 'fs'
import inquirer from 'inquirer'

import { isVerbose, log } from '@/utils/logger'

// in debug mode, the editor stops between ops and waits for user input
export const applyOps = async (
  contents: string,
  ops: Op[],
  writeToFile: string | null
): Promise<string> => {
  let lines = contents.split('\n')

  let outputFileName = writeToFile

  // for ops, line numbers apply to the initial contents, so they need to be offset
  for (let i = 0; i < ops.length; i++) {
    let op = ops[i]

    if (op.op == 'new' && lines.length) {
      // sometimes chatgpt will use 'new' when it wants to add lines somewhere
      if (op.line)
        op = {
          op: 'edit',
          line: op.line,
          before: '',
          after: op.content,
        }
      else op = { op: 'edit', line: lines.length - 1, before: '}', after: (op as NewOp).content }
    }

    const line = isOpWithLine(op) ? findLineIndex(lines, op) : 0
    const updateLines = (delta: number) => {
      ops.slice(i + 1).forEach((op2) => {
        if (isOpWithLine(op2) && op2.line > line) op2.line += delta
      })
    }

    if (isVerbose()) {
      const result = lines.join('\n')
      if (outputFileName) fs.writeFileSync(outputFileName, result)

      log('op:', { ...op, line })
      await inquirer.prompt({ type: 'input', name: 'continue', message: 'Press enter to continue' })
    }

    switch (op.op) {
      case 'globalReplace': {
        const { search, replace } = op
        lines = lines.map((l) => l.replaceAll(search, replace))
        break
      }
      case 'new': {
        lines = op.content.split('\n').concat(lines)
        break
      }
      case 'edit': {
        const { before, after } = op
        const deleteLines = before ? before.split('\n') : []
        const insertLines = after ? after.split('\n') : []
        matchIndent(lines[line], insertLines)
        lines = lines
          .slice(0, line)
          .concat(insertLines)
          .concat(lines.slice(line + deleteLines.length))
        updateLines(insertLines.length - deleteLines.length)
        break
      }
      case 'shift': {
        const { content, moveLines } = op
        const contentLines = content ? content.split('\n') : []
        lines = lines.slice(0, line).concat(lines.slice(line + content.length))
        const dest = line + moveLines
        matchIndent(lines[dest], contentLines)
        lines = lines
          .slice(0, dest)
          .concat(contentLines)
          .concat(lines.slice(dest + contentLines.length))
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
  const { op: opName, line } = op
  if (!line) return -1

  const lineRef = opName == 'edit' ? op.before : opName == 'shift' ? op.content : null
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

type GlobalReplaceOp = {
  op: 'globalReplace'
  search: string
  replace: string
}

type OpWithLine = {
  op: string
  line: number
  before?: string
  content?: string
}

function isOpWithLine(op: any): op is OpWithLine {
  return !!(op as OpWithLine).line
}

type EditOp = {
  op: 'edit'
  line: number
  before: string
  after: string
}

type ShiftOp = {
  op: 'shift'
  line: number
  content: string
  moveLines: number
}

type NewOp = {
  op: 'new'
  content: string
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

export type Op = GlobalReplaceOp | EditOp | ShiftOp | NewOp | RenameFile | DeleteFile | ImportOp

export const EXAMPLE_OPS: Op[] = [
  {
    op: 'globalReplace',
    search: 'text to search (case sensitive)',
    replace: 'global file text replacement',
  },
  { op: 'new', content: 'text to insert in new file. use this for brand new files', line: 1 },
  {
    op: 'edit',
    line: 5,
    before: 'previous\ncontent',
    after: 'new\ncontent',
  },
  {
    op: 'edit',
    line: 10,
    before: 'prev content',
    after: 'also use "edit" for inserting\nprev content',
  },
  {
    op: 'shift',
    line: 3,
    content: 'use shift op to move\blines up and down',
    moveLines: -1,
  },
  { op: 'renameFile', newFile: 'newName.ext' },
  { op: 'deleteFile' },
]
