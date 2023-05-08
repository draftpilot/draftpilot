import chalk from 'chalk'
import fs from 'fs'
import { encode } from 'gpt-3-encoder'
import path from 'path'

import openAIApi, { getModel } from '@/ai/api'
import { generateReferences } from '@/context/relevantFiles'
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
      undefined,
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
    referenceFiles: undefined | string[],
    postMessage: PostMessage
  ) => {
    const messageTokenCount = messages.reduce((acc, m) => acc + encode(m.content).length, 0)
    const tokenBudget = model == '3.5' ? 4000 : 8000

    const allFileBodies = fileBodies.join('\n\n')
    const fileBodyTokens = encode(allFileBodies).length
    const estimatedOutput = Math.max(encode(plan).length, fileBodyTokens / 5)

    let referenceBudget = tokenBudget - messageTokenCount - estimatedOutput - fileBodyTokens
    if (referenceBudget < 500) {
      // if we don't have enough for references, give a budget with the biggest file only
      const biggestFile = fileBodies.reduce((acc, f) => (f.length > acc.length ? f : acc), '')
      referenceBudget =
        tokenBudget - messageTokenCount - estimatedOutput - encode(biggestFile).length
    }

    const references = await generateReferences(
      filesToEdit,
      referenceFiles || [],
      plan,
      referenceBudget
    )
    const referencesLength = encode(references).length

    const editFileHelper = async (fileContent: string) => {
      const fileData = 'Files to edit (only edit these files):\n' + fileContent
      const editorPrompt = prompts.editPilot({
        references,
        files: fileData,
        exampleJson: JSON.stringify(EXAMPLE_OPS, null, 1),
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
    if (messageTokenCount + referencesLength + estimatedOutput + fileBodyTokens < tokenBudget) {
      promises.push(editFileHelper(allFileBodies))
    } else {
      // we need to send files separately
      let currentFileBodies: string[] = []
      while (fileBodies.length) {
        const nextFile = fileBodies.shift()!
        const nextFileTokens = encode(nextFile).length

        const totalTokens = messageTokenCount + referencesLength + estimatedOutput + nextFileTokens
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

    // results in yaml+markdown format
    const results = await Promise.all(promises)
    return results.join('\n\n')
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
