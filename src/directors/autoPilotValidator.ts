import fs from 'fs'

import { chatCompletion, getModel, streamChatWithHistory } from '@/ai/api'
import config from '@/config'
import { AutoPilotEditor, EditOps } from '@/directors/autoPilotEditor'
import { PlanResult } from '@/directors/autoPilotPlanner'
import { CodebaseEditor } from '@/directors/codebaseEditor'
import { compactMessageHistory } from '@/directors/helpers'
import prompts from '@/prompts'
import { ChatMessage, Intent } from '@/types'
import { applyOps, Op } from '@/utils/editOps'
import { git } from '@/utils/git'
import { log } from '@/utils/logger'
import { fuzzyParseJSON, spawn } from '@/utils/utils'

export type ValidatorOutput = {
  result: 'rewrite' | 'good'
  comments: string
  [file: string]: string
}

export class AutoPilotValidator {
  interrupted = new Set<string>()

  validate = async (request: string, history: ChatMessage[], edits: EditOps, diff: string) => {
    let compilerOutput: string | null = null
    try {
      if (fs.existsSync('tsconfig.json')) {
        const fullCompilerOutput = spawn('npx', ['tsc', '--noEmit']).split('\n').filter(Boolean)
        compilerOutput = fullCompilerOutput.slice(fullCompilerOutput.length - 100).join('\n')
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

    fs.writeFileSync(config.configFolder + '/validation.txt', result)

    const parsed = await this.parseResult(result)

    return parsed
  }

  parseResult = async (output: string): Promise<ValidatorOutput> => {
    let parsed: ValidatorOutput | null = fuzzyParseJSON(output)
    if (!parsed) {
      log('warning: received invalid json, attempting fix')
      const response = await chatCompletion(prompts.jsonFixer({ input: output, schema }), '3.5')
      parsed = fuzzyParseJSON(response)
    }

    if (!parsed) return { result: 'good', comments: 'Unable to parse JSON response: ' + output }

    return parsed
  }

  fixResults = async (
    request: string,
    history: ChatMessage[],
    output: ValidatorOutput,
    editor: AutoPilotEditor
  ) => {
    const validationEdit: PlanResult['edits'] = output
    delete validationEdit.result

    const validationPlan: PlanResult = {
      plan: ['fix the validation result'],
      edits: validationEdit,
    }
    const edits = await editor.generateEdits(request, history, validationPlan)
    await editor.applyEdits(edits)

    const commitMessage = 'fixing output: ' + Object.values(validationEdit).join(', ')

    git(['add', ...Object.keys(edits)])
    git(['commit', '-m', commitMessage])
  }
}

const schema = `{ "result": "good", "comments": "string" } or { "result": "rewrite", "file": "what to change" }`
