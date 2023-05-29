import fs from 'fs'
import { encode } from 'gpt-3-encoder'

import { Indexer, indexer } from '@/db/indexer'
import { Model } from '@/types'
import { findSimilarDocuments } from '@/utils/similarity'
import { splitOnce } from '@/utils/utils'

import type { Document } from '@/langchain/document'

export async function getSimilarMethods(indexer: Indexer, prompt: string, count: number) {
  const similar = await indexer.vectorDB.search(prompt, count)
  if (!similar) return null

  return similar.map((s) => s.pageContent).join('```\n\n')
}

export async function findRelevantDocs(query: string, files: string[], count: number = 20) {
  const filteredFiles = filterFiles(files, query, count)
  const fileSet = new Set(filteredFiles)
  const similarDocs = (await indexer.vectorDB.search(query, Math.ceil(count / 2))) || []

  const exactMatches = await indexer.searchDB.search(query, Math.ceil(count / 2))
  similarDocs.forEach((doc) => {
    const file = splitOnce(doc.metadata.path, ':')[0]
    fileSet.add(file)
  })

  const returnStrings = []
  if (exactMatches.length) returnStrings.push('Exact matches:', exactMatches.join('\n'))
  const relevantFiles = Array.from(fileSet)
  if (returnStrings.length && relevantFiles.length) returnStrings.push('Other related files:')
  if (relevantFiles.length) returnStrings.push(relevantFiles.join('\n'))

  return returnStrings.join('\n')
}

function filterFiles(files: string[], query: string, limit: number) {
  if (files.length <= limit) return files
  const similar = findSimilarDocuments(query, files)

  return similar.slice(0, limit)
}

export function getManifestFiles() {
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
  return manifestFiles
}

const SIMILARITY_THRESHOLD = 0.15
export type Snippet = { contents: string; path: string }

export async function generateReferences(
  excludeFiles: string[],
  referenceFiles: string[],
  plan: string,
  tokenBudget: number
) {
  // find most similar functions within the provided reference files
  const similarCode: Snippet[] = []
  const similarPaths = new Set<string>()
  let remainingBudget = tokenBudget

  const addSnippets = (similar: [Document, number][]) => {
    similar.map((s) => {
      const [doc, score] = s
      if (score < SIMILARITY_THRESHOLD) return
      const snippet = { path: doc.metadata.path, contents: doc.pageContent }

      if (similarPaths.has(snippet.path)) return
      if (excludeFiles.find((f) => snippet.path.startsWith(f))) return

      const length = encode(snippet.contents).length
      if (length > remainingBudget) return
      remainingBudget -= length
      similarCode.push(snippet)
      similarPaths.add(snippet.path)
    })
  }

  // first, grab all the functions in the reference files
  if (referenceFiles.length) {
    const partialIndex = await indexer.createPartialIndex(referenceFiles)
    const similar = await partialIndex.searchWithScores(plan, 6)
    addSnippets(similar)
  }

  // then, grab all the functions in the rest of the codebase
  const similar = await indexer.vectorDB.searchWithScores(plan, 6)
  addSnippets(similar)

  const combined = combineSnippets(similarCode)

  const relevantLearnings = (await indexer.learningDB?.search(plan, 10)) || []
  const learningStrings = relevantLearnings.map((l) => l.pageContent)
  if (learningStrings.length) learningStrings.unshift('Past Learnings:')

  return combined
    .map((s) => s.contents)
    .concat(learningStrings)
    .join('\n\n')
}

// the path format is <filepath>:<function name>#line numbers

export function combineSnippets(snippets: Snippet[]): Snippet[] {
  // Group snippets by file+function
  const groupedSnippets = snippets.reduce((groups: { [key: string]: Snippet[] }, snippet) => {
    const [fileFunc, _] = splitOnce(snippet.path, '#')

    if (!groups[fileFunc]) {
      groups[fileFunc] = []
    }
    groups[fileFunc].push(snippet)
    return groups
  }, {})

  // Combine snippets within each group
  const combinedSnippets = Object.entries(groupedSnippets).map(([path, group]) => {
    const lineMap: { [key: number]: string } = {}

    group.forEach((snippet) => {
      // the first line is the title of the snippet
      const lines = snippet.contents.split('\n').slice(1)
      const lineNumbers = snippet.path.split('#')[1].split('-').map(Number)

      lines.forEach((line, index) => {
        const lineNumber = lineNumbers[0] + index
        lineMap[lineNumber] = line
      })
    })

    const sortedLineNumbers = Object.keys(lineMap)
      .map(Number)
      .sort((a, b) => a - b)
    const combinedLines: string[] = []
    let lastLine = -1

    sortedLineNumbers.forEach((lineNumber) => {
      if (lastLine >= 0 && lineNumber - lastLine > 1) {
        combinedLines.push('...')
      }
      combinedLines.push(lineMap[lineNumber])
      lastLine = lineNumber
    })
    combinedLines.unshift(path)

    return { path, contents: combinedLines.join('\n') }
  })

  return combinedSnippets
}
