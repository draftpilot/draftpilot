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
  return result.stdout
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
    const [status, file] = line.split(' ', 2)
    if (status === 'M') data.modified.push(file)
    else if (status === '??') data.untracked.push(file)
    else if (status === 'A') data.added.push(file)
    else if (status === 'D') data.deleted.push(file)
    else if (status === 'R') data.renamed.push(file)
    else if (status === 'C') data.copied.push(file)
  })
  return data
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
