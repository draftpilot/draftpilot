import { Command } from 'commander'
import docsDb from '@/db/docsDb'

export default async function learn(lesson: string): Promise<void> {
  const db = new docsDb()
  await db.init()

  const stmt = db.db.prepare(`INSERT INTO learnings (learning) VALUES (?)`)
  stmt.run(lesson)
  stmt.finalize()
}
