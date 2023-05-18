import { codeTools } from '@/agent/code'
import { systemTools } from '@/agent/system'
import { unixReadOnlyTools, unixSimpleTools, unixTools } from '@/agent/unix'
import { webTools } from '@/agent/web'

export function getAllTools() {
  return [...unixTools, ...systemTools, ...webTools, ...codeTools]
}

export function getReadOnlyTools() {
  return [...unixReadOnlyTools, ...codeTools, ...webTools]
}

export function getSimpleTools() {
  return [...unixSimpleTools, ...codeTools, ...webTools]
}
