import { program } from 'commander'

import init from '@/commands/init'
import config, { overrideServer } from '@/config'
import { log, setVerbose } from '@/logger'
import { fatal } from '@/utils'

import packageJson from '../package.json'
import play from '@/commands/play'

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

  program
    .command('init')
    .description('Initialize in a git repo')
    .argument('<user>', 'Your user id.')
    .option('--force', 'Force re-registration of the repo')
    .action(actionWrapper(init))

  program.command('play').description('Play').action(actionWrapper(play))

  const options = program.parse()
  config.options = options
}

function actionWrapper(fn: (...args: any[]) => Promise<any>) {
  return (...args: any[]) => fn(...args).catch(fatal)
}
