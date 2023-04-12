import { stringToArgs } from '@/tools/unix'
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