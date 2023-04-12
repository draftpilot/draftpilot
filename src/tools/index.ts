import { Indexer } from '@/db/indexer'
import { generateCodeTools } from '@/tools/code'
import { testTools } from '@/tools/commands'
import { generateEditingTools } from '@/tools/editing'
import { systemTools } from '@/tools/system'
import { unixTools } from '@/tools/unix'

export function getAllTools(indexer: Indexer) {
  return [
    ...unixTools,
    ...systemTools,
    ...testTools,
    ...generateCodeTools(indexer),
    ...generateEditingTools(indexer),
  ]
}
