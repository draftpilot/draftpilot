import { program } from 'commander'

import init from '@/commands/init'
import config, { overrideGPT4 } from '@/config'
import { log, setVerbose } from '@/utils/logger'
import { fatal } from '@/utils/utils'

import packageJson from '../package.json'
import chat from '@/commands/chat'
import index from '@/commands'
import search from '@/commands/search'
import codegen from '@/commands/codegen'
import plan from '@/commands/plan'
import { cache } from '@/db/cache'
import execute from '@/commands/execute'
import interactive from '@/commands/interactive'
import patch from '@/commands/patch'
import tool from '@/commands/tool'
import commit from '@/commands/commit'
import agent from '@/commands/agent'
import serve from '@/server/server'
import open from 'open'
import editOps from '@/commands/editOps'

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
    .action(actionWrapper(index))
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
    .action(actionWrapper(plan))
    .argument('[request]', 'The request to make.')
    .option('--glob <glob>', 'Custom glob to use for finding files')
    .option('--oneShot', 'Use the one-shot planner')
    .option('--waitEachStep', '(for agent planner) Wait for user input after each step')

  program
    .command('agent')
    .description('Use agent approach to fulfill the request (experimental)')
    .action(actionWrapper(agent))
    .argument('[request]', 'The request to make.')

  program
    .command('execute [file]')
    .description('Execute a plan file or a request and modifies code')
    .action(execute)
    .option('--glob <glob>', 'Custom glob to use for finding files')

  program.command('patch').argument('<file>').description('Applies a /tmp patch file').action(patch)

  program.command('chat').description('Talk directly to chatGPT').action(actionWrapper(chat))

  program
    .command('tool [command]')
    .description('Tester for agent tools')
    .action(actionWrapper(tool))

  program
    .command('commit')
    .description('Commit code with a magic commit message')
    .action(actionWrapper(commit))

  program
    .command('ops')
    .description('Apply array of ops to a file')
    .argument('<file>')
    .argument('<ops>')
    .action(actionWrapper(editOps))

  program
    .command('interactive')
    .description('Interactive mode')
    .action(actionWrapper(interactive))
    .option('--oneShot', 'Use the one-shot planner')

  program
    .command('server', { isDefault: true })
    .description('Server mode (runs when no command is specified))')
    .action(
      actionWrapper(async (workingDir: string, opts) => {
        if (workingDir) process.chdir(workingDir)
        const url = await serve(
          opts.port ? parseInt(opts.port) : undefined,
          opts.devServer ? 'development' : 'production'
        )
        if (!opts.skipOpen) open(url)
      })
    )
    .argument('[workingdir]', 'Working directory (defaults to current directory)')
    .option('--skip-open', 'Skip opening the browser')
    .option('--port <port>', 'Listen on specific port')
    .option('--dev-server', 'Use dev server (for development)')

  const options = program.parse()
  config.options = options
}

function actionWrapper(fn: (...args: any[]) => Promise<any>) {
  return (...args: any[]) => fn(...args).catch(fatal)
}
