import { indexer } from '@/db/indexer'
import { ChatPilot } from '@/directors/chatPilot'
import { log } from '@/utils/logger'
import fs from 'fs'

type Options = {
  history?: string
  json?: string
}

export default async function (query: string, options: Options) {
  await indexer.loadFilesIntoVectors()

  const history = options.history ? JSON.parse(options.history) : []

  const chatPilot = new ChatPilot()
  const result = await chatPilot.chat(query, history)

  if (options.json) {
    fs.writeFileSync(options.json, JSON.stringify(result))
    log(`Wrote result to ${options.json}`)
  }
}
