import { readConfig, writeConfig } from '@/context/projectConfig'
import { Indexer } from '@/db/indexer'
import { GenerateContext } from '@/directors/generateContext'
import { ProjectConfig } from '@/types'
import { log } from '@/utils/logger'

type Options = {
  batchSize: number
  timeout: number
}

export default async function (options?: Options) {
  const batchSize = options?.batchSize || 256
  const timeout = options?.timeout || 5000

  // build initial index
  console.log('starting indexing with batchSize', batchSize, 'and timeout', timeout)
  const indexer = new Indexer(true, batchSize, timeout)
  const config: ProjectConfig = readConfig() || {}

  try {
    const { updatedDocs } = await indexer.load()
    config.files = indexer.files

    await indexer.index(updatedDocs)

    const contextGenerator = new GenerateContext(new Set())
    const result = await contextGenerator.generate((msg) => {
      process.stdout.write(typeof msg === 'string' ? msg : '\n')
    })
    log('\n')
    config.description = result.content
  } catch (e) {
    console.log('error', e)
    console.log(
      'sometimes OpenAI embeddings API fails / times out. You may want to try decreasing batchSize or increasing timeout.'
    )
  } finally {
    writeConfig(config)
  }
}
