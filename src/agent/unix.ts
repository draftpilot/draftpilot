import child_process from 'child_process'
import FastGlob from 'fast-glob'

import { confirmPrompt, Tool } from '@/agent/tool'
import { readConfig } from '@/context/projectConfig'
import { findRelevantDocs } from '@/context/relevantFiles'
import { log, verboseLog } from '@/utils/logger'

const grepTool: Tool = {
  name: 'findInsideFiles',
  description:
    'Search inside files print the matching lines. e.g. { name: findAcrossFiles, input: hello }',

  run: async (input: string | string[]) => {
    const args = stringToArgs(input)

    // grep defaults:
    // -r for recursive
    // -i for case insensitive
    // -I for ignore binary files
    // -F for fixed strings (not regex)

    if (!args.includes('-r')) args.push('-r')
    if (!args.includes('-i')) args.push('-i')
    if (!args.includes('-I')) args.push('-I')
    if (!args.includes('-F')) args.push('-F')

    const dir = args[args.length - 1]
    if (dir == '.' || dir.startsWith('/')) args.pop()
    if (!dir.includes('*') && !dir.includes('/')) args.push('*')

    args.push(
      '--exclude-dir=node_modules',
      '--exclude-dir=.*',
      '--exclude-dir=dist',
      '--exclude-dir=out',
      '--exclude-dir=build',
      '--exclude-dir=venv'
    )
    const config = readConfig()
    if (config && config.excludeDirs) {
      config.excludeDirs.split(',').forEach((dir) => args.push(`--exclude-dir=${dir}`))
    }

    try {
      return await spawnPromise('grep', args)
    } catch (e: any) {
      return 'Error invoking grep: ' + e.message
    }
  },
}

const findTool: Tool = {
  name: 'findFileNames',
  description:
    'Find file names matching a name or pattern. e.g. { name: "findFileNames", input: "*.foo.js" }',

  run: async (input: string | string[]) => {
    if (typeof input == 'string') input = input.split(',')

    const results = await Promise.all(input.map((pattern) => FastGlob('**/' + pattern + '*')))
    return results.flat().join('\n')
  },
}

const lsTool: Tool = {
  name: 'listFiles',
  description: 'List files in a folder. e.g. { name: "listFiles", input: "folder1 folder2" }',
  run: (input: string | string[]) => {
    const args = stringToArgs(input)
    return spawnPromise('ls', args)
  },
}

const rmTool: Tool = {
  name: 'rm',
  description: 'Removes file. e.g. rm file1 file2',
  run: async (input: string | string[]) => {
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
  description: 'Copies files and folders. e.g. cp: -r src/folder dest/folder',
  run: async (input: string | string[]) => {
    const args = stringToArgs(input)

    return spawnPromise('cp', args)
  },
}

const mvTool: Tool = {
  name: 'mv',
  description: 'Moves files and folders. e.g. mv: src/file dest/file',
  run: async (input: string | string[]) => {
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
  description: 'In-place stream editor. e.g. sed: s/foo/bar/ **/*.js',
  run: async (input: string | string[]) => {
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

// the agent is bad at using these tools

// const gitHistory: Tool = {
//   name: 'gitHistory',
//   description: 'Show git history for a given file. e.g. gitHistory: file',
//   run: (input: string) => {
//     const args = ['log', '--pretty=format:"%h %s"', input]
//     return spawnPromise('git', args)
//   },
// }

// const gitDiffTool: Tool = {
//   name: 'gitDiff',
//   description: 'Prints git diff of changes to file. e.g. gitDiff: file',

//   run: async (input: string, overallGoal?: string) => {
//     const args = ['diff', '--pretty=format:%H', input]
//     return spawnPromise('git', args)
//   },
// }

export const stringToArgs = (input: string | string[]) => {
  if (!input) return []
  if (Array.isArray(input)) return input

  const args = []
  let currentArg = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escapeNextChar = false

  for (const char of input) {
    if (escapeNextChar) {
      currentArg += char
      escapeNextChar = false
    } else if (char === '\\') {
      escapeNextChar = true
    } else if (char === "'" && !inDoubleQuote) {
      if (inSingleQuote) {
        args.push(currentArg)
        currentArg = ''
      }
      inSingleQuote = !inSingleQuote
    } else if (char === '"' && !inSingleQuote) {
      if (inDoubleQuote) {
        args.push(currentArg)
        currentArg = ''
      }
      inDoubleQuote = !inDoubleQuote
    } else if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (currentArg) {
        args.push(currentArg)
        currentArg = ''
      }
    } else {
      currentArg += char
    }
  }
  if (currentArg) {
    args.push(currentArg)
  }

  return args
}

export const spawnPromise = (command: string, args: string[], cwd?: string) => {
  verboseLog(`Running ${command} ${args.join(' ')}`)
  const result = child_process.spawn(command, args, { cwd, shell: true })
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    const errorChunks: Buffer[] = []
    result.stdout.on('data', (chunk) => chunks.push(chunk))
    result.stderr.on('data', (chunk) => errorChunks.push(chunk))

    result.on('error', (err) => {
      reject(err)
    })

    result.on('close', (code) => {
      const output = Buffer.concat(chunks).toString()
      const error = Buffer.concat(errorChunks).toString()

      if (output && error) {
        resolve(`${output}\n${error}`)
      } else if (output) {
        resolve(output)
      } else if (error) {
        reject(error)
      } else {
        resolve('')
      }
    })
  })
}

export const unixTools = [grepTool, findTool, lsTool, cpTool, mvTool, rmTool, sedTool]

export const unixReadOnlyTools = [grepTool, findTool, lsTool]

export const unixSimpleTools = [findTool, lsTool]
