import { chatCompletion } from '@/ai/chat'
import { Indexer } from '@/db/indexer'
import { joinFoldersWithFiles } from '@/knowledge/folders'
import { log, verboseLog } from '@/logger'
import { oraPromise } from 'ora'
import chalk from 'chalk'
import { cache } from '@/db/cache'

type Options = {
  glob?: string
}

export default async function (query: string, options: Options) {
  const indexer = new Indexer()

  const files = await indexer.getFiles(options.glob)

  const joinedFiles = joinFoldersWithFiles(files)

  const prompt = `Project Files:
${joinedFiles.join('\n')}

Return a list of files which should be accessed or changed to fulfill this request in this format:
access:file,file
change:file
add:none
delete:none

Request: ${query}
`

  verboseLog(prompt)

  const promise = chatCompletion(
    prompt,
    '3.5',
    'Respond in the requested format with no extra comments'
  )
  log(`Here's my guess as to which files I'll need to access & modify to perform your request.`)

  const result = await oraPromise(promise, { text: 'Thinking...' })

  log(chalk.green('Result:'), result)

  cache.close()
}
