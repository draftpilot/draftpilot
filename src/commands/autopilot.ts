import fs from 'fs'

import { indexer } from '@/db/indexer'
import { AutoPilot } from '@/directors/autoPilot'
import { git } from '@/utils/git'
import { log } from '@/utils/logger'

type Options = {
  skipGit?: boolean
  planFile?: string
  editFile?: string
}

// performs autonomous draftpilot from command like
export default async function autopilot(branch: string, request: string, options: Options) {
  // create a new branch
  if (!options.skipGit) git(['checkout', '-b', branch])

  await indexer.loadFilesIntoVectors()

  const autopilot = new AutoPilot()
  await autopilot.run(request, options)

  // add all files
  if (!options.skipGit) git(['add', '.'])

  // commit
  if (!options.skipGit) git(['commit', '-m', 'autopilot'])

  // push
  if (!options.skipGit) git(['push', 'origin', branch])
}
