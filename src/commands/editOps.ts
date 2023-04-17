import { log } from '@/utils/logger'
import chalk from 'chalk'
import fs from 'fs'
import * as Diff from 'diff'
import { splitOnce } from '@/utils/utils'
import child_process from 'child_process'
import { CodebaseEditor } from '@/directors/codebaseEditor'

type Options = {}

// apply edit operations
export default async function (file: string, ops: string, options: Options) {
  log('loading file', file)
  const fileContents = fs.readFileSync(file, 'utf8')

  ops = ops.replace(/\\n/g, '')
  const opsJson = JSON.parse(ops)

  const editor = new CodebaseEditor()

  const output = editor.applyOps(file, opsJson)

  fs.writeFileSync(file, output)

  log(chalk.green(`Successfully applied patch to ${file}`))
}
