import { chatCompletion } from '@/ai/chat'
import { Indexer } from '@/db/indexer'
import { log, verboseLog } from '@/logger'
import { oraPromise } from 'ora'
import chalk from 'chalk'
import { cache } from '@/db/cache'
import { getFilesWithContext } from '@/context/filetree'
import { getSimilarMethods } from '@/context/similar'
import config from '@/config'
import fs from 'fs'

type Options = {
  glob?: string
}

const PLAN_FILE = 'plan.txt'

export default async function (query: string, options: Options) {
  const result = await doPlan(query, options)

  log(result)

  fs.writeFileSync(PLAN_FILE, result)
  log(chalk.green(`Wrote plan to ${PLAN_FILE}`))

  cache.close()
}

export async function doPlan(query: string, options?: Options) {
  const indexer = new Indexer()

  const files = await indexer.getFiles(options?.glob)
  const { docs, newDocs, existing } = await indexer.load()
  if (!existing) await indexer.index(newDocs)
  await indexer.loadVectors(docs)

  const filesWithContext = getFilesWithContext(files)

  const similar = await getSimilarMethods(indexer, query, 4)

  const prompt = `Project Files:
${filesWithContext.join('\n')}

${similar ? 'Related functions:\n' + similar : ''}

Return a list of files which should be accessed (no more than 3) or changed to fulfill this request in this format:
access: file,file

change:
- file: detailed explanation

add:
- file: detailed explanation

delete: none

Request: ${query}
`

  verboseLog(prompt)

  const model = config.gpt4 == 'always' ? '4' : '3.5'

  const promise = chatCompletion(
    prompt,
    model,
    'Respond in the requested format with no extra comments'
  )
  const result = await oraPromise(promise, { text: 'Generating an action plan...' })

  log(chalk.bold(`Here's my guess as to which files I'll need to access or change:`))

  // TODO let users iterate on the result

  return result
}
