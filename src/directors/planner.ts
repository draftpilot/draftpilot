import { Plan } from '@/types'
import { log } from '@/utils/logger'
import { fuzzyParseJSON } from '@/utils/utils'
import chalk from 'chalk'

export interface AbstractPlanner {
  doPlan(query: string, glob?: string): Promise<Plan>
}

const PLAN_FORMAT: Partial<Plan> = {
  shellCommands: ["sed -i 's/old/new/g' *"],
  reference: ['up to three files given to AI as reference'],
  change: {
    'path/file': 'detailed explanation of change with all the context that an AI needs',
  },
  clone: {
    'from/file': { dest: 'to/file', edits: 'any edits to make to the dest file' },
  },
  create: {
    'path/file': 'detailed explanation of new file contents',
  },
  rename: { 'from/file': 'to/file' },
  delete: [],
}
export const PLAN_FORMAT_STR = JSON.stringify(PLAN_FORMAT)

export const parsePlan = (request: string, plan: string): Plan | null => {
  const parsedPlan: Plan = fuzzyParseJSON(plan)
  if (!parsedPlan) {
    log(chalk.yellow('Warning:'), 'Got non-JSON response for plan')
    return null
  }

  // sometimes files are in change & also in create
  Object.keys(parsedPlan.create || {}).forEach((file) => {
    delete parsedPlan.change?.[file]
  })
  Object.keys(parsedPlan.clone || {}).forEach((file) => {
    const cloneData = parsedPlan.clone?.[file]
    if (cloneData) {
      delete parsedPlan.change?.[cloneData.dest]
      delete parsedPlan.create?.[cloneData.dest]
    }
  })
  if (parsedPlan.reference) {
    if (parsedPlan.reference.length === 0) delete parsedPlan.reference
    else if (parsedPlan.reference.length > 3)
      parsedPlan.reference = parsedPlan.reference.slice(0, 3)
  }
  if (parsedPlan.change && Object.keys(parsedPlan.change).length === 0) {
    delete parsedPlan.change
  }
  if (parsedPlan.clone && Object.keys(parsedPlan.clone).length === 0) {
    delete parsedPlan.clone
  }
  if (parsedPlan.create && Object.keys(parsedPlan.create).length === 0) {
    delete parsedPlan.create
  }
  if (parsedPlan.delete && parsedPlan.delete.length === 0) {
    delete parsedPlan.delete
  }
  if (parsedPlan.rename && Object.keys(parsedPlan.rename).length === 0) {
    delete parsedPlan.rename
  }
  if (parsedPlan.shellCommands?.[0]?.includes('No shell commands')) delete parsedPlan.shellCommands
  if (parsedPlan.shellCommands && parsedPlan.shellCommands.length === 0) {
    delete parsedPlan.shellCommands
  }

  return { ...parsedPlan, request }
}
