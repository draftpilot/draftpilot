import fs from 'fs'
import inquirer from 'inquirer'
import path from 'path'

import { isVerbose, log } from '@/utils/logger'

// in debug mode, the editor stops between ops and waits for user input
export const applyEdits = async (edits: string, dryRun?: boolean): Promise<string[]> => {
  const ops = parseOps(edits)
  const debugMode = isVerbose()

  // reverse ops so edits don't affect line numbers
  const opsToRun = dryRun ? [] : ops.slice().reverse()
  for (const op of opsToRun) {
    if (debugMode && !op.code) {
      log('op:', op)
      await inquirer.prompt({ type: 'input', name: 'continue', message: 'Press enter to continue' })
    }

    if (op.delete) {
      fs.unlinkSync(op.file)
      continue
    } else if (op.rename) {
      fs.renameSync(op.file, op.rename)
      continue
    }

    let fileContents: string
    if (fs.existsSync(op.file)) {
      fileContents = fs.readFileSync(op.file, 'utf-8')
    } else {
      const baseDir = path.dirname(op.file)
      if (baseDir) fs.mkdirSync(baseDir, { recursive: true })
      fileContents = ''
    }
    const fileLines = fileContents.split('\n')
    let code = op.code || []
    const startLine = op.start ? findLineIndex(fileLines, op.start, code[0]) : 0
    const endLine = op.end
      ? findLineIndex(fileLines, op.end, code[code.length - 1])
      : fileLines.length

    // check if the change was already applied
    const existingCode = fileLines.slice(startLine, code.length)
    if (existingCode.join('\n') == code.join('\n')) {
      log('change already applied, skipping')
      continue
    }

    // sometimes useless comments get generated
    code = code.filter((c) => !c.includes('rest of code'))

    const before = fileLines.slice(0, startLine - 1)
    const after = fileLines.slice(endLine + 1)
    matchIndent(fileLines[startLine], code)

    if (debugMode) {
      log('lines:', startLine, endLine, 'op:', op)
      await inquirer.prompt({ type: 'input', name: 'continue', message: 'Press enter to continue' })
    }

    const newFileContents = before.concat(code).concat(after).join('\n')
    fs.writeFileSync(op.file, newFileContents)
  }

  // return a list of files we edited
  const editedFiles = new Set(ops.map((op) => op.file))
  return Array.from(editedFiles)
}

export function parseOps(edits: string) {
  // read edits line-by-line
  let lines = edits.split('\n')
  let i = 0

  const ops: Op[] = []

  let op: Op | null = null
  while (i < lines.length) {
    // look for yaml header
    if (lines[i] == '---') {
      const yaml: string[] = []
      // start of yaml block, read until next yaml block
      for (i++; i < lines.length && lines[i] != '---'; i++) {
        yaml.push(lines[i])
      }
      op = parseOp(yaml)
      i++
    } else {
      i++
      continue
    }

    // eat any blank lines
    while (i < lines.length && lines[i].trim() == '') i++

    // parse code block (if it exists)
    const code: string[] = []
    const codeBlockRegex = /^(\d+: )?(.*)$/ // Line number pattern: "number: "
    if (lines[i] != '---') {
      let hasHeader = lines[i].startsWith('```')
      if (hasHeader) i++
      // start of code block, read until end of code block or start of another yaml block
      for (; i < lines.length && !lines[i].startsWith('```') && lines[i] != '---'; i++) {
        const [, , lineContent] = lines[i].match(codeBlockRegex) || [null, null, lines[i]]
        code.push(lineContent)
      }
      if (!hasHeader) {
        while (code.length > 0 && code[code.length - 1].trim() == '') code.pop()
      }
      if (op) op.code = code
      if (lines[i]?.startsWith('```')) i++ // Move to the next line after the end of the code block
    }

    if (!op?.file) {
      log('no file specified for op:', op)
      continue
    }

    ops.push(op)
    op = null
  }
  return ops
}

function parseOp(yaml: string[]): Op | null {
  if (yaml.length == 0) return null
  const partialOp: any = {}
  for (const line of yaml) {
    const [key, value] = line.split(':')
    if (key == 'start' || key == 'end') partialOp[key] = parseInt(value)
    else partialOp[key] = value.trim()
  }
  return partialOp as Op
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

type Op = {
  file: string
  start?: number
  end?: number
  rename?: string
  delete?: boolean
  code?: string[]
}

const findLineIndex = (lines: string[], line: number, lineRef: string) => {
  if (!line) return 0
  if (!lineRef) return line

  const matches = (line: number) => {
    return lineRef?.trim() == lines[line]?.trim()
  }

  // do a search starting from the provided line number
  // GPT is real bad with line numbers so it could be anywhere though
  const maxSearch = Math.max(line, lines.length - line)
  for (let i = 0; i < maxSearch; i++) {
    if (i < lines.length && matches(line + i)) return line + i
    if (i >= 0 && matches(line - i)) return line - i
  }
  log('could not find starting line for op:', line, lineRef)
  if (line > lines.length - 1) return lines.length - 1
  return line
}
