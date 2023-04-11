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
  console.log(status)

  let untracked = status
    .split('\n')
    .filter((s) => s.startsWith('??') || s.startsWith(' '))
    .map((s) => {
      const [_, file] = s.trim().split(' ', 2)
      return file
    })

  while (untracked.length > 0) {
    const response = await inquirer.prompt([
      {
        type: 'list',
        name: 'add',
        message: 'You have untracked changes. Add?',
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

  let diff = git(['diff', '--cached', '-U1'])
    .split('\n')
    .filter((s) => s.trim().length)

  if (diff.length == 0) {
    log(chalk.yellow('Nothing to commit.'))
    return
  }

  if (diff.length > 200) {
    log(chalk.yellow('Warning:'), `${diff.length} line diff, truncating to 200 lines.`)
    diff = diff.slice(0, 100)
  }

  // tried to add previous commits, but the model would just follow this even if it was unrelated

  // const previousCommits = git(['log', '--pretty=%B', '-n', '10'])
  //   .split('\n')
  //   .filter((s) => s.trim().length)
  //   .join('\n')

  const prompt = `Diff:
${diff.join('\n')}

Based the diff above, generate a git commit messages for the following changes.`

  verboseLog(prompt)

  const promise = chatCompletion(
    prompt,
    '3.5',
    "Be concise and don't make anything up. If you don't know, just write 'Updates to <filename>'."
  )

  const result = await oraPromise(promise, { text: 'Generating a commit message...' })

  log(chalk.green('Here you go:'), result)

  log('Press enter to commit, type a new message to use that instead, ctrl-c to quit')

  const response = await inquirer.prompt([
    {
      type: 'input',
      name: 'message',
      message: '>',
    },
  ])

  const message = response.message || result
  log(git(['commit', '-m', message]))
}
