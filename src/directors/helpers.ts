import fs from 'fs'
import { encode } from 'gpt-3-encoder'
import path from 'path'

import { extToLanguage } from '@/context/language'
import { indexer } from '@/db/indexer'
import { Attachment, ChatMessage, Model } from '@/types'
import { fuzzyMatchingFile } from '@/utils/utils'

export function pastMessages(history: ChatMessage[]) {
  const pastMessages: ChatMessage[] = []
  history.forEach((msg) => {
    if (msg.role == 'system') return
    pastMessages.push({
      role: msg.role,
      content: msg.content,
    })
  })
  return pastMessages
}

// fit as many messages as possible into the token budget
export function compactMessageHistory(
  messages: ChatMessage[],
  model: Model,
  systemMessage?: ChatMessage,
  answerTokens = 500
) {
  let tokenBudget = (model == '4' ? 7500 : 4000) - answerTokens

  if (systemMessage) tokenBudget -= encode(systemMessage.content).length

  const history: ChatMessage[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (systemMessage && msg.role == 'system') continue

    // if this is a past user message, ok to truncate long messages.
    const content =
      msg.role == 'user' && i < messages.length - 1 ? msg.content.slice(0, 500) : msg.content
    tokenBudget -= encode(content).length
    if (tokenBudget < 0) break
    history.push({
      role: msg.role,
      content: content,
    })
  }
  if (history.length == 0) {
    throw new Error('no messages fit in the token budget')
  }
  if (systemMessage) history.push(systemMessage)
  history.reverse()
  return history
}

function sliceLines(content: string, lines: number) {
  const splitContent = content.split('\n').filter((l) => l.trim().length > 0)
  if (splitContent.length < lines) return content
  return (
    splitContent.slice(0, lines).join('\n') +
    `\n... (${splitContent.length - lines} more lines) ...`
  )
}

export function attachmentListToString(attachments: Attachment[] | undefined) {
  if (!attachments) return undefined

  const linesPerFile = 200 / attachments.length
  return attachments
    .map((attachment) => {
      if (attachment.content) {
        return attachment.name + '\n---\n' + sliceLines(attachment.content, linesPerFile)
      } else if (attachment.type === 'file') {
        const filePath = fuzzyMatchingFile(attachment.name, indexer.files)
        if (filePath) {
          const content = fs.readFileSync(filePath, 'utf8')
          return filePath + '\n---\n' + sliceLines(content, linesPerFile) + '\n---\n'
        }
      }
    })
    .filter(Boolean)
    .join('\n')
}

export function detectProjectLanguage() {
  const extensions: { [ext: string]: number } = {}
  indexer.files.map((file) => {
    const ext = path.extname(file)
    const lang = extToLanguage[ext as keyof typeof extToLanguage]
    if (lang) {
      extensions[lang] = (extensions[lang] || 0) + 1
    }
  })

  const sorted = Object.values(extensions).sort((a, b) => b - a)
  const total = sorted.reduce((a, b) => a + b, 0)
  const top = sorted[0]
  const second = sorted[1]
  const topLanguage = Object.keys(extensions).find((ext) => extensions[ext] == top)
  const secondLanguage = Object.keys(extensions).find((ext) => extensions[ext] == second)
  if (!secondLanguage || top / total > 0.8) {
    return topLanguage
  }
  return topLanguage + ' / ' + secondLanguage
}

export function detectTypeFromResponse<T extends string>(
  answer: string,
  types: T[],
  defaultType: T
) {
  let foundType: string | undefined
  let foundResponse = answer

  for (const type of types) {
    if (answer.startsWith(type)) {
      foundType = type
      foundResponse = answer.substring(type.length + 1)
      break
    }
  }
  if (!foundType) {
    for (const type of types) {
      if (answer.includes(type)) {
        foundType = type
        foundResponse = answer.replace(type, '')
        break
      }
    }
  }
  if (!foundType) foundType = defaultType
  if (foundResponse.startsWith(':')) foundResponse = foundResponse.substring(1)

  return { type: foundType, response: foundResponse.trim() }
}
