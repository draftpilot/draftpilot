import { chatCompletion } from '@/ai/api'
import config from '@/config'
import { getSimilarMethods } from '@/context/similar'
import { cache } from '@/db/cache'
import { Indexer } from '@/db/indexer'
import { log, verboseLog } from '@/utils/logger'
import chalk from 'chalk'
import { oraPromise } from 'ora'

type Options = {
  k?: string
  reindex: boolean
}

// codegen based on a query
export default async function (prompt: string, options: Options) {
  const indexer = new Indexer()

  await indexer.loadFilesIntoVectors()

  const similar = await getSimilarMethods(indexer, prompt, options.k ? parseInt(options.k) : 4)

  if (!similar)
    log(chalk.yellow('Warning:'), 'No similar functions found. Codegen may not be useful.')

  const firstPassPrompt = `
  Related functions:
  ${similar}

  ---
  Concicely tell me which file/functions you would modify and how you would modify it to do the following: ${prompt}
  `

  verboseLog(firstPassPrompt)

  const model = config.gpt4 == 'never' ? '3.5' : '4'

  const promise = chatCompletion(firstPassPrompt, model)
  const result = await oraPromise(promise, { text: 'Thinking...' })
  log(chalk.green('Result:'), result)

  cache.close()
}
