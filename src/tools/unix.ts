import { Tool } from '@/tools/tool'

import child_process from 'child_process'

const grepTool: Tool = {
  name: 'grepFiles',
  description: 'Search for a pattern and print the matching lines. Input: pattern',

  run: (input: string) => {
    const args = stringToArgs(input)
    if (!args.includes('-r')) args.push('-r')
    const dir = args[args.length - 1]
    if (dir.startsWith('/')) args.pop()
    if (dir != '.' && dir != '*') args.push('.')

    args.push(
      '--exclude-dir',
      'node_modules',
      '--exclude-dir',
      '.git',
      '--exclude-dir',
      '.draftpilot'
    )
    return spawnPromise('grep', args)
  },
}

const findTool: Tool = {
  name: 'findFiles',
  description: 'Tool to find files matching a shell pattern. Input: glob pattern',

  run: (input: string) => {
    const args = stringToArgs(input)
    if (!input.includes('-name')) args.unshift('.', '-name')
    return spawnPromise('find', args)
  },
}

const lsTool: Tool = {
  name: 'lsFiles',
  description: 'List files in a folder. Input: folder1, folder2, ...',
  run: (input: string) => {
    const args = stringToArgs(input)
    return spawnPromise('ls', args)
  },
}

const gitHistory: Tool = {
  name: 'gitHistory',
  description: 'Show git history for a given file. Input: file',
  run: (input: string) => {
    const args = ['log', '--pretty=format:%h %s', input]
    return spawnPromise('git', args)
  },
}

const stringToArgs = (input: string) => {
  const regex = /[^\s"]+|"([^"]*)"/gi
  const args = []

  let match
  do {
    match = regex.exec(input)
    if (match !== null) {
      args.push(match[1] ? match[1] : match[0])
    }
  } while (match !== null)

  return args
}

const spawnPromise = (command: string, args: string[], cwd?: string) => {
  const result = child_process.spawn(command, args, { cwd })
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    const errorChunks: Buffer[] = []
    result.stdout!.on('data', (chunk) => chunks.push(chunk))
    result.stdout!.on('end', () => {
      if (chunks.length == 0 && errorChunks.length) reject(Buffer.concat(errorChunks).toString())
      resolve(Buffer.concat(chunks).toString())
    })
    result.stderr!.on('data', (chunk) => chunks.push(chunk))
  })
}

export const unixTools = [grepTool, findTool, lsTool, gitHistory]
