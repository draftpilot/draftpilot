import path from 'path'
import fs from 'fs'
import sqlite3 from 'sqlite3'
import { cyrb53, fatal } from '@/utils/utils'
import { verboseLog } from '@/utils/logger'
import { CodeDoc, SourceFile } from '@/types'
import config from '@/config'
import { ExtractorService } from '@/parsing/extractorService'

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
        const contents = fs.readFileSync(file, 'utf-8')
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
    const docs = [...existingDocs, ...changedDocs, ...newDocs]
    return { docs, newDocs, changedDocs }
  }

  saveVectors = async (docs: CodeDoc[]) => {
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
