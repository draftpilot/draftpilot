import fs from 'fs'
import path from 'path'

import openAIApi, { getModel } from '@/ai/api'
import { PlanResult } from '@/directors/autoPilotPlanner'
import { CodebaseEditor } from '@/directors/codebaseEditor'
import { compactMessageHistory } from '@/directors/helpers'
import prompts from '@/prompts'
import { ChatMessage, Intent, PostMessage } from '@/types'
import { applyOps, Op } from '@/utils/editOps'
import { git } from '@/utils/git'
import { log, verboseLog } from '@/utils/logger'
import { fuzzyParseJSON, spawn } from '@/utils/utils'

export type EditOps = {
  [file: string]: string | Op[]
}

export class AutoPilotEditor {
  interrupted = new Set<string>()

  generateEdits = async (
    request: string,
    editPlan: PlanResult,
    history: ChatMessage[],
    systemMessage: ChatMessage
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
    const messages = compactMessageHistory([...history, message], model, systemMessage)

    const output = await this.editor.editFiles(
      model,
      plan,
      filesToEdit,
      fileBodies,
      messages,
      editPlan.references || [],
      postMessage
    )
    process.stdout.write('\n')

    const parsed: EditOps = await this.parseOutput(output)
    return parsed
  }

  applyEdits = async (edits: EditOps) => {
    for (const file of Object.keys(edits)) {
      log('writing to', file)
      const baseDir = path.dirname(file)
      if (baseDir) fs.mkdirSync(baseDir, { recursive: true })
      const ops = edits[file]
      verboseLog('  ops', ops)
      if (typeof ops == 'string') {
        fs.writeFileSync(file, ops)
      } else {
        const contents = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : ''
        await applyOps(contents, ops, file)
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
        await spawn(packageManager, ['install', '--production=false'], {
          env: { NODE_ENV: 'development' },
        })
        git(['add', 'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'])
      } catch (e) {
        log('warning: failed to run package manager', e)
      }

      const packageJson = fs.readFileSync('package.json', 'utf8')
      if (packageJson.includes('prettier')) {
        spawn('npx', ['-y', 'prettier', '-w', ...Object.keys(edits)])
      }
    }

    return edits
  }

  parseOutput = async (output: string): Promise<EditOps> => {
    let parsed = fuzzyParseJSON(output)
    if (!parsed) {
      log('warning: received invalid json, attempting fix')
      const fixer = prompts.jsonFixer({ input: output, schema })
      const response = await openAIApi.chatCompletion(fixer, '3.5')
      parsed = fuzzyParseJSON(response)
    }

    if (!parsed) throw new Error('parser: Could not parse output')

    // only acceptable format: { "/path/to/file": "new contents" or array }

    Object.keys(parsed).forEach((key) => {
      const value = parsed[key]
      if (typeof value === 'string') return
      if (Array.isArray(value)) return
      // if it's an object, often there's only one key and the value is what we want
      if (typeof value === 'object') {
        const keys = Object.keys(value)
        if (keys.length === 1) {
          parsed[key] = value[keys[0]]
          return
        }
      }
      log('warning: invalid value for key', key, value)
    })

    return parsed
  }

  editor = new CodebaseEditor(this.interrupted)
}

const schema = `{ "/path/to/file", [{ op: "operation" }] }`
