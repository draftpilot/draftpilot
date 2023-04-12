import FileDB from '@/db/docsDb'
import { VectorDB } from '@/db/vectorDb'
import { verboseLog } from '@/utils/logger'
import { CodeDoc } from '@/types'
import { findRoot } from '@/utils/utils'
import chalk from 'chalk'
import FastGlob from 'fast-glob'
import SearchDB from '@/db/searchDb'

// things that glob should never return
export const GLOB_EXCLUSIONS = ['!**/node_modules/**', '!**/dist/**', '!**/build/**']

export const DEFAULT_GLOB = [
  '**/*.js',
  '**/*.ts',
  '**/*.jsx',
  '**/*.tsx',
  'package.json',
  'README*',
  ...GLOB_EXCLUSIONS,
]

export const GLOB_WITHOUT_TESTS = [
  ...DEFAULT_GLOB,
  '!**/__tests__/**',
  '!**/*.test.*',
  '!**/*.spec.*',
]

const TAG = chalk.blue('[indexer]')

// indexer wraps the entire work of indexing
export class Indexer {
  fileDB: FileDB
  vectorDB: VectorDB
  searchDB: SearchDB
  files: string[]
  docs?: CodeDoc[]

  constructor() {
    const root = findRoot()
    this.fileDB = new FileDB(root)
    this.vectorDB = new VectorDB()
    this.searchDB = new SearchDB()
    this.files = []
  }

  getFiles = async (glob?: string | string[]) => {
    const files = await FastGlob(glob || GLOB_WITHOUT_TESTS)
    this.files = files
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

    if (!skipDelete) this.fileDB.deleteDocs(docsToDelete)
    const updatedDocs: CodeDoc[] = docs.filter((f) => !f.vectors)
    return { docs, updatedDocs, existing: !this.fileDB.dbWasEmpty }
  }

  index = async (updatedDocs: CodeDoc[]) => {
    verboseLog(TAG, 'loading embeddings for', updatedDocs.length, 'updated docs')
    await this.vectorDB.loadEmbeddings(updatedDocs)
    await this.fileDB.saveVectors(updatedDocs)
  }

  loadVectors = async (docs: CodeDoc[]) => {
    await this.vectorDB.init(docs)
    this.searchDB.addDocuments(docs)
  }

  loadFilesIntoVectors = async (glob?: string) => {
    const files = await this.getFiles(glob)
    const { docs, updatedDocs } = await this.load(files)
    await this.index(updatedDocs)
    await this.loadVectors(docs)
  }

  createPartialIndex = async (prefixes: string[]) => {
    const subsetDocs = this.docs!.filter((d) =>
      prefixes.some((prefix) => d.path.startsWith(prefix))
    )
    const vectorDb = new VectorDB()
    await vectorDb.init(subsetDocs)
    return vectorDb
  }
}

// global singleton instance
export const indexer = new Indexer()
