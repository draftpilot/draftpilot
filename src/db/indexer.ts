import FileDB from '@/db/docsDb'
import { VectorDB } from '@/db/vectorDb'
import { verboseLog } from '@/logger'
import { CodeDoc } from '@/types'
import { findRoot } from '@/utils'
import chalk from 'chalk'
import FastGlob from 'fast-glob'

const DEFAULT_GLOB = [
  '**/*.js',
  '**/*.ts',
  '**/*.jsx',
  '**/*.tsx',
  'package.json',
  'README*',
  '!**/node_modules/**',
  '!**/dist/**',
  '!**/build/**',
]

const GLOB_WITHOUT_TESTS = [...DEFAULT_GLOB, '!**/__tests__/**', '!**/*.test.*', '!**/*.spec.*']

const TAG = chalk.blue('[indexer]')

// indexer wraps the entire work of indexing
export class Indexer {
  fileDB: FileDB
  vectorDB: VectorDB

  constructor() {
    const root = findRoot()
    this.fileDB = new FileDB(root)
    this.vectorDB = new VectorDB()
  }

  getFiles = async (glob?: string) => {
    return await FastGlob(glob || GLOB_WITHOUT_TESTS)
  }

  // loads index, returns a set of new documents that have changed since last index
  load = async (
    files?: string[]
  ): Promise<{ docs: CodeDoc[]; updatedDocs: CodeDoc[]; existing: boolean }> => {
    await this.fileDB.init()
    if (!files) files = await this.getFiles()
    const { docs } = await this.fileDB.processFiles(files)
    if (!docs) return { docs: [], updatedDocs: [], existing: false }

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
  }

  loadFilesIntoVectors = async (glob?: string) => {
    const files = await this.getFiles(glob)
    const { docs, updatedDocs, existing } = await this.load(files)
    if (!existing) await this.index(updatedDocs)
    await this.loadVectors(docs)
  }
}
