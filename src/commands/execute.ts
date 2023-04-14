import { cache } from '@/db/cache'
import { indexer } from '@/db/indexer'
import fs from 'fs'
import { PLAN_FILE } from '@/commands/plan'
import { Plan } from '@/types/types'
import { Executor } from '@/tools/executor'
import { log } from '@/utils/logger'
import { getUnstagedFiles } from '@/utils/git'
import chalk from 'chalk'
import inquirer from 'inquirer'

type Options = {
  glob?: string
}

// executes a plan
export default async function (file: string | undefined, options: Options) {
  const unstaged = getUnstagedFiles()
  if (unstaged.length) {
    log(
      chalk.yellow(
        'Warning: ',
        'You have unstaged files in your git repo. We recommend you commit those first in case you need to roll-back.'
      )
    )
    const result = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: 'Continue?',
      },
    ])
    if (!result.continue) {
      return
    }
  }

  const files = await indexer.getFiles(options.glob)
  const { docs, updatedDocs, existing } = await indexer.load(files)
  if (!existing) await indexer.index(updatedDocs)
  await indexer.loadVectors(docs)

  const planText = fs.readFileSync(file || PLAN_FILE, 'utf8')
  try {
    const plan: Plan = JSON.parse(planText)

    const executor = new Executor()
    await executor.executePlan(plan)
  } catch (e: any) {
    throw new Error('Unable to parse plan file', e)
  }

  cache.close()
}
