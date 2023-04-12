import { log } from '@/utils/logger'
import chalk from 'chalk'
import fs from 'fs'
import * as Diff from 'diff'
import { splitOnce } from '@/utils/utils'

type Options = {}

// executes a plan
export default async function (file: string, options: Options) {
  const patch = fs.readFileSync(file, 'utf8')

  if (!patch.startsWith('changing ')) {
    throw new Error('Invalid patch file. Expected to start with "changing "')
  }

  const lines = patch.split('\n')

  const fileToEdit = splitOnce(lines[0], ' ')[1]
  const patchContents = lines.slice(2).join('\n')

  log('loading file', fileToEdit)
  const fileContents = fs.readFileSync(fileToEdit, 'utf8')

  const output = Diff.applyPatch(fileContents, patchContents, { fuzzFactor: 5 })

  log('got output', typeof output)
  fs.writeFileSync(fileToEdit, output)

  log(chalk.green(`Successfully applied patch to ${file}`))
}
