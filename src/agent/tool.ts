import inquirer from 'inquirer'

export interface Tool {
  name: string
  description: string

  run: (input: string, overallGoal?: string) => Promise<string>
}

export const confirmPrompt = async (prompt: string, defaultVal?: boolean): Promise<boolean> => {
  const response = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: prompt,
      default: defaultVal,
    },
  ])
  return response.confirm
}
