import { executePlan } from '@/commands/executor'
import { doInitialize } from '@/commands/init'
import { doPlan } from '@/commands/planner'
import { getInfoFileName } from '@/context/filetree'
import { Indexer } from '@/db/indexer'
import { Plan } from '@/types'
import { findRoot } from '@/utils'
import fs from 'fs'
import inquirer from 'inquirer'

type Options = {
  glob?: string
}

// use the cli in an interactive mode
export default async function (options: Options) {
  // init if necessary
  const root = findRoot()
  const infoFile = root ? getInfoFileName(root) : null

  const needsInit = !infoFile || !fs.existsSync(infoFile)
  const indexer = new Indexer()
  if (needsInit) {
    await doInitialize(indexer, options)
  } else {
    await indexer.loadFilesIntoVectors(options.glob)
  }

  // plan
  const planInput = await inquirer.prompt([
    {
      type: 'input',
      name: 'plan',
      message: 'What do you want to do?',
    },
  ])
  const plan = await doPlan(indexer, planInput.plan, options)

  // execute
  const planJSON: Plan = JSON.parse(plan)
  await executePlan(planJSON, indexer)
}
