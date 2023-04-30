import fs from 'fs'
import path from 'path'

import { readProjectContext } from '@/context/projectContext'
import { AutoPilotEditor, EditOps } from '@/directors/autoPilotEditor'
import { AutoPilotPlanner, PlanResult } from '@/directors/autoPilotPlanner'
import { detectProjectLanguage } from '@/directors/helpers'
import prompts from '@/prompts'

type Opts = {
  editFile?: string
  planFile?: string
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

  run = async (request: string, opts: Opts) => {
    const systemMessage = this.systemMessage()

    let plan: PlanResult
    if (opts.planFile) {
      plan = JSON.parse(fs.readFileSync(opts.planFile, 'utf8'))
    } else {
      plan = await this.planner.plan(request, systemMessage)
      if (plan.failure) throw new Error('Planner error: ' + plan.failure)
      if (!plan.edits) throw new Error('Planner error: no edits')
    }

    let edits: EditOps
    if (opts.editFile) {
      edits = JSON.parse(fs.readFileSync(opts.editFile, 'utf8'))
    } else {
      edits = await this.editor.generateEdits(request, plan, systemMessage)
    }
    await this.editor.applyEdits(edits)
  }

  planner = new AutoPilotPlanner()
  editor = new AutoPilotEditor()
}
