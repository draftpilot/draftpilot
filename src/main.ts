import { program } from 'commander'

import init from '@/commands/init'
import config, { overrideServer } from '@/config'
import { log, setVerbose } from '@/logger'
import { fatal } from '@/utils'

import packageJson from '../package.json'
import chat from '@/commands/chat'
import indexer from '@/commands/indexer'
import search from '@/commands/search'
import codegen from '@/commands/codegen'

export default function () {
  program
    .name('drafty')
    .description('AI-assisted coding')
    .option('-v, --verbose', 'verbose logging', () => setVerbose(1))
    .option('--server <server>', 'specify a custom server', overrideServer)
    .option('--version', 'print version', () => {
      log(packageJson.version)
      process.exit(0)
    })

  program.command('init').description('Initialize drafty').action(actionWrapper(init))

  program.command('index').description('Index your project').action(actionWrapper(indexer))

  program
    .command('search')
    .description('Perform code search')
    .action(actionWrapper(search))
    .argument('<query>', 'The query to search for.')
    .option('--count <count>', 'The number of results to return (default 3).')
    .option('--reindex', 'Re-index the project before searching.')

  program
    .command('codegen')
    .description('Generate project-related code from a query')
    .action(actionWrapper(codegen))
    .argument('<request>', 'The request to make.')
    .option('--reindex', 'Re-index the project before codegen.')

  program.command('chat').description('Test direct GPT-4 completion').action(actionWrapper(chat))

  const options = program.parse()
  config.options = options
}

function actionWrapper(fn: (...args: any[]) => Promise<any>) {
  return (...args: any[]) => fn(...args).catch(fatal)
}
