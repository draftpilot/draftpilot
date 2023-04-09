import FileDB from '@/db/docsDb'
import { VectorDB } from '@/db/vectorDb'
import { verboseLog } from '@/logger'
import { CodeDoc } from '@/types'
import { findGitRoot } from '@/utils'
import chalk from 'chalk'
import FastGlob from 'fast-glob'

const DEFAULT_GLOB = [
  '**/*.js',
  '**/*.ts',
  '**/*.jsx',
  '**/*.tsx',
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
    const root = findGitRoot()
    this.fileDB = new FileDB(root)
    this.vectorDB = new VectorDB()
  }

  getFiles = async (glob?: string) => {
    return await FastGlob(glob || GLOB_WITHOUT_TESTS)
  }

  // loads index, returns a set of new documents that have changed since last index
  load = async (
    files?: string[]
  ): Promise<{ docs: CodeDoc[]; newDocs: CodeDoc[]; existing: boolean }> => {
    await this.fileDB.init()
    if (!files) files = await this.getFiles()
    const result = await this.fileDB.processFiles(files)
    if (!result) return { docs: [], newDocs: [], existing: false }

    const newDocs: CodeDoc[] = result.filter((f) => !f.vectors)

    return { docs: result, newDocs, existing: !this.fileDB.dbWasEmpty }
  }

  index = async (newDocs: CodeDoc[]) => {
    verboseLog(TAG, 'loading embeddings for', newDocs.length, 'new docs')
    await this.vectorDB.loadEmbeddings(newDocs)
    await this.fileDB.saveVectors(newDocs)
  }

  loadVectors = async (docs: CodeDoc[]) => {
    await this.vectorDB.init(docs)
  }
}
