import { Indexer } from '@/db/indexer'
import { cache } from '@/db/cache'
import { Planner } from '@/tools/planner'
import inquirer from 'inquirer'

type Options = {
  glob?: string
}

export const PLAN_FILE = 'plan.json'

// agent version of the planner
export default async function (query: string, options: Options) {
  const indexer = new Indexer()

  const planner = new Planner()

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

  await planner.doPlan(indexer, query, options?.glob)

  cache.close()
}
