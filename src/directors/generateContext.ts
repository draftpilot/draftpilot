import { getModel, streamChatWithHistory } from '@/ai/api'
import { findRelevantDocs } from '@/context/relevantFiles'
import { indexer } from '@/db/indexer'
import { compactMessageHistory } from '@/directors/helpers'
import { IntentHandler } from '@/directors/intentHandler'
import prompts from '@/prompts'
import { ChatMessage, Intent, MessagePayload, PostMessage } from '@/types'
import fs from 'fs'

// product manager bot
export class GenerateContext extends IntentHandler {
  initialRun = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ) => {
    const model = getModel(false)

    const relevantDocs: string[] = [],
      relevantCode: string[] = []
    const contextStrings = [
      'database db api models',
      'client frontend styles stores state',
      'server backend api routes',
    ]
    for (const contextString of contextStrings) {
      const docs = await findRelevantDocs(contextString, indexer.files, 15)
      relevantDocs.push(docs)

      const similarCode = await indexer.vectorDB.searchWithScores(contextString, 3)
      const similarFuncs =
        similarCode
          ?.filter((s) => {
            const [doc, score] = s
            if (score < 0.15) return false
            return true
          })
          .map((s) => s[0].pageContent) || []
      relevantCode.push(...similarFuncs)
    }

    const manifestFiles = []
    for (const manifestFile of [
      'package.json',
      'requirements.txt',
      'Gemfile',
      'pom.xml',
      'Gemfile',
      'go.mod',
      'Cargo.toml',
    ]) {
      if (fs.existsSync(manifestFile)) {
        const contents = fs.readFileSync(manifestFile, 'utf8')
        manifestFiles.push(manifestFile + '\n' + contents)
      }
    }

    const prompt = prompts.genContext({
      folders: relevantDocs.join('\n'),
      manifest: manifestFiles.join('\n'),
      referenceCode: relevantCode.join('\n\n'),
    })

    const response = await streamChatWithHistory(
      [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model,
      (response) => {
        postMessage(response)
      }
    )

    return {
      role: 'assistant',
      content: response,
    } as ChatMessage
  }
}
