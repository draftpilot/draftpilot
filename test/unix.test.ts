import { stringToArgs, unixTools } from '@/tools/unix'
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

describe('grep', () => {
  it('should run with command line flags and find stuff', async () => {
    const grepTool = unixTools.find((t) => t.name === 'grep')!

    const results = await Promise.all([
      grepTool.run('-r "Lunchclub" .'),
      grepTool.run('-r "Lunchclub" *'),
    ])
    results.forEach((r) => assert(r.includes('test/unix.test.ts'), r))
  })
})
