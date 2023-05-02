import fs from 'fs'
import path from 'path'

import { chatCompletion, getModel } from '@/ai/api'
import { CodebaseEditor } from '@/directors/codebaseEditor'
import { compactMessageHistory } from '@/directors/helpers'
import prompts from '@/prompts'
import { ChatMessage, Intent, PostMessage } from '@/types'
import { applyOps, Op } from '@/utils/editOps'
import { git } from '@/utils/git'
import { log } from '@/utils/logger'
import { fuzzyParseJSON, spawn } from '@/utils/utils'

export type EditOps = {
  [file: string]: string | Op[]
}

export class AutoPilotEditor {
  interrupted = new Set<string>()

  generateEdits = async (
    request: string,
    history: ChatMessage[],
    editPlan: { plan?: string[]; edits?: any }
  ) => {
    const model = getModel(true)
    const plan = `Request: ${request}

Plan:
${editPlan.plan!.join('\n')}

Files to edit:
${Object.keys(editPlan.edits!)
  .map((f) => `- ${f} - ${editPlan.edits![f]}`)
  .join('\n')}`

    const filesToEdit = Object.keys(editPlan.edits || {})
    const fileBodies = this.editor.getFileBodies(filesToEdit)

    const postMessage: PostMessage = (msg) =>
      process.stdout.write(typeof msg === 'string' ? msg : '\n')

    // in order to have full room for edits, truncate history
    const message: ChatMessage = { role: 'assistant', content: plan }
    const messages = compactMessageHistory([message], model)

    const output = await this.editor.editFiles(
      model,
      plan,
      filesToEdit,
      fileBodies,
      messages,
      postMessage
    )

    const parsed: EditOps = await this.parseOutput(output)
    return parsed
  }

  applyEdits = async (edits: EditOps) => {
    for (const file of Object.keys(edits)) {
      log('writing to', file)
      const baseDir = path.dirname(file)
      if (baseDir) fs.mkdirSync(baseDir, { recursive: true })
      const ops = edits[file]
      if (typeof ops == 'string') {
        fs.writeFileSync(file, ops)
      } else {
        const contents = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : ''
        const newContents = applyOps(contents, ops)
        fs.writeFileSync(file, newContents)
      }
    }

    if (fs.existsSync('package.json')) {
      const packageManager = fs.existsSync('yarn.lock')
        ? 'yarn'
        : fs.existsSync('pnpm-lock.yaml')
        ? 'pnpm'
        : 'npm'
      log(`running ${packageManager} install`)

      // always run package manager to install deps, even if package.json didn't change
      try {
        await spawn(packageManager, ['install'])
        git(['add', 'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'])
      } catch (e) {
        log('warning: failed to run package manager', e)
      }

      const packageJson = fs.readFileSync('package.json', 'utf8')
      if (packageJson.includes('prettier')) {
        spawn('npx', ['-y', 'prettier', ...Object.keys(edits)])
      }
    }

    return edits
  }

  parseOutput = async (output: string): Promise<EditOps> => {
    let parsed = fuzzyParseJSON(output)
    if (!parsed) {
      log('warning: received invalid json, attempting fix')
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
