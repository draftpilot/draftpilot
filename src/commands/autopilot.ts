import fs from 'fs'

import { indexer } from '@/db/indexer'
import { AutoPilot } from '@/directors/autoPilot'
import { git, updateGitIgnores } from '@/utils/git'
import { log } from '@/utils/logger'

// performs autonomous draftpilot from command like
export default async function autopilot(request: string, options: any) {
  try {
    await indexer.loadFilesIntoVectors()

    const autopilot = new AutoPilot()
    await autopilot.run(request, options)

    if (updateGitIgnores()) {
      git(['add', '.gitignore'])
      git(['commit', '-m', 'draftpilot metadata'])
    }
  } catch (e: any) {
    log('error', e)
    fs.writeFileSync('.draftpilot/error.txt', e.toString())
  }
}
