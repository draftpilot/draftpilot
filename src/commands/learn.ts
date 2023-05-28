import { Command } from 'commander'
import { FileDB } from '@/db/docsDb'

export default async function learn(lesson: string): Promise<void> {
  const db = new FileDB('.')
  await db.init()

  const learning = {
    learning: lesson,
    vectors: '',
  }

  db.db!.run(`INSERT INTO learnings (learning, vectors) VALUES (?, ?)`, [
    learning.learning,
    learning.vectors,
  ])
}

import { Command } from 'commander'
import docsDb from '@/db/docsDb'

export default async function learn(lesson: string): Promise<void> {
  const db = new docsDb()
  await db.init()

  const stmt = db.db.prepare(`INSERT INTO learnings (learning) VALUES (?)`)
  stmt.run(lesson)
  stmt.finalize()
}

import { Command } from 'commander'
import docsDb from '@/db/docsDb'

export default async function learn(lesson: string): Promise<void> {
  const db = new docsDb()
  await db.init()

  const stmt = db.db.prepare(`INSERT INTO learnings (learning) VALUES (?)`)
  stmt.run(lesson)
  stmt.finalize()
}

import docsDb from '@/db/docsDb'

export default async function learn(lesson: string): Promise<void> {
  const db = new docsDb()
  await db.init()

  const stmt = db.db.prepare(`INSERT INTO learnings (learning) VALUES (?)`)
  stmt.run(lesson)
  stmt.finalize()
}
