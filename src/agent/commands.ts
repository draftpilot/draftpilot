import fs from 'fs'

import { Tool } from '@/agent/tool'
import { spawnPromise } from '@/agent/unix'
import { readConfig } from '@/context/projectConfig'

const runTestsTool: Tool = {
  name: 'test',
  description: 'Run tests. Optional input: single test to run',

  run: (input: string) => {
    const npmCommand = 'npm' // todo
    const args = input ? ['test', input] : ['test']
    return spawnPromise(npmCommand, args)
  },
}

const compileTool: Tool = {
  name: 'tsc',
  description: 'Run typescript compiler.',

  run: (input: string) => {
    const npmCommand = 'npm' // todo
    return spawnPromise(npmCommand, ['tsc'])
  },
}

export const testTools = [runTestsTool, compileTool]
