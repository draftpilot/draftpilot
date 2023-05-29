import { Command } from 'commander'
import { addToLearning, readLearning } from '@/context/learning'
import { OpenAIEmbeddings } from '@/langchain/openai_embeddings'
import { LearningLog } from '@/types'

type Options = {
  context?: string
}

export default async function learn(learning: string, opts: Options): Promise<void> {
  if (!learning) {
    const learnings = readLearning()

    console.log('Learnings:')
    learnings.forEach((learning) => {
      console.log(`- ${learning.learning}`)
      if (learning.context) console.log(`  context: ${learning.context}`)
    })
    return
  }

  const engine = new OpenAIEmbeddings()
  const contextEmbeddings = await engine.embedDocuments([learning + opts.context])

  const learningData: LearningLog = {
    learning,
    context: opts.context,
    createdAt: new Date(),
    vectors: contextEmbeddings[0],
  }

  const logs = addToLearning(learningData)
  console.log('Lesson learned.', logs.length, 'learnings so far.')
}
