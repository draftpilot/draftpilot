import { chatCompletion, chatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { compactMessageHistory } from '@/directors/helpers'
import { ChatMessage, MessagePayload, PostMessage } from '@/types'
import { log } from '@/utils/logger'
import { fuzzyParseJSON } from '@/utils/utils'
import fs from 'fs'
import { encode } from 'gpt-3-encoder'

type EditPlan = { context: string; [path: string]: string }

// actor which can take actions on a codebase
export class CodebaseEditor {
  planChanges = async (payload: MessagePayload, postMessage: PostMessage) => {
    const { message, history } = payload

    const model = message.options?.model || '3.5'

    const prompt = `Given the plan discussed, come up with a list of files to create or modify and
the changes to make to them in this JSON format. If you need more context, you can ask for it,
otherwise reply in JSON:
{
  "context": "description of overall changes to be made so AI agents have the context",
  "path/to/file": "detailed list of changes to make so an AI can understand"
  ...
}`
    const newMessage = { ...message, content: prompt }
    const messages = compactMessageHistory([...history, newMessage], model)

    const response = await chatWithHistory(messages, model)

    const parsed: EditPlan = fuzzyParseJSON(response, true)
    if (parsed) {
      const context = parsed.context || history[history.length - 1].content
      await Promise.all(
        Object.keys(parsed).map(async (file) => {
          if (file == 'context') return
          const changes = parsed[file]
          await this.editFile(context, file, changes, postMessage)
        })
      )
    } else {
      postMessage({
        role: 'assistant',
        content: response,
        options: { model },
      })
    }
  }

  editFile = async (plan: string, file: string, changes: string, postMessage: PostMessage) => {
    let contents = '<empty file>'

    if (fs.existsSync(file)) {
      contents = fs.readFileSync(file, 'utf8')
    }

    const systemMessage = `You are a codebase editor. Respond only in the JSON format requested.`
    const promptPrefix = `You are a codebase editor. You are given the following plan: ${plan}

Now editing: ${file}
Changes to make: ${changes}

---
${contents}
---
`

    const promptSuffix = `---

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

    let tokenBudget = 7000 - encode(promptPrefix + promptSuffix).length
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

    const response = await chatCompletion(prompt, '4', systemMessage)

    const parsed: Op[] = fuzzyParseJSON(response, true)
    if (!parsed) throw new Error(`Could not parse response`)

    // todo apply ops to contents
    log('TODO')
  }
}

type ReplaceOp = {
  op: 'replace'
  search: string
  replace: string
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
const ops: Op['op'][] = ['replace', 'insert', 'delete', 'edit', 'copy', 'cut', 'paste']

const EXAMPLE: Op[] = [
  { op: 'replace', search: 'text to search', replace: 'replace with text' },
  { op: 'edit', line: 1, delLines: 1, startLine: 'first line to alter', insert: 'goodbye' },
  { op: 'insert', insert: 'hello', line: 3, startLine: 'existing line to insert below' },
  { op: 'delete', line: 1, startLine: 'first line to delete', delLines: 5 },
  { op: 'copy', line: 1, startLine: 'first line to copy', copyLines: 5 },
  { op: 'cut', line: 1, startLine: 'first line to cut', cutLines: 5 },
  { op: 'paste', line: 1 },
]
