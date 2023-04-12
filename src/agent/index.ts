import { Indexer } from '@/db/indexer'
import { generateCodeTools } from '@/agent/code'
import { testTools } from '@/agent/commands'
import { generateEditingTools } from '@/agent/editing'
import { systemTools } from '@/agent/system'
import { unixReadOnlyTools, unixTools } from '@/agent/unix'

export function getAllTools(indexer: Indexer) {
  return [
    ...unixTools,
    ...systemTools,
    ...testTools,
    ...generateCodeTools(indexer),
    ...generateEditingTools(indexer),
  ]
}

export function getReadOnlyTools(indexer: Indexer) {
  return [...unixReadOnlyTools, ...systemTools, ...generateCodeTools(indexer)]
}
