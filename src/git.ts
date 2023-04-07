import { spawnSync } from 'child_process'

import { verboseLog } from '@/logger'

export function git(args: string[], cwd?: string) {
  verboseLog('git', ...args)
  const result = spawnSync(`git`, args, {
    cwd,
    encoding: 'utf-8',
  })

  if (result.error) throw result.error
  return result.stdout.trim()
}

type FilesMap = { [file: string]: string }

export type GitShowData = {
  hash: string
  author: string
  email: string
  refs: string
  parents: string[]
  message: string
  files: FilesMap
}

function extractCommitAndFileMap(lines: string[]) {
  const separator = lines.lastIndexOf('')
  const message = lines.slice(0, separator).join('\n').trim()
  const fileStats = lines.slice(separator + 1).map((s) => s.trim())

  const files: FilesMap = {}
  fileStats.forEach((stat) => {
    const [file, data] = stat.split(' | ', 2).map((s) => s.trim())
    if (!data) return
    files[file] = data
  })
  return { message, files }
}

export function gitShow(cwd?: string): GitShowData {
  const format = [
    '%H', // commit hash
    '%an', // author name
    '%ae', // author email
    '%d', // ref names
    '%P', // parent hashes
    '%B', // commit message
  ].join('%n')
  const response = git(['show', '--stat', '--format=' + format], cwd)
  const lines = response.split('\n')

  const [hash, author, email, refs, parents, ...messageStats] = lines

  const { message, files } = extractCommitAndFileMap(messageStats)

  return {
    hash,
    author,
    email,
    refs,
    parents: parents.split(' '),
    message,
    files,
  }
}

export function gitBranch(cwd?: string): string {
  try {
    const response = git(['symbolic-ref', '--short', 'HEAD'], cwd)
    return response
  } catch (e) {
    // detached head
    return ''
  }
}

export type GitLogData = {
  hash: string
  date: string
  author: string
  email: string
  message: string
  files: FilesMap
}

const LOG_HEADER = '¤¤¤¤¤'

export function gitLog(cwd?: string, ...args: string[]): GitLogData[] {
  // commit hash, author email, author name, commit message, file stats
  const format = `${LOG_HEADER}%n%H|%aI|%ae|%an%n%B`
  const response = git(['log', '--stat', '--format=' + format, ...args], cwd)
  const lines = response.split('\n')

  const commits: GitLogData[] = []
  let commitLines: string[] = []

  const parseLogCommit = (lines: string[]) => {
    if (lines.length < 2) return
    const hashLine = lines.shift()!
    const [hash, date, email, author] = hashLine.split('|', 4)
    const { message, files } = extractCommitAndFileMap(lines)
    commits.push({
      hash,
      date,
      author,
      email,
      message,
      files,
    })
  }

  for (const line of lines) {
    if (line === LOG_HEADER) {
      parseLogCommit(commitLines)
      commitLines = []
    } else {
      commitLines.push(line)
    }
  }
  parseLogCommit(commitLines)

  return commits
}
