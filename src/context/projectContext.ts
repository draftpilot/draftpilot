import config from '@/config'
import { findRoot } from '@/utils/utils'
import path from 'path'
import fs from 'fs'

const contextFilePath = () => path.join(findRoot(), config.configFolder, 'context.txt')

let contextFile: string | undefined
export const readProjectContext = () => {
  if (contextFile) return contextFile

  const file = contextFilePath()
  if (!fs.existsSync(file)) {
    return null
  }
  contextFile = fs.readFileSync(file, 'utf-8')
  return contextFile
}

export const writeProjectContext = (contents: string) => {
  const file = contextFilePath()
  contextFile = contents
  return fs.writeFileSync(file, contents, 'utf-8')
}
