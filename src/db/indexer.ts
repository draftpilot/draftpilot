import chalk from 'chalk'
import FastGlob from 'fast-glob'

import { readConfig } from '@/context/projectConfig'
import FileDB from '@/db/docsDb'
import SearchDB from '@/db/searchDb'
import { VectorDB } from '@/db/vectorDb'
import { CodeDoc, ProjectConfig } from '@/types'
import { log, verboseLog } from '@/utils/logger'
import { findRoot } from '@/utils/utils'

// things that glob should never return
export const GLOB_EXCLUSIONS = [
  '!**/node_modules/**',
  '!**/dist/**',
  '!**/build/**',
  '!**/venv/**',
  '!**/.*/**',
  '!**/*.jp*',
  '!**/*.pn*',
  '!**/*.gif',
  '!**/*.ico',
  '!**/*.wo*',
  '!**/*.mp*',
  '!**/*.web*',
  '!**/*.zip',
  '!**/*.gz',
  '!**/*.tar',
  '!**/*.tgz',
  '!**/*.pdf',
  '!.draftpilot/**',
]

export const DEFAULT_GLOB = ['**/*', ...GLOB_EXCLUSIONS]

export const GLOB_WITHOUT_TESTS = [
  ...DEFAULT_GLOB,
  '!**/__tests__/**',
  '!**/*.test.*',
  '!**/*.spec.*',
]

const TAG = '[indexer]'

// indexer wraps the entire work of indexing
export class Indexer {
  fileDB: FileDB
  vectorDB: VectorDB
  searchDB: SearchDB
  files: string[]
  docs?: CodeDoc[]
  indexed: boolean = false

  constructor(private verbose?: boolean, batchSize?: number, timeout?: number) {
    const root = findRoot()
    this.fileDB = new FileDB(root)
    this.vectorDB = new VectorDB(verbose, batchSize, timeout)
    this.searchDB = new SearchDB()
    this.files = []
  }

  getFiles = async (glob?: string | string[]) => {
    const globs: string[] = !glob ? GLOB_WITHOUT_TESTS : Array.isArray(glob) ? glob : [glob || '']

    const config = readConfig() || ({} as ProjectConfig)
    const customExclude = config.excludeDirs
    if (customExclude) {
      customExclude.split(',').forEach((dir) => globs.push(`!${dir}`))
    }
    const files = await FastGlob(globs)
    this.files = files
    if (this.verbose) log('found', files.length, 'files')
    return files
  }

  // loads index, returns a set of new documents that have changed since last index
  load = async (
    files?: string[],
    skipDelete?: boolean
  ): Promise<{ docs: CodeDoc[]; updatedDocs: CodeDoc[]; existing: boolean }> => {
    await this.fileDB.init()
    if (!files) files = await this.getFiles()
    const { docs, docsToDelete } = await this.fileDB.processFiles(files)
    if (!docs) return { docs: [], updatedDocs: [], existing: false }
    this.docs = docs
    if (this.verbose) log('parsed files into ', docs.length, 'entries')

    if (!skipDelete) this.fileDB.deleteDocs(docsToDelete)
    const updatedDocs: CodeDoc[] = docs.filter((f) => !f.vectors)
    return { docs, updatedDocs, existing: !this.fileDB.dbWasEmpty }
  }

  index = async (updatedDocs: CodeDoc[]) => {
    verboseLog(TAG, 'loading embeddings for', updatedDocs.length, 'updated docs')
    await this.vectorDB.loadEmbeddings(updatedDocs)
    await this.fileDB.saveVectors(updatedDocs)

    this.indexed = true
  }

  loadVectors = async (docs: CodeDoc[]) => {
    await this.vectorDB.init(docs)
    this.searchDB.addDocuments(docs)
  }

  loadFilesIntoVectors = async (glob?: string) => {
    if (this.indexed) return
    const files = await this.getFiles(glob)
    const { docs, updatedDocs } = await this.load(files)
    await this.index(updatedDocs)
    await this.loadVectors(docs)

    this.indexed = true
  }

  skipIndexing = async () => {
    this.indexed = true
  }

  createPartialIndex = async (prefixes: string[]) => {
    const subsetDocs = this.docs!.filter((d) =>
      prefixes.some((prefix) => d.path.startsWith(prefix))
    )
    const vectorDb = new VectorDB()
    await vectorDb.init(subsetDocs)
    return vectorDb
  }

  vectorAndCodeSearch = async (query: string, max: number) => {
    const vectorResults = (await this.vectorDB.search(query, max)) || []
    const results = await this.searchDB.searchDocuments(query, this.docs!, max)

    const vectorSet = new Set(vectorResults.map((r) => r.metadata.path))
    return vectorResults.concat(
      results
        .filter((r) => !vectorSet.has(r.path))
        .map((r) => ({ metadata: { path: r.path }, pageContent: r.contents }))
    )
  }
}

// global singleton instance
export const indexer = new Indexer()
