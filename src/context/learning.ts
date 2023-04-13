import config from '@/config'
import { LearningItem, LearningLog } from '@/types'
import { findRoot } from '@/utils/utils'
import fs from 'fs'
import path from 'path'

export const LEARNING_FILE = 'learning.json'

const getPath = () => path.join(findRoot(), config.configFolder, LEARNING_FILE)

export function readLearning(): LearningLog {
  const file = getPath()
  if (!fs.existsSync(file)) {
    return { planner: [], executor: [] }
  }

  const rawData = fs.readFileSync(file, 'utf-8')
  return JSON.parse(rawData)
}

export function writeLearning(data: LearningLog): void {
  const file = getPath()
  const jsonData = JSON.stringify(data, null, 2)
  fs.writeFileSync(file, jsonData, 'utf-8')
}

export function addToLearning(type: 'planner' | 'executor', data: LearningItem): void {
  const learning = readLearning()
  learning[type].push(data)
  writeLearning(learning)
}
