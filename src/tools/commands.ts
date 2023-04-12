import { Tool } from '@/tools/tool'
import { spawnPromise } from '@/tools/unix'

const runTestsTool: Tool = {
  name: 'test',
  description: 'Run tests. Optional input: single test to run',

  run: (input: string) => {
    const args = input ? ['test', input] : ['test']
    return spawnPromise('yarn', args)
  },
}

export const testTools = [runTestsTool]
