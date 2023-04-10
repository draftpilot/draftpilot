import { executePlan } from '@/commands/executor'
import { doInitialize } from '@/commands/init'
import { doPlan, PLAN_FILE } from '@/commands/planner'
import { getManifestName } from '@/context/manifest'
import { cache } from '@/db/cache'
import { Indexer } from '@/db/indexer'
import { log } from '@/utils/logger'
import { findRoot } from '@/utils/utils'
import chalk from 'chalk'
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

  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan))
  log(`Wrote plan to ${PLAN_FILE}`)

  // execute
  const success = await executePlan(plan, indexer)

  if (!success) {
    log(chalk.yellow('Ok. You can check the plan file and run `execute` to try again.'))
    return
  }

  const doneResponse = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'done',
      message: 'Are you happy with your results? If so we will clean up intermediate files.',
    },
  ])

  if (doneResponse.done) {
    fs.rmSync(PLAN_FILE)
    log(chalk.green('Fantastic. Have a great day!'))
  } else {
    log(chalk.yellow('Ok. You can check the plan file and run `execute` to try again.'))
  }

  cache.close()
}
