import config, { overrideServer } from '@/config'
import { ProjectConfig } from '@/types'
import { findRoot } from '@/utils/utils'
import path from 'path'
import fs from 'fs'

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

export function writeConfig(config: ProjectConfig, root: string = findRoot()) {
  const configPath = getConfigPath(root)
  fs.writeFileSync(configPath.file, JSON.stringify(config, null, 2))
}
