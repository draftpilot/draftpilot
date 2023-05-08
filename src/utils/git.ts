import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

import { verboseLog } from '@/utils/logger'
import { spawn, splitOnce } from '@/utils/utils'

export function git(args: string[], cwd?: string) {
  return spawn('git', args, { cwd })
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

type GitStatusData = {
  modified: string[]
  added: string[]
  deleted: string[]
  renamed: string[]
  copied: string[]
  untracked: string[]
}

export function gitStatus(cwd?: string): GitStatusData {
  const response = git(['status', '--porcelain'], cwd)
  const lines = response.split('\n')
  const data: GitStatusData = {
    modified: [],
    untracked: [],
    added: [],
    deleted: [],
    renamed: [],
    copied: [],
  }
  lines.forEach((line) => {
    const [status, file] = splitOnce(line, ' ')
    if (status === 'M') data.modified.push(file)
    else if (status === '??') data.untracked.push(file)
    else if (status === 'A') data.added.push(file)
    else if (status === 'D') data.deleted.push(file)
    else if (status === 'R') data.renamed.push(file)
    else if (status === 'C') data.copied.push(file)
  })
  return data
}

const DEFAULT_GIT_IGNORES = ['.draftpilot']
export function updateGitIgnores(files: string[] = DEFAULT_GIT_IGNORES) {
  const gitRoot = findGitRoot()
  if (!gitRoot) return false

  const gitIgnore = path.join(gitRoot, '.gitignore')
  const existing = fs.existsSync(gitIgnore)
  const contents = existing ? fs.readFileSync(gitIgnore, 'utf-8') : ''

  const lines = contents.split('\n')
  const linesToAdd = new Set<string>(files)
  lines.forEach((line) => {
    if (linesToAdd.has(line)) linesToAdd.delete(line)
  })

  if (linesToAdd.size === 0) return false
  Array.from(linesToAdd).forEach((line) => lines.push(line))

  fs.writeFileSync(gitIgnore, lines.join('\n'), 'utf-8')
  return true
}

export function getUnstagedFiles() {
  const status = git(['status', '--porcelain'])

  return status
    .split('\n')
    .filter((s) => s.startsWith('??') || s.startsWith(' '))
    .map((s) => {
      const [_, file] = splitOnce(s.trim(), ' ')
      return file
    })
}
