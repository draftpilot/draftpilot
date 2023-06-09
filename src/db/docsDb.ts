import fs from 'fs'
import { isBinaryFileSync } from 'isbinaryfile'
import path from 'path'
import sqlite3 from 'sqlite3'

import config from '@/config'
import { ExtractorService } from '@/parsing/extractorService'
import { CodeDoc, SourceFile } from '@/types'
import { extractImports } from '@/utils/importFixer'
import { verboseLog } from '@/utils/logger'
import { fatal } from '@/utils/utils'

const SQLITE_DB_NAME = 'docs.sqlite'

type DocRow = {
  id: number
  path: string
  hash: number
  vectors: string
  updated_at: string
}

export default class FileDB {
  dbPath: string
  dbWasEmpty: boolean = true
  db?: sqlite3.Database

  constructor(root: string) {
    this.dbPath = path.join(root, config.configFolder)
    const existing = fs.existsSync(this.dbPath)
    if (!existing) fs.mkdirSync(this.dbPath)
  }

  init = async () => {
    await new Promise<void>(
      (res, rej) =>
        (this.db = new sqlite3.Database(path.join(this.dbPath, SQLITE_DB_NAME), (err) => {
          if (err) rej(err)
          else res()
        }))
    )

    await new Promise((res, rej) =>
      this.db!.run(
        `CREATE TABLE IF NOT EXISTS docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      hash INTEGER NOT NULL,
      vectors TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(path)
    )`,
        promisedResult(res, rej)
      )
    )
  }

  processFiles = async (files: string[]) => {
    if (!this.db) {
      throw new Error('db not initialized')
    }

    const allDocs: { [path: string]: CodeDoc } = {}
    const extractor = new ExtractorService()

    await Promise.all(
      files.map(async (file) => {
        const size = fs.lstatSync(file).size
        if (size > 50_000) return // skip large files
        const contents = fs.readFileSync(file, 'utf-8')
        extractImports(contents)
        if (isBinaryFileSync(file)) return

        const sourceFile: SourceFile = { name: file, contents }
        const docs = await extractor.parse(sourceFile)
        docs.forEach((doc) => (allDocs[doc.path] = doc))
      })
    )

    // check for existing records in sqlite
    const changedDocs: CodeDoc[] = []
    const docsToDelete: string[] = []
    const existingDocs: CodeDoc[] = []

    const rows = await new Promise<DocRow[]>((res, rej) =>
      this.db!.all(`SELECT * FROM docs`, [], promisedResult(res, rej))
    )
    this.dbWasEmpty = rows.length === 0

    for (const row of rows) {
      const doc = allDocs[row.path]
      if (!doc) {
        docsToDelete.push(row.path)
      } else if (doc.hash !== row.hash) {
        changedDocs.push(doc)
      } else {
        doc.vectors = JSON.parse(row.vectors)
        existingDocs.push(doc)
      }
      delete allDocs[row.path]
    }

    verboseLog('docs to delete', docsToDelete)
    verboseLog(
      'changed docs',
      changedDocs.map((f) => f.path)
    )
    verboseLog('new files', Object.keys(allDocs))

    const newDocs = Object.values(allDocs)
    const docs = [...existingDocs, ...changedDocs, ...newDocs]
    return { docs, newDocs, changedDocs, docsToDelete }
  }

  deleteDocs = async (docs: string[]) => {
    if (!this.db || !docs.length) return

    await new Promise((res, rej) =>
      this.db!.run(
        `DELETE FROM docs WHERE path IN (${docs.map(() => '?').join(',')})`,
        docs,
        promisedResult(res, rej)
      )
    )
  }

  saveVectors = async (docs: CodeDoc[]) => {
    if (!this.db) {
      fatal('not initialized')
      return
    }

    const rows = docs
      .filter((doc) => doc.vectors)
      .map((doc) => {
        const vectors = JSON.stringify(doc.vectors)
        return [doc.path, doc.hash, vectors]
      })

    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO docs (path, hash, vectors) VALUES (?, ?, ?)`
    )
    for (const row of rows) {
      stmt.run(row)
    }
    stmt.finalize()
  }
}

// promisify sqlite3 result
const promisedResult =
  <T>(resolve: (value: T) => void, reject: (reason: any) => void) =>
  (err: Error, result: any) => {
    if (err) {
      return reject(err)
    }
    resolve(result)
  }
