import fs from 'fs'

import openAIApi, { getModel } from '@/ai/api'
import config from '@/config'
import { AutoPilotEditor, EditOps } from '@/directors/autoPilotEditor'
import { PlanResult } from '@/directors/autoPilotPlanner'
import { compactMessageHistory } from '@/directors/helpers'
import prompts from '@/prompts'
import { ChatMessage } from '@/types'
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

  validateCompiles = async (
    filesChanged: string[],
    plan: PlanResult,
    editor: AutoPilotEditor,
    systemMessage: ChatMessage
  ) => {
    // take one pass to validate whether we compile
    let compilerOutput: string[] | null = null
    let filesWithErrors: string[] = []
    try {
      if (fs.existsSync('tsconfig.json')) {
        const fullCompilerOutput = spawn('npx', ['tsc', '--noEmit', '--pretty', 'false'])
          .split('\n')
          .filter(Boolean)
        compilerOutput = fullCompilerOutput.filter((line) => {
          return filesChanged.find((f) => line.startsWith(f))
        })
        compilerOutput = compilerOutput.slice(0, 75) // take first 75 lines if lots of errors
        filesWithErrors = this.parseTSCOutput(compilerOutput)
      }
    } catch (e: any) {
      log('Error running tsc: ' + e.toString())
      return
    }

    if (!compilerOutput || filesWithErrors.length == 0) return

    log('fixing tsc errors: ' + compilerOutput.join('\n'))

    const fileEditMap: ValidatorOutput = { result: 'rewrite', comments: 'tsc errors' }
    compilerOutput.forEach((line) => {
      const file = line.split('(')[0]
      if (filesWithErrors.includes(file)) {
        fileEditMap[file] = fileEditMap[file] ? fileEditMap[file] + '\n' + line : line
      }
    })

    await this.fixResults(plan, fileEditMap, editor, [], systemMessage)
  }

  validate = async (
    plan: PlanResult,
    history: ChatMessage[],
    diff: string,
    systemMessage: ChatMessage
  ) => {
    const validatePrompt = prompts.autoPilotValidator({
      diff,
      request: plan.request!,
      plan: JSON.stringify(plan),
    })

    const validateMessage: ChatMessage = {
      role: 'user',
      content: validatePrompt,
    }
    history.push(validateMessage)

    const model = getModel(true)

    const messages = compactMessageHistory(history, model, systemMessage)
    const result = await openAIApi.streamChatWithHistory(messages, model, (response) => {
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
      const response = await openAIApi.chatCompletion(
        prompts.jsonFixer({ input: output, schema }),
        '3.5'
      )
      parsed = fuzzyParseJSON(response)
    }

    if (!parsed) return { result: 'good', comments: 'Unable to parse JSON response: ' + output }

    return parsed
  }

  fixResults = async (
    plan: PlanResult,
    output: ValidatorOutput,
    editor: AutoPilotEditor,
    history: ChatMessage[],
    systemMessage: ChatMessage
  ) => {
    const validationEdit: PlanResult['edits'] = output
    delete validationEdit.result

    const validationPlan: PlanResult = {
      request: validationEdit.comments || plan.request,
      plan: ['fix the validation result'],
      edits: validationEdit,
    }
    delete validationEdit.comments

    const edits = await editor.generateEdits(plan.request, validationPlan, history, systemMessage)
    await editor.applyEdits(edits)

    const commitMessage = 'fixing output: ' + Object.values(validationEdit).join(', ')

    git(['add', ...Object.keys(edits)])
    git(['commit', '-m', commitMessage])
  }

  parseTSCOutput = (output: string[]) => {
    const regex = /[\w/]+(?:\.\w+)+/g
    const fileNamesSet = new Set<string>()

    output.forEach((line) => {
      const match = line.match(regex)
      if (match && match[0]) {
        fileNamesSet.add(match[0])
      }
    })

    return Array.from(fileNamesSet)
  }
}

const schema = `{ "result": "good", "comments": "string" } or { "result": "rewrite", "file": "what to change" }`
