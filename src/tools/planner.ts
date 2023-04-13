import { Plan } from '@/types'
import { log } from '@/utils/logger'
import chalk from 'chalk'

export interface AbstractPlanner {
  doPlan(query: string, glob?: string): Promise<Plan>
}

const PLAN_FORMAT: Partial<Plan> = {
  shellCommands: ["sed -i 's/old/new/g' *"],
  reference: ['up to three files given to AI as reference'],
  change: {
    'path/file3': 'detailed explanation of change with all the context that an AI needs',
  },
  clone: {
    'from/file': { dest: 'to/file', edits: 'any edits to make to the dest file' },
  },
  create: {
    'other/file4': 'detailed explanation of new file contents',
  },
  rename: { 'from/file': 'to/file' },
  delete: [],
}
export const PLAN_FORMAT_STR = JSON.stringify(PLAN_FORMAT)

export const parsePlan = (request: string, plan: string): Plan | null => {
  const jsonStart = plan.indexOf('{')
  const jsonEnd = plan.lastIndexOf('}')
  if (jsonStart > -1 && jsonEnd > -1) {
    plan = plan.substring(jsonStart, jsonEnd + 1)
    // sometimes trailing commas are generated. sometimes no commas are generated,
    const fixedJsonString = plan.replace(/"\n"/g, '",').replace(/,\s*([\]}])/g, '$1')

    // don't accept plans that are not JSON
    try {
      const parsedPlan: Plan = JSON.parse(fixedJsonString)

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
      if (parsedPlan.shellCommands && parsedPlan.shellCommands.length === 0) {
        delete parsedPlan.shellCommands
      }

      return { ...parsedPlan, request }
    } catch (e) {
      log(chalk.red('Error:'), 'Oops, that was invalid JSON')
    }
  } else {
    log(chalk.yellow('Warning:'), 'Plan was not updated, got non-JSON response')
  }
  return null
}
