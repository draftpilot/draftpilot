import { chatCompletion, chatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { attachmentListToString, compactMessageHistory } from '@/directors/helpers'
import { ChatMessage, Intent, MessagePayload, Model, PostMessage } from '@/types'
import { log } from '@/utils/logger'
import { fuzzyMatchingFile, fuzzyParseJSON, pluralize } from '@/utils/utils'
import fs from 'fs'
import path from 'path'
import { encode } from 'gpt-3-encoder'

type EditPlan = { context: string; [path: string]: string }

// for files below this length, have the AI output the entire file
const FULL_OUTPUT_THRESHOLD = 250

// actor which can take actions on a codebase
export class CodebaseEditor {
  planChanges = async (payload: MessagePayload, postMessage: PostMessage) => {
    const { message, history } = payload

    const model = message.options?.model || '3.5'
    const attachments = attachmentListToString(message.attachments)

    const prevMessage = history
      .slice()
      .reverse()
      .find((h) => h.role == 'assistant')

    const prefix = `Given the request in the prior messages,`

    const prompt = `${prefix} come up with a list of files to create or modify and the changes to make to them.
If you need more context, you can ask for it, otherwise reply in this exact JSON format:
{
  "path/to/file": "detailed list of changes to make so an AI can understand",
  "path/to/bigchange": "! if the changes are large/complex (e.g. 10+ lines of code), add ! at the beginning"
  ...
}

The JSON output should ONLY contain string values.

JSON Change Plan or question to ask the user:`
    const newMessage = { ...message, content: prompt }
    const messages = compactMessageHistory([...history, newMessage], model, {
      role: 'system',
      content: `You are part of a larger machine-run system. 
1. Do not make up a plan if uncertain.
2. Do not make up or reference files/paths to edit other than what was mentioned
3. Only output in the JSON format specified, with file paths as keys & changes as values.`,
    })

    const response = await chatWithHistory(messages, model)

    const parsed: EditPlan = fuzzyParseJSON(response)
    if (parsed) {
      const context = prevMessage ? prevMessage.content : message.content
      const files = Object.keys(parsed)
        .filter((f) => f != 'context')
        .map((f) => {
          if (f.indexOf('/') == -1) {
            return fuzzyMatchingFile(f, indexer.files) || f
          } else {
            return f
          }
        })

      const basenames = files.map((f) => path.basename(f))
      postMessage({
        role: 'assistant',
        content: `Editing ${pluralize(files.length, 'file')}: ${basenames.join(', ')}`,
        options: { model },
        intent: Intent.ACTION,
      })
      await Promise.all(
        files.map(async (file) => {
          const changes = parsed[file]
          const fileModel = '4' // changes.startsWith('!') ? '4' : model
          await this.editFile(fileModel, context, file, changes, postMessage)
        })
      )
      postMessage({
        role: 'assistant',
        content: `OUTCOME: Files edited: ${files.join(', ')}`,
        options: { model },
        intent: Intent.DONE,
      })
    } else {
      postMessage({
        role: 'assistant',
        content: response,
        options: { model },
        intent: Intent.ACTION,
      })
    }
  }

  editFile = async (
    model: Model,
    plan: string,
    file: string,
    changes: any,
    postMessage: PostMessage
  ) => {
    let contents = ''
    let decoratedContents = '<empty file>'
    let outputFullFile = true

    if (fs.existsSync(file)) {
      contents = fs.readFileSync(file, 'utf8')
      const fileLines = contents.split('\n')
      log('editing file', file, fileLines.length)

      outputFullFile = fileLines.length < FULL_OUTPUT_THRESHOLD

      decoratedContents = outputFullFile
        ? contents
        : fileLines.map((line, i) => `${i + 1}: ${line}`).join('\n')
    } else {
      log('creating file', file)
    }

    const systemMessage = `You are a codebase editor. Respond only in the format requested and do 
not change anything unnecessarily, as your output is written directly to the codebase.`
    const promptPrefix = `You are given the following plan: ${plan}

Now editing: ${file}
Changes to make: ${JSON.stringify(changes)}

---
${decoratedContents}
---
`

    const promptSuffix = outputFullFile
      ? `---

Output the entire file that I will write to disk, only changing the requested lines, and no markdown like \`\`\`:`
      : `---

You return a sequence of operations in JSON. This example shows all possible operations & thier
inputs: ${JSON.stringify(EXAMPLE)}

JSON array of operations to perform:`

    const similar = await indexer.vectorDB.searchWithScores(plan + '\n' + changes, 6)
    const similarFuncs = similar
      ?.filter((s) => {
        const [doc, score] = s
        if (score < 0.15) return false
        if (doc.metadata.path.includes(file)) return false
        return true
      })
      .map((s) => s[0])

    const estimatedOutput = outputFullFile ? encode(contents).length || 300 : 100
    let tokenBudget = (model == '3.5' ? 3900 : 7000) - encode(promptPrefix + promptSuffix).length
    const funcsToShow = (similarFuncs || []).filter((doc) => {
      const encoded = encode(doc.pageContent).length
      if (tokenBudget > encoded) {
        tokenBudget -= encoded
        return true
      }
      return false
    })

    const decoratedFuncs = funcsToShow.length
      ? 'Possibly related code:\n' + funcsToShow.map((s) => s.pageContent).join('\n---\n')
      : ''

    const prompt = promptPrefix + decoratedFuncs + promptSuffix

    const totalTokens = encode(prompt).length + estimatedOutput
    const estimatedDuration = totalTokens * (model == '3.5' ? 7 : 10)

    postMessage({
      role: 'assistant',
      content: file,
      progressDuration: estimatedDuration,
    })

    const response = await chatCompletion(prompt, model, systemMessage)

    let output: string = response
    if (!outputFullFile) {
      const parsed: Op[] = fuzzyParseJSON(response)
      if (!parsed) throw new Error(`Could not parse response`)

      output = this.applyOps(contents, parsed)
    } else if (output.startsWith('```') || output.endsWith('```')) {
      const start = output.indexOf('```')
      const end = output.lastIndexOf('```')
      if (end > start + 100) output = output.substring(start + 3, end)
    } else if (output.startsWith('---') || output.endsWith('---')) {
      const start = output.indexOf('---')
      const end = output.lastIndexOf('---')
      if (end > start + 100) output = output.substring(start + 3, end)
    }

    if (!contents) fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, output, 'utf8')

    postMessage({
      role: 'assistant',
      content: file,
      progressDuration: 0,
    })
  }

  applyOps = (contents: string, ops: Op[]) => {
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
          matchIndent(lines[line - 1], insertLines)
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
          matchIndent(lines[line - 1], insertLines)
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
          matchIndent(lines[line - 1], clipboard)
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
  const trimmed = startLine.trim()
  // do a search starting from the provided line number
  // GPT is real bad with line numbers so it could be anywhere though
  const maxSearch = Math.max(line, lines.length - line)
  for (let i = 0; i < maxSearch; i++) {
    if (i < lines.length && lines[line + i]?.trim() == trimmed) return line + i
    if (i >= 0 && lines[line - i]?.trim() == trimmed) return line - i
  }
  log('could not find starting line for op, searched', maxSearch, op)
  if (line > lines.length - 0) return lines.length - 1
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

type Op = ReplaceOp | InsertOp | DeleteOp | EditOp | CopyOp | CutOp | PasteOp

const EXAMPLE: Op[] = [
  { op: 'replace', search: 'text to search', replace: 'replace with text' },
  { op: 'edit', line: 1, delLines: 1, startLine: 'first line to alter', insert: 'goodbye' },
  { op: 'insert', insert: 'hello', line: 3, startLine: 'existing line to insert below' },
  { op: 'delete', line: 1, startLine: 'first line to delete', delLines: 5 },
  { op: 'copy', line: 1, startLine: 'first line to copy', copyLines: 5 },
  { op: 'cut', line: 1, startLine: 'first line to cut', cutLines: 5 },
  { op: 'paste', line: 1 },
]
