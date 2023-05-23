import autopilotCommand from '@/commands/autopilotCommand'
import inquirer from 'inquirer'
import { getConfigPath } from '@/context/projectConfig'
import fs from 'fs'
import init from '@/commands/init'

export default async function interactive(opts: any) {
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath.file) && !opts.skipInit) {
    console.log('No config file found. Running `init` first.')

    await init()
  }

  const result = await inquirer.prompt([
    {
      type: 'input',
      name: 'request',
      message: 'What would you like to do? Be as detailed as possible.',
    },
  ])

  await autopilotCommand(result.request, {})
}
