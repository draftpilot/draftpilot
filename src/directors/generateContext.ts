import fs from 'fs'

import openAIApi, { getModel } from '@/ai/api'
import { findRelevantDocs, getManifestFiles } from '@/context/relevantFiles'
import { indexer } from '@/db/indexer'
import { compactMessageHistory } from '@/directors/helpers'
import { IntentHandler } from '@/directors/intentHandler'
import prompts from '@/prompts'
import { ChatMessage, Intent, MessagePayload, PostMessage } from '@/types'

// product manager bot
export class GenerateContext extends IntentHandler {
  initialRun = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ) => {
    return await this.generate(postMessage)
  }

  generate = async (postMessage: PostMessage) => {
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

    const manifestFiles = getManifestFiles()

    const prompt = prompts.genContext({
      folders: relevantDocs.join('\n'),
      manifest: manifestFiles.join('\n'),
      referenceCode: relevantCode.join('\n\n'),
    })

    const response = await openAIApi.streamChatWithHistory(
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
