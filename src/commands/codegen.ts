import { chatCompletion } from '@/ai/chat'
import config from '@/config'
import { getSimilarMethods } from '@/context/similar'
import { cache } from '@/db/cache'
import { Indexer } from '@/db/indexer'
import { log, verboseLog } from '@/logger'
import { pluralize, readConfig } from '@/utils'
import chalk from 'chalk'
import { oraPromise } from 'ora'

type Options = {
  k?: string
  reindex: boolean
}

// codegen based on a query
export default async function (prompt: string, options: Options) {
  const indexer = new Indexer()
  const { docs, newDocs, existing } = await indexer.load()

  if (!existing) await indexer.index(newDocs)
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

  const similar = await getSimilarMethods(indexer, prompt, options.k ? parseInt(options.k) : 4)

  if (!similar) throw 'No similar functions found. Codegen is not gonna be useful.'

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
