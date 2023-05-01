import chalk from 'chalk'
import child_process from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

import config from '@/config'
import { verboseLog } from '@/utils/logger'

// walk up the tree until we find the .draftpilot folder
let root: string | null = null
export function findRoot(cwd?: string) {
  if (root) return root
  let dir = cwd || process.cwd()
  while (dir !== '/') {
    if (fs.existsSync(path.join(dir, config.configFolder))) {
      root = dir
      return dir
    }
    dir = path.dirname(dir)
  }
  root = cwd || process.cwd()
  return root
}

// generate secret key
export function generateSecretKey() {
  return crypto
    .randomBytes(48)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export function error(...args: any[]) {
  console.error(chalk.red('Error:'), ...args)
}

export function fatal(...args: any[]) {
  console.error(chalk.red('Fatal:'), ...args)
  process.exit(1)
}

// simple string hashing. https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
export const cyrb53 = (str: string, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)

  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export const pluralize = (count: number, noun: string) => {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export const fuzzyMatchingFile = (file: string, files: string[]) => {
  if (fs.existsSync(file)) return file

  const fileBasename = path.basename(file)
  const similar = files.find((f) => f.endsWith(fileBasename))
  if (similar) return similar

  return null
}

export function splitOnce(s: string, on: string) {
  const index = s.indexOf(on)
  if (index == -1) return [s]
  return [s.slice(0, index), s.slice(index + 1)]
}

export function fuzzyParseJSON(input: string) {
  if (!input) return null
  const firstBracket = input.indexOf('[')
  const firstBrace = input.indexOf('{')

  if (firstBracket == -1 && firstBrace == -1) return null
  const isArray = firstBracket > -1 && firstBracket < firstBrace

  const jsonStart = input.indexOf(isArray ? '[' : '{')
  const jsonEnd = input.lastIndexOf(isArray ? ']' : '}')

  if (jsonStart == -1 || jsonEnd == -1) return null

  const json = input.substring(jsonStart, jsonEnd + 1)
  try {
    return JSON.parse(json)
  } catch (e) {
    // sometimes trailing commas are generated. sometimes no commas are generated,
    const fixedJsonString = json.replace(/"\n"/g, '",').replace(/,\s*([\]}])/g, '$1')
    try {
      return JSON.parse(fixedJsonString)
    } catch (e) {
      return null
    }
  }
}

export function generateUUID() {
  if (global.window && window.isSecureContext && window.crypto.randomUUID) {
    return window.crypto.randomUUID()
  } else if (!global.window && crypto) {
    return crypto.randomUUID()
  } else {
    let d = new Date().getTime()
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      d += performance.now() //use high-precision timer if available
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (d + Math.random() * 16) % 16 | 0
      d = Math.floor(d / 16)
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
  }
}

export function smartTruncate(input: string, truncationPoint: number) {
  const previousWordIndex = input.lastIndexOf(' ', truncationPoint)
  const truncatedString = input.slice(0, previousWordIndex).trim()

  const withoutPrepositions = truncatedString.replace(/\b(with|on|in|at|to|for|of)$/gi, '').trim()

  const filesShortened = withoutPrepositions.split(' ').map((word) => {
    if (word.includes('/')) return word.substring(word.lastIndexOf('/') + 1)
    else return word
  })

  return filesShortened.join(' ')
}

export function spawn(proc: string, args: string[], cwd?: string) {
  verboseLog('spawn', proc, ...args)
  const result = child_process.spawnSync(proc, args, {
    cwd,
    encoding: 'utf-8',
  })

  if (result.error) throw result.error
  return result.stdout
}
