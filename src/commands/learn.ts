import { Command } from 'commander'
import { addToLearning } from '@/context/learning'

export default function learn(lesson: string): void {
  const learningData = {
    content: lesson,
    createdAt: new Date(),
    embeddings: [],
  }

  addToLearning('planner', learningData)
  console.log('Lesson learned:', lesson)
}
