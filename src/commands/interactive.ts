import autopilotCommand from '@/commands/autopilotCommand'
import inquirer from 'inquirer'

export default async function interactive(opts: any) {
  const result = await inquirer.prompt([
    {
      type: 'input',
      name: 'request',
      message: 'What would you like to do? Be as detailed as possible.',
    },
  ])

  await autopilotCommand(result.request, {})
}
