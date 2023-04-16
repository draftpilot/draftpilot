import { generateCodeTools } from '@/agent/code'
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
    ...generateCodeTools(),
    ...generateEditingTools(),
  ]
}

export function getReadOnlyTools() {
  return [...unixReadOnlyTools, ...generateCodeTools(), ...webTools]
}

export function getSimpleTools() {
  return [...unixSimpleTools, ...generateCodeTools(), ...webTools]
}
