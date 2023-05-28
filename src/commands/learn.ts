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
