import { program } from 'commander'

import init from '@/commands/init'
import config, { overrideGPT4 } from '@/config'
import { log, setVerbose } from '@/utils/logger'
import { fatal } from '@/utils/utils'

import packageJson from '../package.json'
import chat from '@/commands/chat'
import indexer from '@/commands/indexer'
import search from '@/commands/search'
import codegen from '@/commands/codegen'
import planner from '@/commands/planner'
import { cache } from '@/db/cache'
import executor from '@/commands/executor'
import interactive from '@/commands/interactive'
import patch from '@/commands/patch'
import scratchpad from '@/commands/scratchpad'
import commit from '@/commands/commit'
import agent from '@/commands/agent'

export default function () {
  program
    .name('draftpilot')
    .description('AI-assisted coding')
    .option('-v, --verbose', 'verbose logging', () => setVerbose(1))
    .option('--skip-cache', 'skip cache for all requests', cache.skipCache)
    .option(
      '--gpt4 <policy>',
      'usage of gpt-4 over gpt-3.5-turbo (always, code-only, never)',
      overrideGPT4
    )
    .option('--temperature <number>', 'temperature for AI generations', (temperature) => {
      config.temperature = parseFloat(temperature)
    })
    .option('--version', 'print version', () => {
      log(packageJson.version)
      process.exit(0)
    })

  program
    .command('init')
    .description('Initialize draftpilot. Can be called again later to update the manifest.')
    .action(actionWrapper(init))
    .option('--glob <glob>', 'Custom glob to use for finding files.')

  program
    .command('index')
    .description("Index your project's code")
    .action(actionWrapper(indexer))
    .option('--reindex', 'Re-build index from scratch')

  program
    .command('search')
    .description('Perform semantic code search')
    .action(actionWrapper(search))
    .argument('<query>', 'The query to search for')
    .option('--k <k>', '# of results to return')
    .option('--reindex', 'Re-index the project before searching')

  program
    .command('codegen')
    .description('Generate code from a request (without editing any files)')
    .action(actionWrapper(codegen))
    .argument('<request>', 'The request to make.')
    .option('--k <k>', '# of relevant functions to include in context (default 4)')
    .option('--reindex', 'Re-index the project before codegen')

  program
    .command('plan')
    .description('Create an execution plan for the request')
    .action(actionWrapper(planner))
    .argument('<request>', 'The request to make.')

  program
    .command('agent')
    .description('Use agent approach to fulfill the request (experimental)')
    .action(actionWrapper(agent))
    .argument('<request>', 'The request to make.')

  program
    .command('execute [file]')
    .description('Execute a plan file or a request and modifies code')
    .action(executor)
    .option('--glob <glob>', 'Custom glob to use for finding files')

  program.command('patch').argument('<file>').description('Applies a /tmp patch file').action(patch)

  program.command('chat').description('Talk directly to chatGPT').action(actionWrapper(chat))

  program
    .command('scratchpad')
    .description('File to run scratchpad code')
    .action(actionWrapper(scratchpad))

  program
    .command('commit')
    .description('Commit code with a magic commit message')
    .action(actionWrapper(commit))

  program
    .command('interactive', { isDefault: true })
    .description('Interactive mode')
    .action(actionWrapper(interactive))

  const options = program.parse()
  config.options = options
}

function actionWrapper(fn: (...args: any[]) => Promise<any>) {
  return (...args: any[]) => fn(...args).catch(fatal)
}
