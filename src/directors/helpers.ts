import { indexer } from '@/db/indexer'
import { Attachment, ChatMessage, Model } from '@/types'
import { fuzzyMatchingFile } from '@/utils/utils'
import { encode } from 'gpt-3-encoder'
import path from 'path'
import fs from 'fs'

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
  systemMessage?: ChatMessage
) {
  let tokenBudget = model == '4' ? 6000 : 3500

  if (systemMessage) tokenBudget -= encode(systemMessage.content).length

  const history: ChatMessage[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]

    tokenBudget -= encode(msg.content).length
    if (tokenBudget < 0) break
    history.push({
      role: msg.role,
      content: msg.content,
    })
  }
  if (systemMessage) history.push(systemMessage)
  history.reverse()
  return history
}

export function attachmentListToString(attachments: Attachment[] | undefined) {
  return attachments
    ?.map((attachment) => {
      if (attachment.content) {
        return attachment.name + '\n---\n' + attachment.content
      } else if (attachment.type === 'file') {
        const filePath = fuzzyMatchingFile(attachment.name, indexer.files)
        if (filePath) {
          return filePath + '\n---\n' + fs.readFileSync(filePath, 'utf8') + '\n---\n'
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

const extToLanguage = {
  '.py': 'python',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.java': 'java',
  '.cs': 'csharp',
  '.go': 'go',
  '.rb': 'ruby',
  '.php': 'php',
  '.rs': 'rust',
  '.cpp': 'cpp',
  '.c': 'c',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.swift': 'swift',
  '.hs': 'haskell',
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
