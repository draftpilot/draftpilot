import { Tool } from '@/tools/tool'
import { spawnPromise } from '@/tools/unix'
import fs from 'fs'

const runTestsTool: Tool = {
  name: 'test',
  description: 'Run tests. Optional input: single test to run',

  run: (input: string) => {
    const npmCommand = fs.existsSync('yarn.lock') ? 'yarn' : 'npm'
    const args = input ? ['test', input] : ['test']
    return spawnPromise(npmCommand, args)
  },
}

const compileTool: Tool = {
  name: 'tsc',
  description: 'Run typescript compiler.',

  run: (input: string) => {
    const npmCommand = fs.existsSync('yarn.lock') ? 'yarn' : 'npm'
    return spawnPromise(npmCommand, ['tsc'])
  },
}

export const testTools = [runTestsTool, compileTool]
