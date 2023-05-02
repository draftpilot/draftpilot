import fs from 'fs'

import { indexer } from '@/db/indexer'
import { AutoPilot } from '@/directors/autoPilot'

// performs the file editing operation from a plan
export default async function editCommand(planFile: string, opts: any) {
  await indexer.loadFilesIntoVectors()

  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'))

  const autopilot = new AutoPilot()
  await autopilot.edit(plan, opts)
}
