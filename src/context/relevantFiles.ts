import fs from 'fs'

import { Indexer, indexer } from '@/db/indexer'
import { findSimilarDocuments } from '@/utils/similarity'
import { splitOnce } from '@/utils/utils'

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
    const file = splitOnce(doc.metadata.path, '#')[0]
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
