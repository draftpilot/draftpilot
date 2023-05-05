import { stringToArgs, unixTools } from '@/agent/unix'
import assert from 'assert'

describe('stringToArgs', () => {
  it('should split a string into arguments', () => {
    const input = 'command -a --flag "arg with spaces" \'another arg with spaces\''
    const expected = ['command', '-a', '--flag', 'arg with spaces', 'another arg with spaces']
    assert.deepStrictEqual(stringToArgs(input), expected)
  })

  it('should handle escaped quotes', () => {
    const input = 'command "arg with \\"quotes\\"" \'arg with \\\'quotes\\\'\''
    const expected = ['command', 'arg with "quotes"', "arg with 'quotes'"]
    assert.deepStrictEqual(stringToArgs(input), expected)
  })

  it('should handle empty arguments', () => {
    const input = 'command "" \'\''
    const expected = ['command', '', '']
    assert.deepStrictEqual(stringToArgs(input), expected)
  })

  it('should handle trailing spaces', () => {
    const input = 'command -a --flag '
    const expected = ['command', '-a', '--flag']
    assert.deepStrictEqual(stringToArgs(input), expected)
  })
})

const THIS_FILE = 'unixTools.test.ts'

describe('findInsideFiles', () => {
  it('should run without command line flags', async () => {
    const tool = unixTools.find((t) => t.name === 'findInsideFiles')!

    const results = await Promise.all([tool.run('Lunchclub', '')])
    results.forEach((r) => assert(r.includes(THIS_FILE), 'result: ' + r))
  })
  it('should run with command line flags and find stuff', async () => {
    const tool = unixTools.find((t) => t.name === 'findInsideFiles')!

    const results = await Promise.all([
      tool.run('-r "Lunchclub" .', ''),
      tool.run('-r "Lunchclub" *', ''),
    ])
    results.forEach((r) => assert(r.includes(THIS_FILE), 'result: ' + r))
  })
})

describe('findFileNames', () => {
  it('should run without command line flags and find stuff', async () => {
    const tool = unixTools.find((t) => t.name === 'findFileNames')!

    const results = await Promise.all([tool.run('**/*.test.ts', ''), tool.run('*.test.ts', '')])
    results.forEach((r) => assert(r.includes(THIS_FILE), 'result: ' + r))
  })
})
