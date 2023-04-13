import { Tool } from '@/agent/tool'
import { spawnPromise } from '@/agent/unix'
import { readConfig } from '@/context/projectConfig'
import fs from 'fs'

const runTestsTool: Tool = {
  name: 'test',
  description: 'Run tests. Optional input: single test to run',

  run: (input: string) => {
    const config = readConfig()
    const npmCommand = config?.packageManager || 'fail'
    const args = input ? ['test', input] : ['test']
    return spawnPromise(npmCommand, args)
  },
}

const compileTool: Tool = {
  name: 'tsc',
  description: 'Run typescript compiler.',

  run: (input: string) => {
    const config = readConfig()
    const npmCommand = config?.packageManager || 'fail'
    return spawnPromise(npmCommand, ['tsc'])
  },
}

export const testTools = [runTestsTool, compileTool]
