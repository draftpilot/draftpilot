import { Indexer } from '@/db/indexer'
import { generateCodeTools } from '@/agent/code'
import { testTools } from '@/agent/commands'
import { generateEditingTools } from '@/agent/editing'
import { systemTools } from '@/agent/system'
import { unixTools } from '@/agent/unix'

export function getAllTools(indexer: Indexer) {
  return [
    ...unixTools,
    ...systemTools,
    ...testTools,
    ...generateCodeTools(indexer),
    ...generateEditingTools(indexer),
  ]
}
