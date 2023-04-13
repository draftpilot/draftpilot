import { generateCodeTools } from '@/agent/code'
import { testTools } from '@/agent/commands'
import { generateEditingTools } from '@/agent/editing'
import { systemTools } from '@/agent/system'
import { unixReadOnlyTools, unixTools } from '@/agent/unix'

export function getAllTools() {
  return [
    ...unixTools,
    ...systemTools,
    ...testTools,
    ...generateCodeTools(),
    ...generateEditingTools(),
  ]
}

export function getReadOnlyTools() {
  return [...unixReadOnlyTools, ...generateCodeTools()]
}
