import { Tool, confirmPrompt } from '@/tools/tool'

import child_process from 'child_process'
import FastGlob from 'fast-glob'

const grepTool: Tool = {
  name: 'grep',
  description: 'Search for a pattern and print the matching lines. e.g. grep -r pattern .',

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
      '.draftpilot',
      '--exclude-dir',
      'dist',
      '--exclude-dir',
      'out'
    )
    return spawnPromise('grep', args)
  },
}

const findTool: Tool = {
  name: 'find',
  description: 'Tool to find files matching a shell pattern. e.g. find . -name "*.foo.js"',

  run: (input: string) => {
    const args = stringToArgs(input)
    if (!input.includes('-name')) args.unshift('.', '-name')
    return spawnPromise('find', args)
  },
}

const lsTool: Tool = {
  name: 'ls',
  description: 'List files in a folder. e.g. ls folder1 folder2',
  run: (input: string) => {
    const args = stringToArgs(input)
    return spawnPromise('ls', args)
  },
}

const rmTool: Tool = {
  name: 'rm',
  description: 'Removes file. e.g. rm file1 file2',
  run: async (input: string) => {
    const args = stringToArgs(input)
    args.unshift('-rf')

    if (await confirmPrompt(`Run rm ${args.join(' ')}?`)) {
      return spawnPromise('rm', args)
    } else {
      return 'Cancelled by user'
    }
  },
}

const cpTool: Tool = {
  name: 'cp',
  description: 'Copies files and folders. e.g. cp -r src/folder dest/folder',
  run: async (input: string) => {
    const args = stringToArgs(input)

    return spawnPromise('cp', args)
  },
}

const mvTool: Tool = {
  name: 'mv',
  description: 'Moves files and folders. e.g. mv src/file dest/file',
  run: async (input: string) => {
    const args = stringToArgs(input)

    if (await confirmPrompt(`Run mv ${args.join(' ')}?`)) {
      return spawnPromise('mv', args)
    } else {
      return 'Cancelled by user'
    }
  },
}

const sedTool: Tool = {
  name: 'sed',
  description: 'In-place stream editor. e.g. sed s/foo/bar/ **/*.js',
  run: async (input: string) => {
    const args = stringToArgs(input).filter((arg) => arg != '-i')

    // deal with darwin sed
    if (process.platform == 'darwin') args.unshift('-i', '')
    else args.unshift('-i')

    if (await confirmPrompt(`Run sed ${args.join(' ')}?`)) {
      // If the last argument is a glob, expand it and add the files to the args
      if (args[args.length - 1].startsWith('**')) {
        const glob = args.pop()
        const files = await FastGlob(glob!)
        args.push(...files)
      }

      return spawnPromise('sed', args)
    } else {
      return 'Cancelled by user'
    }
  },
}

const gitHistory: Tool = {
  name: 'gitHistory',
  description: 'Show git history for a given file. e.g. gitHistory file',
  run: (input: string) => {
    const args = ['log', '--pretty=format:%h %s', input]
    return spawnPromise('git', args)
  },
}

const gitDiffTool: Tool = {
  name: 'gitDiff',
  description: 'Prints git diff of changes to file. e.g. gitDiff file',

  run: async (input: string, overallGoal?: string) => {
    const args = ['diff', '--pretty=format:%H', input]
    return spawnPromise('git', args)
  },
}

export const stringToArgs = (input: string) => {
  const regex = /[^\s"']+|'([^']*)'|"([^"]*)"/gi
  const args = []

  let match
  do {
    match = regex.exec(input)
    if (match !== null) {
      args.push(match[1] ? match[1] : match[2] ? match[2] : match[0])
    }
  } while (match !== null)

  return args.map((arg) => {
    if (arg.startsWith('"') && arg.endsWith('"')) {
      return arg.slice(1, -1).replace(/\\"/g, '"')
    } else if (arg.startsWith("'") && arg.endsWith("'")) {
      return arg.slice(1, -1).replace(/\\'/g, "'")
    } else {
      return arg
    }
  })
}

export const spawnPromise = (command: string, args: string[], cwd?: string) => {
  const result = child_process.spawn(command, args, { cwd })
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    const errorChunks: Buffer[] = []
    result.stdout.on('data', (chunk) => chunks.push(chunk))
    result.stdout.on('end', () => {
      if (chunks.length == 0 && errorChunks.length) reject(Buffer.concat(errorChunks).toString())
      resolve(Buffer.concat(chunks).toString())
    })
    result.stderr.on('data', (chunk) => chunks.push(chunk))
  })
}

export const unixTools = [
  grepTool,
  findTool,
  lsTool,
  gitHistory,
  gitDiffTool,
  cpTool,
  mvTool,
  rmTool,
  sedTool,
]
