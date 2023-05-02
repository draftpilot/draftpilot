import fs from 'fs'
import path from 'path'

import config from '@/config'
import { readProjectContext } from '@/context/projectContext'
import { AutoPilotEditor, EditOps } from '@/directors/autoPilotEditor'
import { AutoPilotPlanner, isFailedPlan, PlanResult } from '@/directors/autoPilotPlanner'
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

  systemMessage: ChatMessage

  constructor() {
    this.context = readProjectContext() || ''

    const project = path.basename(process.cwd())
    const systemMessage = prompts.systemMessage({
      language: detectProjectLanguage() || 'unknown',
      project,
      context: readProjectContext() || '',
    })
    this.systemMessage = {
      role: 'system',
      content: systemMessage,
    }
  }

  run = async (request: string, opts: AutopilotOpts) => {
    const plan = await this.plan(request, opts)

    const baseCommit = opts.validate || git(['rev-parse', 'HEAD']).trim()

    const edits = await this.edit(plan, opts)

    this.commit(edits, request, opts)

    await this.validate(plan, baseCommit, edits, opts)
  }

  plan = async (request: string, opts: AutopilotOpts) => {
    let plan: PlanResult
    const history: ChatMessage[] = [
      {
        role: 'user',
        content: request,
      },
    ]

    if (opts.planFile) {
      plan = JSON.parse(fs.readFileSync(opts.planFile, 'utf8'))
    } else {
      const output = await this.planner.plan(request, history, this.systemMessage, opts.diff)
      if (isFailedPlan(output)) throw new Error('Planner error: ' + output.failure)
      plan = output
      if (!plan.edits) throw new Error('Planner error: no edits')
      plan.request = request
      fs.writeFileSync(`${config.configFolder}/plan.txt`, JSON.stringify(plan, null, 2))
    }
    return plan
  }

  edit = async (plan: PlanResult, opts: AutopilotOpts) => {
    let edits: EditOps
    if (opts.editFile) {
      edits = JSON.parse(fs.readFileSync(opts.editFile, 'utf8'))
    } else {
      edits = await this.editor.generateEdits(
        plan.request || 'follow the plan',
        plan,
        this.systemMessage
      )
      fs.writeFileSync(config.configFolder + '/edit.txt', JSON.stringify(edits, null, 2))
    }

    if (!opts.validate && !opts.validationFile) {
      await this.editor.applyEdits(edits)
    }

    return edits
  }

  commit = (edits: EditOps, message: string, opts: AutopilotOpts) => {
    // add all files
    if (!opts.skipGit) {
      git(['add', ...Object.keys(edits)])
      git(['commit', '-m', message])
    }
  }

  validate = async (plan: PlanResult, baseCommit: string, edits: EditOps, opts: AutopilotOpts) => {
    for (let i = 0; i < 2; i++) {
      let validatedResult: ValidatorOutput
      if (opts.validationFile) {
        validatedResult = JSON.parse(fs.readFileSync(opts.validationFile, 'utf8'))
        opts.validationFile = undefined
      } else {
        const diff = git(['diff', baseCommit])
        validatedResult = await this.validator.validate(plan, [], edits, diff, this.systemMessage)
      }

      if (validatedResult.result == 'good') {
        fs.writeFileSync(config.configFolder + '/followup.txt', validatedResult.comments)
        return
      }
      await this.validator.fixResults(plan, validatedResult, this.editor, this.systemMessage)
    }
  }

  planner = new AutoPilotPlanner()
  editor = new AutoPilotEditor()
  validator = new AutoPilotValidator()
}
