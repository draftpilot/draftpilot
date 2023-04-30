import fs from 'fs'

import { chatCompletion } from '@/ai/api'
import { CodebaseEditor } from '@/directors/codebaseEditor'
import prompts from '@/prompts'
import { ChatMessage, Intent } from '@/types'
import { applyOps, Op } from '@/utils/editOps'
import { log } from '@/utils/logger'
import { fuzzyParseJSON } from '@/utils/utils'

export type EditOps = {
  [file: string]: string | Op[]
}

export class AutoPilotEditor {
  interrupted = new Set<string>()

  generateEdits = async (
    request: string,
    result: { plan?: string[]; edits?: any },
    systemMessage: string
  ) => {
    const editMessage: ChatMessage = {
      role: 'assistant',
      intent: Intent.DRAFTPILOT,
      content: `User request: ${request}\n\nPlan: ${result.plan?.join(
        '\n'
      )}\n\nEdits:\n${JSON.stringify(result.edits, null, 2)}`,
    }

    const output = await this.editor.initialRun(
      { message: { role: 'user', content: 'Do it' }, history: [editMessage], id: 'autopilot' },
      undefined,
      systemMessage,
      (msg) => process.stdout.write(typeof msg === 'string' ? msg : '\n')
    )

    fs.writeFileSync('/tmp/edit.txt', output.content)

    const parsed: EditOps = await this.parseOutput(output.content)
    return parsed
  }

  applyEdits = async (edits: EditOps) => {
    for (const file of Object.keys(edits)) {
      log('writing to', file)
      const ops = edits[file]
      if (typeof ops == 'string') {
        fs.writeFileSync(file, ops)
      } else {
        const contents = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : ''
        const newContents = applyOps(contents, ops)
        fs.writeFileSync(file, newContents)
      }
    }

    return edits
  }

  parseOutput = async (output: string): Promise<EditOps> => {
    let parsed = fuzzyParseJSON(output)
    if (!parsed) {
      const fixer = prompts.jsonFixer({ input: output, schema })
      const response = await chatCompletion(fixer, '3.5')
      parsed = fuzzyParseJSON(response)
    }

    if (!parsed) throw new Error('parser: Could not parse output')

    return parsed
  }

  editor = new CodebaseEditor(this.interrupted)
}

const schema = `{ "/path/to/file", [{ op: "operation" }] }`
