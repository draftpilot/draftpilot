import { cache } from '@/db/cache'
import { indexer } from '@/db/indexer'
import fs from 'fs'
import { PLAN_FILE } from '@/commands/plan'
import { Plan } from '@/types'
import { Executor } from '@/tools/executor'

type Options = {
  glob?: string
}

// executes a plan
export default async function (file: string | undefined, options: Options) {
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
