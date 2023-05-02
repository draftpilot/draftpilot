import chalk from 'chalk'
import child_process from 'child_process'
import * as Diff from 'diff'
import fs from 'fs'

import { CodebaseEditor } from '@/directors/codebaseEditor'
import { applyOps } from '@/utils/editOps'
import { log } from '@/utils/logger'
import { splitOnce } from '@/utils/utils'

type Options = {}

// apply edit operations
export default async function (file: string, ops: string, options: Options) {
  log('loading file', file)
  const fileContents = fs.readFileSync(file, 'utf8')

  ops = ops.replace(/\\n/g, '')
  const opsJson = JSON.parse(ops)

  applyOps(fileContents, opsJson, file)

  log(chalk.green(`Successfully applied patch to ${file}`))
}
