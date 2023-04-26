import { getModel, streamChatWithHistory } from '@/ai/api'
import { indexer } from '@/db/indexer'
import { compactMessageHistory } from '@/directors/helpers'
import { ChatMessage, Intent, MessagePayload, Model, PostMessage } from '@/types'
import { log } from '@/utils/logger'
import { fuzzyParseJSON, pluralize } from '@/utils/utils'
import fs from 'fs'
import path from 'path'
import { encode } from 'gpt-3-encoder'
import prompts from '@/prompts'
import { IntentHandler } from '@/directors/intentHandler'
import chalk from 'chalk'
import { EXAMPLE_OPS } from '@/utils/editOps'

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
    const basePrompt = prompts.editPilot({
      message: message.content,
      files: '',
      exampleJson: JSON.stringify(EXAMPLE_OPS),
    })
    const baseMessage = { role: 'user', content: basePrompt } as ChatMessage
    const messages = compactMessageHistory([...recentHistory, baseMessage], model, {
      role: 'system',
      content: systemMessage,
    })

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

    let fileBodies = []
    for (const file of filesToEdit) {
      if (fs.existsSync(file)) {
        const contents = fs.readFileSync(file, 'utf-8')
        const fileLines = contents.split('\n')
        const decorated = fileLines.map((line, i) => `${i + 1}: ${line}`).join('\n')
        fileBodies.push(file + '\n' + decorated)
      } else {
        fileBodies.push(file + '\nNew File')
      }
    }

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
    const similarFuncs = similar
      ?.filter((s) => {
        const [doc, score] = s
        if (score < 0.15) return false
        const existing = filesToEdit.find((f) => doc.metadata.path.includes(f))
        if (existing) return false
        return true
      })
      .map((s) => s[0])
    const similarFuncText = similarFuncs?.length
      ? 'Related functions:\n' +
        similarFuncs.map((s) => s.metadata.path + '\n' + s.pageContent).join('\n\n') +
        '------\n\n'
      : ''

    const messageTokenCount = messages.reduce((acc, m) => acc + encode(m.content).length, 0)
    const tokenBudget = model == '3.5' ? 4000 : 8000

    // check if entire sequence fits in my token count
    const similarFuncLength = encode(similarFuncText).length
    const estimatedOutput = encode(plan).length
    const allFileBodies = fileBodies.join('\n\n')
    const fileBodyTokens = encode(allFileBodies).length

    const editorPrompt = messages[messages.length - 1]
    const baseEditorContent = '\n\n' + editorPrompt.content
    const editFileHelper = async (fileContent: string) => {
      editorPrompt.content =
        similarFuncText +
        'Files to edit (only edit these files):\n' +
        fileContent +
        baseEditorContent

      const response = await streamChatWithHistory(messages, model, postMessage)
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
      }
      if (currentFileBodies.length) {
        promises.push(editFileHelper(currentFileBodies.join('\n\n')))
      }
    }

    const results = await Promise.all(promises)
    // fuzzy parse and merge all results
    const merged = results.map((r) => fuzzyParseJSON(r)).reduce((acc, r) => ({ ...acc, ...r }), {})
    return merged
  }

  followupRun = async (
    payload: MessagePayload,
    attachmentBody: string | undefined,
    systemMessage: string,
    postMessage: PostMessage
  ): Promise<ChatMessage> => {
    return await this.initialRun(payload, attachmentBody, systemMessage, postMessage)
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
}
