import { findRoot, getConfigPath, readConfig } from '@/utils'
import inquirer from 'inquirer'
import fs from 'fs'
import { log } from '@/logger'

type Options = {
  force?: boolean
}

export default async function (options: Options) {
  const root = findRoot()
  const existingConfig = readConfig(root)

  const hasTSConfig = fs.existsSync(root + '/tsconfig.json')

  const response = await inquirer.prompt([
    {
      type: 'input',
      name: 'purpose',
      message: 'Describe the purpose of this codebase (e.g. backend server for url shortener):',
    },
    {
      type: 'input',
      name: 'techstack',
      message: 'Describe the tech stack of this codebase (e.g. node.js, express, postgres):',
    },
  ])

  const config = existingConfig || {}
  config.language = hasTSConfig ? 'typescript' : 'javascript'
  config.purpose = response.purpose
  config.techstack = response.techstack

  const { folder, file } = getConfigPath(root)
  if (!fs.existsSync(folder)) fs.mkdirSync(folder)
  fs.writeFileSync(file, JSON.stringify(config))

  log('All set!')
}
