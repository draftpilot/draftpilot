import { spawnSync } from 'child_process'

import { verboseLog } from '@/utils/logger'
import fs from 'fs'
import path from 'path'

export function git(args: string[], cwd?: string) {
  verboseLog('git', ...args)
  const result = spawnSync(`git`, args, {
    cwd,
    encoding: 'utf-8',
  })

  if (result.error) throw result.error
  return result.stdout.trim()
}

// walk up the tree until we find the .git folder
export function findGitRoot(cwd?: string) {
  let dir = cwd || process.cwd()
  while (dir !== '/') {
    if (fs.existsSync(path.join(dir, '.git'))) return dir
    dir = path.dirname(dir)
  }
  throw new Error('Could not find git root')
}

export function updateGitIgnores(files: string[]) {
  const gitRoot = findGitRoot()
  if (!gitRoot) return

  const gitIgnore = path.join(gitRoot, '.gitignore')
  const existing = fs.existsSync(gitIgnore)
  const contents = existing ? fs.readFileSync(gitIgnore, 'utf-8') : ''

  const lines = contents.split('\n')
  const linesToAdd = new Set<string>(files)
  lines.forEach((line) => {
    if (linesToAdd.has(line)) linesToAdd.delete(line)
  })

  if (linesToAdd.size === 0) return
  Array.from(linesToAdd).forEach((line) => lines.push(line))

  fs.writeFileSync(gitIgnore, lines.join('\n'), 'utf-8')
}
