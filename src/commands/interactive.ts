import { executePlan } from '@/commands/executor'
import { doInitialize } from '@/commands/init'
import { doPlan } from '@/commands/planner'
import { getManifestName } from '@/context/manifest'
import { cache } from '@/db/cache'
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
  const manifestFile = root ? getManifestName(root) : null

  const needsInit = !manifestFile || !fs.existsSync(manifestFile)
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

  cache.close()
}
