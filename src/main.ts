import { program } from 'commander'
import open from 'open'

import openAIApi from '@/ai/api'
import index from '@/commands'
import learn from '@/commands/learn'
import autopilot from '@/commands/autopilotCommand'
import edit from '@/commands/editCommand'
import editOps from '@/commands/editOps'
import init from '@/commands/init'
import search from '@/commands/search'
import tool from '@/commands/tool'
import config, { overrideGPT4 } from '@/config'
import { cache } from '@/db/cache'
import { indexer } from '@/db/indexer'
import { log, setVerbose } from '@/utils/logger'
import { tracker } from '@/utils/tracker'
import { fatal } from '@/utils/utils'

import packageJson from '../package.json'
import chat from '@/commands/chat'
import interactive from '@/commands/interactive'

export default function () {
  if (!process.env.OPENAI_API_KEY) return fatal('env variable OPENAI_API_KEY is not set')
  program
    .name('draftpilot')
    .description('AI-assisted coding')
    .option('-v, --verbose', 'verbose logging', () => setVerbose(1))
    .option('--skip-index', 'skip indexing', () => indexer.skipIndexing())
    .option('--fake', 'use fake api requests', () => openAIApi.setFakeMode())
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
    .description('Initialize draftpilot and generate a config file.')
    .action(actionWrapper(init))
    .option('--batchSize <size>', '# of documents to send to openAI for embeddings at once')
    .option('--timeout <millis>', 'timeout for a single openAI embedding request')

  program
    .command('search')
    .description('Perform semantic code search')
    .action(actionWrapper(search))
    .argument('<query>', 'The query to search for')
    .option('--k <k>', '# of results to return')
    .option('--reindex', 'Re-index the project before searching')

  program
    .command('chat')
    .description('Chat about your codebase')
    .action(actionWrapper(chat))
    .argument('<query>', 'The query to provide')
    .option('--history <payload>', 'json payload with previous conversations')
    .option('--json <file>', 'output resultant messages to json file')

  program
    .command('autopilot')
    .description('Run autonomously from command line')
    .argument('<request>')
    .option('--skip-git', 'skip git operations')
    .option('--plan-file <file>', 'use the plan file output')
    .option('--edit-file <file>', 'use the edit file output')
    .option('--validation-file <file>', 'use the validation file output')
    .option('--validate <git branch or hash>', 'validate the code output against given branch')
    .option('--diff <git branch or hash>', 'in initial planning, use the diff as context')
    .action(actionWrapper(autopilot))

  program
    .command('interactive', { isDefault: true })
    .description('Prompt for request and execute')
    .argument('[request]', 'The request to execute')
    .option('--skip-git', 'skip git operations')
    .option('--skip-init', 'skip initialization')
    .action(actionWrapper(interactive))

  program
    .command('learn')
    .description('Teach the assistant a new lesson')
    .argument('[learning]', 'The lesson to learn. If omitted, will print all learnings')
    .option('--context', 'context for which this lesson applies')
    .action(actionWrapper(learn))

  // --- the following commands are for testing various parts of the system independently

  program
    .command('index', { hidden: true })
    .description('Manually run file indexing')
    .action(actionWrapper(index))
    .option('--reindex', 'Re-build index from scratch')
    .option('--batchSize <size>', '# of documents to send to openAI for embeddings at once')
    .option('--timeout <millis>', 'timeout for a single openAI embedding request')

  program
    .command('tool [command]', { hidden: true })
    .description('Tester for agent tools')
    .action(actionWrapper(tool))

  program
    .command('ops', { hidden: true })
    .description('Apply array of ops to a file')
    .argument('<file>')
    .argument('<ops>')
    .action(actionWrapper(editOps))

  program
    .command('edit', { hidden: true })
    .description('Perform autopilot editing')
    .argument('<planFile>')
    .action(actionWrapper(edit))
    .option('--edit-file <file>')
    .option('--validate <git branch or hash>', 'validate the code output against given branch')

  const options = program.parse()
  config.options = options

  tracker.launch(process.argv[2])
}

function actionWrapper(fn: (...args: any[]) => Promise<any>) {
  return (...args: any[]) => fn(...args).catch(fatal)
}
