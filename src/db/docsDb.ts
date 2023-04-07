import path from 'path'
import fs from 'fs'
import sqlite3 from 'sqlite3'
import { cyrb53, fatal } from '@/utils'
import { verboseLog } from '@/logger'
import { FunctionDoc, SourceFile } from '@/types'
import { JSExtractor } from '@/db/jsExtractor'

const DB_FOLDER = '.drafty'
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
  existing?: boolean
  db?: sqlite3.Database

  constructor(root: string) {
    this.dbPath = path.join(root, DB_FOLDER)
    this.existing = fs.existsSync(this.dbPath)
    if (!this.existing) fs.mkdirSync(this.dbPath)
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
      fatal('not initialized')
      return null
    }

    const allDocs: { [path: string]: FunctionDoc } = {}
    const extractor = new JSExtractor()

    files.forEach((file) => {
      const contents = fs.readFileSync(file, 'utf-8')
      const sourceFile: SourceFile = { name: file, contents }
      const docs = extractor.parse(sourceFile)
      docs.forEach((doc) => (allDocs[doc.path] = doc))
    })

    // check for existing records in sqlite
    const changedDocs: FunctionDoc[] = []
    const docsToDelete: string[] = []
    const existingDocs: FunctionDoc[] = []

    const rows = await new Promise<DocRow[]>((res, rej) =>
      this.db!.all(`SELECT * FROM docs`, [], promisedResult(res, rej))
    )

    for (const row of rows) {
      const doc = allDocs[row.path]
      if (!doc) {
        docsToDelete.push(row.path)
      } else if (doc.hash !== row.hash) {
        changedDocs.push(doc)
        delete allDocs[row.path]
      } else {
        doc.vectors = JSON.parse(row.vectors)
        existingDocs.push(doc)
      }
    }

    verboseLog('docs to delete', docsToDelete)
    verboseLog(
      'changed docs',
      changedDocs.map((f) => f.path)
    )
    verboseLog('new files', Object.keys(allDocs))

    // delete files
    if (docsToDelete.length) {
      await new Promise((res, rej) =>
        this.db!.run(
          `DELETE FROM docs WHERE path IN (${docsToDelete.map(() => '?').join(',')})`,
          docsToDelete,
          promisedResult(res, rej)
        )
      )
    }

    const newDocs = Object.values(allDocs)
    return [...existingDocs, ...changedDocs, ...newDocs]
  }

  saveVectors = async (docs: FunctionDoc[]) => {
    if (!this.db) {
      fatal('not initialized')
      return
    }

    const rows = docs.map((doc) => {
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
