import { codeTools } from '@/agent/code'
import { testTools } from '@/agent/commands'
import { generateEditingTools } from '@/agent/editing'
import { systemTools } from '@/agent/system'
import { unixReadOnlyTools, unixSimpleTools, unixTools } from '@/agent/unix'
import { webTools } from '@/agent/web'

export function getAllTools() {
  return [
    ...unixTools,
    ...systemTools,
    ...testTools,
    ...webTools,
    ...codeTools,
    ...generateEditingTools(),
  ]
}

export function getReadOnlyTools() {
  return [...unixReadOnlyTools, ...codeTools, ...webTools]
}

export function getSimpleTools() {
  return [...unixSimpleTools, ...codeTools, ...webTools]
}
