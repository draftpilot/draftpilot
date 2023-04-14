import { doInitialize } from '@/commands/init'
import { PLAN_FILE } from '@/commands/plan'
import { getManifestName } from '@/context/manifest'
import { cache } from '@/db/cache'
import { indexer } from '@/db/indexer'
import { AgentPlanner } from '@/directors/agentPlanner'
import { Executor } from '@/directors/executor'
import { OneShotPlanner } from '@/directors/oneShotPlanner'
import { getUnstagedFiles } from '@/utils/git'
import { log } from '@/utils/logger'
import { findRoot } from '@/utils/utils'
import chalk from 'chalk'
import fs from 'fs'
import inquirer from 'inquirer'

type Options = {
  glob?: string
  oneShot?: boolean
  waitEachStep?: boolean
}

// use the cli in an interactive mode
export default async function (options: Options) {
  const unstaged = getUnstagedFiles()
  if (unstaged.length) {
    log(
      chalk.yellow('Warning:'),
      'Unstaged files in your git repo. We recommend you quit & commit those first in case you need to roll back.'
    )
  }

  // init if necessary
  const root = findRoot()
  const manifestFile = root ? getManifestName(root) : null

  const needsInit = !manifestFile || !fs.existsSync(manifestFile)
  if (needsInit) {
    await doInitialize(indexer, options)
  } else {
    await indexer.loadFilesIntoVectors(options.glob)
  }

  // plan
  log('What can I do for you?')
  const planInput = await inquirer.prompt([
    {
      type: 'input',
      name: 'plan',
      message: '>',
    },
  ])

  const planner = options.oneShot ? new OneShotPlanner() : new AgentPlanner(options.waitEachStep)

  log('Using', options.oneShot ? 'one-shot' : 'agent', 'planner')
  const plan = await planner.doPlan(planInput.plan, options.glob)

  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan))
  log(`Wrote plan to ${PLAN_FILE}`)

  // execute
  const executor = new Executor()
  const success = await executor.executePlan(plan)

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
