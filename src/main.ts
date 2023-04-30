import { program } from 'commander'
import open from 'open'

import { setFakeMode } from '@/ai/api'
import index from '@/commands'
import autopilot from '@/commands/autopilot'
import chat from '@/commands/chat'
import codegen from '@/commands/codegen'
import commit from '@/commands/commit'
import editOps from '@/commands/editOps'
import init from '@/commands/init'
import patch from '@/commands/patch'
import search from '@/commands/search'
import tool from '@/commands/tool'
import config, { overrideGPT4 } from '@/config'
import { cache } from '@/db/cache'
import serve from '@/server/server'
import { updateGitIgnores } from '@/utils/git'
import { log, setVerbose } from '@/utils/logger'
import { tracker } from '@/utils/tracker'
import { fatal } from '@/utils/utils'

import packageJson from '../package.json'

export default function () {
  if (!process.env.OPENAI_API_KEY) return fatal('env variable OPENAI_API_KEY is not set')
  program
    .name('draftpilot')
    .description('AI-assisted coding')
    .option('-v, --verbose', 'verbose logging', () => setVerbose(1))
    .option('--skip-cache', 'skip cache for all requests', cache.skipCache)
    .option('--fake', 'use fake api requests', () => setFakeMode())
    .option('--gpt4 <policy>', 'usage of gpt-4 (always, code-only, never)', overrideGPT4)
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
    .command('autopilot')
    .description('Run autonomously from command line')
    .argument('<branch>')
    .argument('<request>')
    .option('--skip-git', 'skip git operations')
    .option('--plan-file <file>', 'use the plan file output')
    .option('--edit-file <file>', 'use the edit file output')
    .option('--validation-file <file>', 'use the validation file output')
    .action(actionWrapper(autopilot))

  program
    .command('server', { isDefault: true })
    .description('Server mode (runs when no command is specified))')
    .action(
      actionWrapper(async (opts) => {
        updateGitIgnores()
        const url = await serve(
          opts.port ? parseInt(opts.port) : undefined,
          opts.devServer ? 'development' : 'production'
        )
        if (!opts.skipOpen) open(url)
      })
    )
    .option('--skip-open', 'Skip opening the browser')
    .option('--port <port>', 'Listen on specific port')
    .option('--dev-server', 'Use dev server (for development)')

  const options = program.parse()
  config.options = options

  tracker.launch(process.argv[2])
}

function actionWrapper(fn: (...args: any[]) => Promise<any>) {
  return (...args: any[]) => fn(...args).catch(fatal)
}
