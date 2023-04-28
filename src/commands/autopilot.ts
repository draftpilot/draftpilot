import fs from 'fs'

import { git } from '@/utils/git'

// performs autonomous draftpilot from command like
export default async function autopilot(branch: string, request: string) {
  // create a new branch
  git(['checkout', '-b', branch])

  fs.writeFileSync('autopilot.txt', request)

  // add all files
  git(['add', '.'])

  // commit
  git(['commit', '-m', 'autopilot'])

  // push
  git(['push', 'origin', branch])
}
