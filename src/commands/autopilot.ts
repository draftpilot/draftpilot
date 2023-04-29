import fs from 'fs'

import { AutoPilot } from '@/directors/autopilot'
import { git } from '@/utils/git'

type Options = {
  skipGit: boolean
}

// performs autonomous draftpilot from command like
export default async function autopilot(branch: string, request: string, options: Options) {
  // create a new branch
  if (!options.skipGit) git(['checkout', '-b', branch])

  const autopilot = new AutoPilot()
  await autopilot.plan(request)

  // add all files
  if (!options.skipGit) git(['add', '.'])

  // commit
  if (!options.skipGit) git(['commit', '-m', 'autopilot'])

  // push
  if (!options.skipGit) git(['push', 'origin', branch])
}
