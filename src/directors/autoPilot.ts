import fs from 'fs'
import path from 'path'

import config from '@/config'
import { readProjectContext } from '@/context/projectContext'
import { AutoPilotEditor, EditOps } from '@/directors/autoPilotEditor'
import { AutoPilotPlanner, PlanResult } from '@/directors/autoPilotPlanner'
import { AutoPilotValidator, ValidatorOutput } from '@/directors/autoPilotValidator'
import { detectProjectLanguage } from '@/directors/helpers'
import prompts from '@/prompts'
import { ChatMessage } from '@/types'
import { git } from '@/utils/git'

export type AutopilotOpts = {
  editFile?: string
  planFile?: string
  validationFile?: string
  skipGit?: boolean
  validate?: string
  diff?: string
}

export class AutoPilot {
  context: string = ''
  interrupted = new Set<string>()

  constructor() {
    this.context = readProjectContext() || ''
  }

  systemMessage = () => {
    const project = path.basename(process.cwd())
    return prompts.systemMessage({
      language: detectProjectLanguage() || 'unknown',
      project,
      context: readProjectContext() || '',
    })
  }

  run = async (request: string, opts: AutopilotOpts) => {
    const systemMessage = this.systemMessage()

    let plan: PlanResult
    const history: ChatMessage[] = [
      {
        role: 'system',
        content: systemMessage,
      },
      {
        role: 'user',
        content: request,
      },
    ]

    if (opts.planFile) {
      plan = JSON.parse(fs.readFileSync(opts.planFile, 'utf8'))
    } else {
      plan = await this.planner.plan(request, history, systemMessage, opts.diff)
      if (plan.failure) throw new Error('Planner error: ' + plan.failure)
      if (!plan.edits) throw new Error('Planner error: no edits')
    }

    let edits: EditOps
    if (opts.editFile) {
      edits = JSON.parse(fs.readFileSync(opts.editFile, 'utf8'))
    } else {
      edits = await this.editor.generateEdits(request, history, plan)
      fs.writeFileSync(config.configFolder + '/edit.txt', JSON.stringify(edits, null, 2))
    }

    const baseCommit = opts.validate || git(['rev-parse', 'HEAD']).trim()

    if (!opts.validate && !opts.validationFile) {
      await this.editor.applyEdits(edits)
    }

    // add all files
    if (!opts.skipGit) {
      git(['add', ...Object.keys(edits)])
      git(['commit', '-m', request])
    }

    for (let i = 0; i < 2; i++) {
      let validatedResult: ValidatorOutput
      if (opts.validationFile) {
        validatedResult = JSON.parse(fs.readFileSync(opts.validationFile, 'utf8'))
        opts.validationFile = undefined
      } else {
        const diff = git(['diff', baseCommit])
        validatedResult = await this.validator.validate(request, [], edits, diff)
      }

      if (validatedResult.result == 'good') {
        fs.writeFileSync(config.configFolder + '/followup.txt', validatedResult.comments)
        return
      }
      await this.validator.fixResults(request, history, validatedResult, this.editor)
    }
  }

  planner = new AutoPilotPlanner()
  editor = new AutoPilotEditor()
  validator = new AutoPilotValidator()
}
