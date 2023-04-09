import { chatCompletion } from '@/ai/chat'
import { Indexer } from '@/db/indexer'
import { log, verboseLog } from '@/logger'
import { oraPromise } from 'ora'
import chalk from 'chalk'
import { cache } from '@/db/cache'
import { joinFilesWithContext } from '@/context/filetree'
import { getSimilarMethods } from '@/context/similar'

type Options = {
  glob?: string
}

export default async function (query: string, options: Options) {
  const indexer = new Indexer()

  const files = await indexer.getFiles(options.glob)
  const { docs, newDocs, existing } = await indexer.load()
  if (!existing) await indexer.index(newDocs)
  await indexer.loadVectors(docs)

  const joinedFiles = joinFilesWithContext(files)

  const similar = await getSimilarMethods(indexer, query, 4)

  const prompt = `Project Files:
${joinedFiles.join('\n')}

${similar ? 'Related functions:\n' + similar : ''}

Return a list of files which should be accessed or changed to fulfill this request in this format:
access:file,file
change:
- file: explanation
add:
- file: explanation
delete: none

Request: ${query}
`

  verboseLog(prompt)

  return

  const promise = chatCompletion(
    prompt,
    '3.5',
    'Respond in the requested format with no extra comments'
  )
  const result = await oraPromise(promise, { text: 'Generating an action plan...' })

  log(chalk.bold(`Here's my guess as to which files I'll need to access or change:`))

  log(result)

  cache.close()
}
