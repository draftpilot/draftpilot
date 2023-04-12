import { indexer } from '@/db/indexer'
import { log } from '@/utils/logger'
import chalk from 'chalk'
import { cache } from '@/db/cache'
import fs from 'fs'
import { OneShotPlanner } from '@/tools/oneShotPlanner'
import { AgentPlanner } from '@/tools/agentPlanner'
import inquirer from 'inquirer'

type Options = {
  glob?: string
  oneShot?: boolean
  waitEachStep?: boolean
}

export const PLAN_FILE = 'plan.json'

// zero-shot planner for how to complete a code task
// running the command stand-alone writes the plan to a file
export default async function (query: string, options: Options) {
  if (!query) {
    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: 'What do you want to do?',
      },
    ])
    query = response.query
  }

  const planner = options.oneShot ? new OneShotPlanner() : new AgentPlanner(options.waitEachStep)

  const plan = await planner.doPlan(query, options.glob)

  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan))
  log(chalk.green(`Excellent! Wrote plan to ${PLAN_FILE}`))

  cache.close()
}
