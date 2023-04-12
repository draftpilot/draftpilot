import { isAxiosError } from 'axios'
import chalk from 'chalk'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

import api from '@/api'
import config, { overrideServer } from '@/config'
import { ProjectConfig } from '@/types'

// walk up the tree until we find the .draftpilot folder
export function findRoot(cwd?: string) {
  let dir = cwd || process.cwd()
  while (dir !== '/') {
    if (fs.existsSync(path.join(dir, config.configFolder))) return dir
    dir = path.dirname(dir)
  }
  return cwd || process.cwd()
}

// generate secret key
export function generateSecretKey() {
  return crypto
    .randomBytes(48)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/\=/g, '')
}

export function getConfigPath(root: string = findRoot()) {
  const folder = path.join(root, config.configFolder)
  const file = path.join(folder, 'config.json')
  return { folder, file }
}

export function readConfig(root: string = findRoot()): ProjectConfig | null {
  const { file: configPath } = getConfigPath(root)
  if (!fs.existsSync(configPath)) {
    return null
  }

  const data = fs.readFileSync(configPath, 'utf-8')
  const config: ProjectConfig = JSON.parse(data)
  if (config.server) overrideServer(config.server)
  return config
}

export function unwrapError(e: any): string {
  if (isAxiosError(e)) {
    return api.unwrapError(e)
  } else if (e instanceof Error) {
    return e.message
  } else {
    return e.toString()
  }
}

export function logErrorMessage(e: any) {
  if (isAxiosError(e)) {
    error(api.unwrapError(e))
  } else {
    error(e)
  }
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
