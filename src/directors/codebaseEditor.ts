import { chatCompletion, chatWithHistory, getModel, streamChatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { attachmentListToString, compactMessageHistory } from '@/directors/helpers'
import { ChatMessage, Intent, MessagePayload, Model, PostMessage } from '@/types'
import { log } from '@/utils/logger'
import { fuzzyMatchingFile, fuzzyParseJSON, pluralize } from '@/utils/utils'
import fs from 'fs'
import path from 'path'
import { encode } from 'gpt-3-encoder'
import prompts from '@/prompts'
import { IntentHandler } from '@/directors/intentHandler'
import chalk from 'chalk'

type EditPlan = { context: string; [path: string]: string }

// actor which can take actions on a codebase
export class CodebaseEditor extends IntentHandler {
  initialRun = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ) => {
    const { message, history } = payload
    const planMessageIndex = history.findLastIndex((h) => h.intent == Intent.DRAFTPILOT)

    // only accept history after plan message
    const planMessage = history[planMessageIndex] || history[history.length - 1]
    const recentHistory = history.slice(planMessageIndex - 1)

    const model = getModel(true)
    const basePrompt = prompts.editPilot({
      message: message.content,
      files: '',
      exampleJson: JSON.stringify(EXAMPLE),
    })
    const baseMessage = { role: 'user', content: basePrompt } as ChatMessage
    const messages = compactMessageHistory([...recentHistory, baseMessage], model, {
      role: 'system',
      content: systemMessage,
    })

    const { filesToEdit, fileBodies } = this.readFilesToEdit(payload, planMessage.content)

    const basenames = filesToEdit.map((f) => path.basename(f))
    postMessage({
      role: 'assistant',
      content: `Editing ${pluralize(filesToEdit.length, 'file')}: ${basenames.join(', ')}`,
      intent: Intent.EDIT_FILES,
    })

    await this.editFiles(model, planMessage.content, filesToEdit, fileBodies, messages, postMessage)

    return {
      role: 'assistant',
      content: 'Finished editing files',
      state: filesToEdit,
      intent: Intent.EDIT_FILES,
    } as ChatMessage
  }

  readFilesToEdit = (payload: MessagePayload, plan: string) => {
    const { message } = payload
    const filesToEdit = this.getFilesFromPlan(plan)
    if (message.attachments) message.attachments.forEach((a) => filesToEdit.push(a.name))

    if (filesToEdit.length == 0) {
      log(chalk.yellow('WARNING: No files to edit'))
      // it's possible that code snippets are enough to make edits
    } else {
      filesToEdit.unshift('Files to edit:')
    }

    let fileBodies = []
    for (const file of filesToEdit) {
      if (fs.existsSync(file)) {
        const contents = fs.readFileSync(file, 'utf-8')
        const fileLines = contents.split('\n')
        const decorated = fileLines.map((line, i) => `${i + 1}: ${line}`).join('\n')
        fileBodies.push(file + '\n' + decorated)
      } else {
        fileBodies.push(file + '\nNew File')
      }
    }

    return { filesToEdit, fileBodies }
  }

  editFiles = async (
    model: Model,
    plan: string,
    filesToEdit: string[],
    fileBodies: string[],
    messages: ChatMessage[],
    postMessage: PostMessage
  ) => {
    const similar = await indexer.vectorDB.searchWithScores(plan, 6)
    const similarFuncs = similar
      ?.filter((s) => {
        const [doc, score] = s
        if (score < 0.15) return false
        const existing = filesToEdit.find((f) => doc.metadata.path.includes(f))
        if (existing) return false
        return true
      })
      .map((s) => s[0])
    const similarFuncText = similarFuncs?.length
      ? 'Related functions:\n' +
        similarFuncs.map((s) => s.metadata.path + '\n' + s.pageContent).join('\n\n') +
        '------\n\n'
      : ''

    const messageTokenCount = messages.reduce((acc, m) => acc + encode(m.content).length, 0)
    const tokenBudget = model == '3.5' ? 4000 : 8000

    // check if entire sequence fits in my token count
    const similarFuncLength = encode(similarFuncText).length
    const estimatedOutput = encode(plan).length
    const allFileBodies = fileBodies.join('\n\n')
    const fileBodyTokens = encode(allFileBodies).length

    const editorPrompt = messages[messages.length - 1]
    const baseEditorContent = '\n\n' + editorPrompt.content
    const editFileHelper = async (fileContent: string) => {
      editorPrompt.content =
        similarFuncText +
        'Files to edit (only edit these files):\n' +
        fileContent +
        baseEditorContent

      const response = await streamChatWithHistory(messages, model, postMessage)
      postMessage({
        role: 'assistant',
        content: response,
        intent: Intent.EDIT_FILES,
      } as ChatMessage)
      return response
    }

    const promises: Promise<string>[] = []
    if (messageTokenCount + similarFuncLength + estimatedOutput + fileBodyTokens < tokenBudget) {
      promises.push(editFileHelper(allFileBodies))
    } else {
      // we need to send files separately
      let currentFileBodies: string[] = []
      while (fileBodies.length) {
        const nextFile = fileBodies.shift()!
        const nextFileTokens = encode(nextFile).length

        const totalTokens = messageTokenCount + similarFuncLength + estimatedOutput + nextFileTokens
        if (totalTokens > tokenBudget) {
          promises.push(editFileHelper(currentFileBodies.join('\n\n')))
          currentFileBodies = []
        }
      }
      if (currentFileBodies.length) {
        promises.push(editFileHelper(currentFileBodies.join('\n\n')))
      }
    }

    const results = await Promise.all(promises)
    // fuzzy parse and merge all results
    const merged = results.map((r) => fuzzyParseJSON(r)).reduce((acc, r) => ({ ...acc, ...r }), {})
    return merged
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

  followupRun = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ): Promise<ChatMessage> => {
    return await this.initialRun(payload, attachmentBody, systemMessage, postMessage)
  }

  getFilesFromPlan = (plan: string) => {
    const firstSep = plan.indexOf('---\n')
    const lastSep = plan.lastIndexOf('---\n')

    // files is typically in format - <path> - edits
    const fileRegex = /^. ([^ ]+)/
    let fileText = plan
    if (firstSep > -1 && lastSep > -1) {
      fileText = plan.substring(firstSep + 4, lastSep)
    }

    const splitFileText = fileText.split('\n')
    const files = splitFileText
      .map((f) => {
        const match = f.match(fileRegex)
        if (!match) return ''
        return match[1]
      })
      .filter(Boolean)

    if (files.length) {
      return files
    }

    return []
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
