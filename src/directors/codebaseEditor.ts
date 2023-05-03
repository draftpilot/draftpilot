import chalk from 'chalk'
import fs from 'fs'
import { encode } from 'gpt-3-encoder'
import path from 'path'

import openAIApi, { getModel } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { compactMessageHistory } from '@/directors/helpers'
import { IntentHandler } from '@/directors/intentHandler'
import prompts from '@/prompts'
import { ChatMessage, Intent, MessagePayload, Model, PostMessage } from '@/types'
import { EXAMPLE_OPS } from '@/utils/editOps'
import { log } from '@/utils/logger'
import { fuzzyParseJSON, pluralize } from '@/utils/utils'

type EditPlan = { context: string; [path: string]: string }

// actor which can take actions on a codebase
export class CodebaseEditor extends IntentHandler {
  initialRun = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ) => {
    const { message, history } = payload
    const planMessageIndex = history.findLastIndex((h) => h.intent == Intent.DRAFTPILOT)

    // only accept history after plan message
    const planMessage = history[planMessageIndex] || history[history.length - 1]
    const recentHistory = history.slice(planMessageIndex - 1)

    const model = getModel(true)
    const messages = compactMessageHistory(
      recentHistory,
      model,
      {
        role: 'system',
        content: systemMessage,
      },
      500
    )

    const { filesToEdit, fileBodies } = this.readFilesToEdit(payload, planMessage.content)

    const basenames = filesToEdit.map((f) => path.basename(f))
    postMessage({
      role: 'assistant',
      content: `Editing ${pluralize(filesToEdit.length, 'file')}: ${basenames.join(', ')}`,
      intent: Intent.DRAFTPILOT,
    })

    const response = await this.editFiles(
      model,
      planMessage.content,
      filesToEdit,
      fileBodies,
      messages,
      postMessage
    )

    return {
      role: 'assistant',
      content: response,
      intent: Intent.EDIT_FILES,
    } as ChatMessage
  }

  readFilesToEdit = (payload: MessagePayload, plan: string) => {
    const { message } = payload
    const filesToEdit = this.getFilesFromPlan(plan)
    if (message.attachments) message.attachments.forEach((a) => filesToEdit.push(a.name))

    if (filesToEdit.length == 0) {
      log(chalk.yellow('WARNING: No files to edit'))
      // it's possible that code snippets are enough to make edits
    }

    let fileBodies = this.getFileBodies(filesToEdit)

    return { filesToEdit, fileBodies }
  }

  editFiles = async (
    model: Model,
    plan: string,
    filesToEdit: string[],
    fileBodies: string[],
    messages: ChatMessage[],
    postMessage: PostMessage
  ) => {
    const similar = await indexer.vectorDB.searchWithScores(plan, 6)
    const similarFuncs =
      similar
        ?.filter((s) => {
          const [doc, score] = s
          if (score < 0.15) return false
          const existing = filesToEdit.find((f) => doc.metadata.path.includes(f))
          if (existing) return false
          return true
        })
        .map((s) => s[0]) || []
    const similarFuncText = similarFuncs.length
      ? 'Related functions:\n' +
        similarFuncs.map((s) => s.pageContent).join('\n\n') +
        '\n\n------\n\n'
      : ''

    const messageTokenCount = messages.reduce((acc, m) => acc + encode(m.content).length, 0)
    const tokenBudget = model == '3.5' ? 4000 : 8000

    // check if entire sequence fits in my token count
    const similarFuncLength = encode(similarFuncText).length
    const estimatedOutput = encode(plan).length
    const allFileBodies = fileBodies.join('\n\n')
    const fileBodyTokens = encode(allFileBodies).length

    const editFileHelper = async (fileContent: string) => {
      const fileData = similarFuncText + 'Files to edit (only edit these files):\n' + fileContent
      const editorPrompt = prompts.editPilot({
        files: fileData,
        exampleJson: JSON.stringify(EXAMPLE_OPS),
      })

      const editMessage = { role: 'user', content: editorPrompt } as ChatMessage
      const response = await openAIApi.streamChatWithHistory(
        [...messages, editMessage],
        model,
        postMessage
      )
      return response
    }

    const promises: Promise<string>[] = []
    if (messageTokenCount + similarFuncLength + estimatedOutput + fileBodyTokens < tokenBudget) {
      promises.push(editFileHelper(allFileBodies))
    } else {
      // we need to send files separately
      let currentFileBodies: string[] = []
      while (fileBodies.length) {
        const nextFile = fileBodies.shift()!
        const nextFileTokens = encode(nextFile).length

        const totalTokens = messageTokenCount + similarFuncLength + estimatedOutput + nextFileTokens
        if (totalTokens > tokenBudget) {
          promises.push(editFileHelper(currentFileBodies.join('\n\n')))
          currentFileBodies = []
        }
        currentFileBodies.push(nextFile)
      }
      if (currentFileBodies.length) {
        promises.push(editFileHelper(currentFileBodies.join('\n\n')))
      }
    }

    const results = await Promise.all(promises)
    const invalidJson = results.find((r) => !r.startsWith('{'))
    if (invalidJson) {
      console.log('ERROR: Failed to parse edit results')
      return results.join('\n\n')
    }

    // fuzzy parse and merge all results
    const merged = results.map((r) => fuzzyParseJSON(r)).reduce((acc, r) => ({ ...acc, ...r }), {})
    return JSON.stringify(merged)
  }

  followupRun = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ): Promise<ChatMessage> => {
    const { message, history } = payload
    const prevPlanIndex = history.findLastIndex((h) => h.intent == Intent.DRAFTPILOT)
    const prevEditIndex = history.findLastIndex((h) => h.intent == Intent.EDIT_FILES)

    if (prevPlanIndex > prevEditIndex) {
      // there was a planning session in between - treat this like an initial run
      return this.initialRun(payload, attachmentBody, systemMessage, postMessage)
    }

    // only accept history after edit message
    const recentHistory = history.slice(prevEditIndex - 1)

    const model = getModel(true)
    const messages = compactMessageHistory([...recentHistory, message], model, {
      role: 'system',
      content: systemMessage,
    })

    const response = await openAIApi.streamChatWithHistory(messages, model, postMessage)

    return {
      role: 'assistant',
      content: response,
      intent: Intent.EDIT_FILES,
    } as ChatMessage
  }

  getFilesFromPlan = (plan: string) => {
    const firstSep = plan.indexOf('---\n')
    const lastSep = plan.lastIndexOf('---\n')

    // files is typically in format - <path> - edits
    const fileRegex = /^. ([^ ]+)/
    let fileText = plan
    if (firstSep > -1 && lastSep > -1) {
      fileText = plan.substring(firstSep + 4, lastSep)
    }

    const splitFileText = fileText.split('\n')
    const files = splitFileText
      .map((f) => {
        const match = f.match(fileRegex)
        if (!match) return ''
        return match[1]
      })
      .filter(Boolean)

    if (files.length) {
      return files
    }

    return []
  }

  getFileBodies(filesToEdit: string[]) {
    let fileBodies = []
    for (let file of filesToEdit) {
      // strip leading and trailing special characters from file name
      file = file.replace(/^[`'"]+/, '').replace(/[`'"]+$/, '')

      if (fs.existsSync(file)) {
        const contents = fs.readFileSync(file, 'utf-8')
        const fileLines = contents.split('\n')
        const decorated = fileLines.map((line, i) => `${i + 1}: ${line}`).join('\n')
        fileBodies.push(file + '\n' + decorated)
      } else {
        fileBodies.push(file + '\nNew File')
      }
    }
    return fileBodies
  }
}
