import { program } from 'commander'

import init from '@/commands/init'
import config, { overrideGPT4, overrideServer } from '@/config'
import { log, setVerbose } from '@/logger'
import { fatal } from '@/utils'

import packageJson from '../package.json'
import chat from '@/commands/chat'
import indexer from '@/commands/indexer'
import search from '@/commands/search'
import codegen from '@/commands/codegen'
import filetree from '@/commands/filetree'
import planner from '@/commands/planner'
import { cache } from '@/db/cache'
import executor from '@/commands/executor'

export default function () {
  program
    .name('drafty')
    .description('AI-assisted coding')
    .option('-v, --verbose', 'verbose logging', () => setVerbose(1))
    .option('--server <server>', 'specify a custom server', overrideServer)
    .option('--skip-cache', 'skip cache for all requests', cache.skipCache)
    .option('--gpt4 <policy>', 'gpt-4 policy (always, code-only, never)', overrideGPT4)
    .option('--version', 'print version', () => {
      log(packageJson.version)
      process.exit(0)
    })

  program.command('init').description('Initialize drafty').action(actionWrapper(init))

  program
    .command('index')
    .description("Index your project's code")
    .action(actionWrapper(indexer))
    .option('--reindex', 'Re-index from scratch.')

  program
    .command('search')
    .description('Perform code search')
    .action(actionWrapper(search))
    .argument('<query>', 'The query to search for.')
    .option('--k <k>', 'The k means to cluster (and results to return).')
    .option('--reindex', 'Re-index the project before searching.')

  program
    .command('codegen')
    .description('Generate code from a query (without editing any files)')
    .action(actionWrapper(codegen))
    .argument('<request>', 'The request to make.')
    .option('--k <k>', '# of relevant functions to include (default 4)')
    .option('--reindex', 'Re-index the project before codegen.')

  program
    .command('filetree')
    .description('Create a filetree manifest for your project')
    .action(actionWrapper(filetree))
    .option('--glob <glob>', 'The glob to use for finding files.')

  program
    .command('plan')
    .description('Create an execution plan for the request')
    .action(actionWrapper(planner))
    .argument('<request>', 'The request to make.')

  program
    .command('execute [file]')
    .description('Execute a plan file (defaults to plan.txt)')
    .action(executor)

  program.command('chat').description('Talk directly to chatGPT').action(actionWrapper(chat))

  const options = program.parse()
  config.options = options
}

function actionWrapper(fn: (...args: any[]) => Promise<any>) {
  return (...args: any[]) => fn(...args).catch(fatal)
}
