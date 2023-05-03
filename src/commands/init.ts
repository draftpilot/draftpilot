import { readConfig, writeConfig } from '@/context/projectConfig'
import { Indexer } from '@/db/indexer'
import { GenerateContext } from '@/directors/generateContext'
import { ProjectConfig } from '@/types'
import { log } from '@/utils/logger'

type Options = {}

export default async function (options?: Options) {
  // build initial index
  const indexer = new Indexer()
  await indexer.loadFilesIntoVectors()

  const config: ProjectConfig = readConfig() || {}

  config.files = indexer.files

  if (!config.description) {
    const contextGenerator = new GenerateContext(new Set())
    const result = await contextGenerator.generate((msg) => {
      process.stdout.write(typeof msg === 'string' ? msg : '\n')
    })
    config.description = result.content
  }

  writeConfig(config)
  log('done.')
}
