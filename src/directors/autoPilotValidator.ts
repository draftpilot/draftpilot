import fs from 'fs'

import { chatCompletion, getModel, streamChatWithHistory } from '@/ai/api'
import { EditOps } from '@/directors/autoPilotEditor'
import { CodebaseEditor } from '@/directors/codebaseEditor'
import { compactMessageHistory } from '@/directors/helpers'
import prompts from '@/prompts'
import { ChatMessage, Intent } from '@/types'
import { applyOps, Op } from '@/utils/editOps'
import { git } from '@/utils/git'
import { log } from '@/utils/logger'
import { fuzzyParseJSON, spawn } from '@/utils/utils'

export class AutoPilotValidator {
  interrupted = new Set<string>()

  validate = async (request: string, history: ChatMessage[], edits: EditOps) => {
    // add all changes except .draftpilot
    git(['add', ...Object.keys(edits)])

    const diff = git(['diff', '--cached'])

    let compilerOutput: string | null = null
    try {
      if (fs.existsSync('tsconfig.json')) {
        const fullCompilerOutput = spawn('npx', [
          'tsc',
          '--pretty',
          '--noEmit',
          '--project',
          '.',
        ]).split('\n')
        compilerOutput = fullCompilerOutput.slice(fullCompilerOutput.length - 50).join('\n')
      }
    } catch (e: any) {
      compilerOutput = 'Error running tsc: ' + e.toString()
    }

    const validatePrompt = prompts.autoPilotValidator({
      diff,
      request,
      compilerOutput,
    })

    const validateMessage: ChatMessage = {
      role: 'user',
      content: validatePrompt,
    }
    history.push(validateMessage)

    const model = getModel(true)

    const messages = compactMessageHistory(history, model)
    const result = await streamChatWithHistory(messages, model, (response) => {
      process.stdout.write(typeof response == 'string' ? response : '\n')
    })

    history.push({ role: 'assistant', content: result })

    fs.writeFileSync('/tmp/validation.txt', result)

    return result
  }
}

const schema = `{ "/path/to/file", [{ op: "operation" }] }`
