import { chatCompletion } from '@/ai/chat'
import { Indexer } from '@/db/indexer'
import { git, gitStatus } from '@/utils/git'
import { log, verboseLog } from '@/utils/logger'
import { pluralize } from '@/utils/utils'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { oraPromise } from 'ora'

type Options = {
  k?: string
  reindex: boolean
}

const NONE = '- none -'

// infer a commit message and commit the changes
export default async function (options: Options) {
  const status = git(['status', '--porcelain'])

  let untracked = status
    .split('\n')
    .filter((s) => s.startsWith('??') || s.startsWith(' '))
    .map((s) => {
      const [_, file] = s.trim().split(' ', 2)
      return file
    })

  if (untracked.length > 0) {
    while (true) {
      const response = await inquirer.prompt([
        {
          type: 'list',
          name: 'add',
          message: 'You have untracked files. Would you like to add any?',
          choices: [NONE].concat(untracked),
        },
      ])
      const result = response.add
      if (result === NONE) {
        break
      }
      untracked = untracked.filter((x) => x !== result)
      git(['add', result])
    }
  }

  let diff = git(['diff', '--cached'])
    .split('\n')
    .filter((s) => s.trim().length)

  if (!diff) {
    log(chalk.yellow('Nothing to commit.'))
    return
  }

  if (diff.length > 200) {
    log(chalk.yellow('Warning:'), `${diff.length} line diff, truncating to 200 lines.`)
    diff = diff.slice(0, 100)
  }

  const previousCommits = git(['log', '--pretty=%B', '-n', '10'])
    .split('\n')
    .filter((s) => s.trim().length)
    .join('\n')

  const prompt = `Example commit messages:
${previousCommits}
  
Diff:
${diff.join('\n')}

Based on above, generate a git commit messages for the following changes. Don't make anything up.`

  verboseLog(prompt)

  const promise = chatCompletion(prompt, '3.5')

  const result = await oraPromise(promise, { text: 'Generating a commit message...' })

  log(chalk.green('Here you go:'))
  log('git commit -m', '"' + result.replace(/"/g, '\\"') + '"')
}
