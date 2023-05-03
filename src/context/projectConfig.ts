import fs from 'fs'
import path from 'path'

import config from '@/config'
import { ProjectConfig } from '@/types'
import { findRoot } from '@/utils/utils'

export function getConfigPath(root: string = findRoot()) {
  const folder = path.join(root, config.configFolder)
  const file = path.join(folder, 'config.json')
  return { folder, file }
}

let cached: ProjectConfig | null = null
export function readConfig(root: string = findRoot()): ProjectConfig | null {
  if (cached) return cached

  const { file: configPath } = getConfigPath(root)
  if (!fs.existsSync(configPath)) {
    return null
  }

  const data = fs.readFileSync(configPath, 'utf-8')
  cached = JSON.parse(data)
  return cached
}

export function writeConfig(config: ProjectConfig, root: string = findRoot()) {
  const configPath = getConfigPath(root)
  fs.writeFileSync(configPath.file, JSON.stringify(config, null, 2))
  cached = config
}
