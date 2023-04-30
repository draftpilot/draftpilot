import fs from 'fs'

import { indexer } from '@/db/indexer'
import { AutoPilot } from '@/directors/autoPilot'
import { git } from '@/utils/git'
import { log } from '@/utils/logger'

// performs autonomous draftpilot from command like
export default async function autopilot(branch: string, request: string, options: any) {
  // create a new branch
  if (!options.skipGit) git(['checkout', '-b', branch])

  await indexer.loadFilesIntoVectors()

  const autopilot = new AutoPilot()
  await autopilot.run(request, options)
}
