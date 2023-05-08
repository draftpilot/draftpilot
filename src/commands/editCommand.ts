import fs from 'fs'
import inquirer from 'inquirer'

import { indexer } from '@/db/indexer'
import { AutoPilot } from '@/directors/autoPilot'
import { git } from '@/utils/git'

// performs the file editing operation from a plan
export default async function editCommand(planFile: string, opts: any) {
  await indexer.loadFilesIntoVectors()

  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'))

  const autopilot = new AutoPilot()
  const edits = await autopilot.edit(plan, opts)

  const validate = await inquirer.prompt({
    type: 'confirm',
    name: 'continue',
    message: 'Perform validation? (this will also commit)',
  })
  if (!validate.continue) return

  const baseCommit = git(['rev-parse', 'HEAD']).trim()

  autopilot.commit(edits, plan.request, opts)

  await autopilot.validate(plan, baseCommit, edits, opts)
}
