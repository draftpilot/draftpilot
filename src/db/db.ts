import { HNSWLib } from 'langchain/vectorstores'
import { OpenAIEmbeddings } from 'langchain/embeddings'
import path from 'path'
import fs from 'fs'
import sqlite3 from 'sqlite3'
import { cyrb53, error, fatal } from '@/utils'

const DB_FOLDER = '.drafty'
const SQLITE_DB_NAME = 'files.sqlite'

type SourceFile = {
  name: string
  contents: string
  hash: number
}

type FileRow = {
  id: number
  path: string
  hash: number
  updated_at: string
}

export default class DB {
  dbPath: string
  existing?: boolean
  vectorStore?: HNSWLib
  db?: sqlite3.Database

  constructor(root: string) {
    this.dbPath = path.join(root, DB_FOLDER)
    this.existing = fs.existsSync(this.dbPath)
    if (!this.existing) fs.mkdirSync(this.dbPath)
  }

  init = async () => {
    await Promise.all([this.loadVectorStore(), this.loadFileStore()])
  }

  loadVectorStore = async () => {
    if (fs.existsSync(path.join(this.dbPath, 'args.json'))) {
      this.vectorStore = await HNSWLib.load(this.dbPath, new OpenAIEmbeddings())
    }
  }

  loadFileStore = async () => {
    this.db = new sqlite3.Database(path.join(this.dbPath, SQLITE_DB_NAME))
    await new Promise((res, rej) =>
      this.db!.run(
        `CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      hash INTEGER NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(path)
    )`,
        promisedResult(res, rej)
      )
    )
  }

  processFiles = async (files: string[]) => {
    if (!this.db) {
      return fatal('not initialized')
    }

    const allFiles: { [path: string]: SourceFile } = {}

    files.forEach((file) => {
      const contents = fs.readFileSync(file, 'utf-8')
      const hash = this.hashFile(contents)

      const sourceFile: SourceFile = { name: file, contents, hash }
      allFiles[file] = sourceFile
    })

    // check for existing records in sqlite
    const changedFiles: SourceFile[] = []
    const filesToDelete: string[] = []

    const rows = await new Promise<FileRow[]>((res, rej) =>
      this.db!.all(`SELECT * FROM files`, [], promisedResult(res, rej))
    )

    for (const row of rows) {
      const file = allFiles[row.path]
      if (!file) {
        filesToDelete.push(row.path)
      } else if (file.hash !== row.hash) {
        changedFiles.push(file)
        delete allFiles[row.path]
      }
    }

    const filesToProcess = Object.values(allFiles).concat(changedFiles)

    console.log('files to delete', filesToDelete)
    console.log(
      'changed files',
      changedFiles.map((f) => f.name)
    )
    console.log('new files', Object.keys(allFiles))
  }

  hashFile = (contents: string) => {
    return cyrb53(contents)
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
