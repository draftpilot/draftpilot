import { chatCompletion } from '@/ai/chat'
import { Indexer } from '@/db/indexer'
import { log, verboseLog } from '@/logger'
import { pluralize, readConfig } from '@/utils'
import chalk from 'chalk'

type Options = {
  reindex: boolean
}

// codegen based on a query
export default async function (prompt: string, options: Options) {
  const config = readConfig()
  if (!config) throw new Error('you must run `init` first')

  const indexer = new Indexer()
  const { docs, newDocs, existing } = await indexer.load()

  if (!existing) throw new Error('you must run `index` first')
  if (newDocs.length) {
    if (options.reindex) await indexer.index(newDocs)
    else
      log(
        chalk.yellow(
          `Found ${pluralize(newDocs.length, 'new function')}, run with --reindex to index them`
        )
      )
  }

  await indexer.loadVectors(docs)

  const firstPassPrompt = `
    Request: ${prompt}. Response: ${config.language} code for ${config.techstack}. Do not return anything but code.
  `

  verboseLog(firstPassPrompt)

  const result = await chatCompletion(firstPassPrompt, '3.5')
  log('v1 result:', result)
}
