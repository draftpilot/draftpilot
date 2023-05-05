import assert from 'assert'

import { parseOps } from '@/utils/applyEdits'

describe('parseOps', () => {
  it('should handle input with triple backticks', () => {
    const input = `---
file: foo
start: 1
end: 3
---
\`\`\`
code here
\`\`\`
`

    const expectedOutput = [
      {
        file: 'foo',
        start: 1,
        end: 3,
        code: ['code here'],
      },
    ]

    const result = parseOps(input)
    assert.deepStrictEqual(result, expectedOutput)
  })

  it('should handle input with line numbers', () => {
    const input = `---
file: bar
start: 56
end: 58
---
56:   processFiles = async (files: string[]) => {
57:     if (!this.db) {
58:       throw new Error('db not initialized')
59:     }
`

    const expectedOutput = [
      {
        file: 'bar',
        start: 56,
        end: 58,
        code: [
          '  processFiles = async (files: string[]) => {',
          '    if (!this.db) {',
          "      throw new Error('db not initialized')",
          '    }',
        ],
      },
    ]

    const result = parseOps(input)
    assert.deepStrictEqual(result, expectedOutput)
  })

  it('should handle input with backticks and numbers', () => {
    const input = `---
file: bar
start: 56
end: 58
---
\`\`\`
56:   processFiles = async (files: string[]) => {
57:     if (!this.db) {
58:       throw new Error('db not initialized')
59:     }
\`\`\`
`

    const expectedOutput = [
      {
        file: 'bar',
        start: 56,
        end: 58,
        code: [
          '  processFiles = async (files: string[]) => {',
          '    if (!this.db) {',
          "      throw new Error('db not initialized')",
          '    }',
        ],
      },
    ]

    const result = parseOps(input)
    assert.deepStrictEqual(result, expectedOutput)
  })

  it('should handle input no backticks and numbers', () => {
    const input = `---
file: bar
start: 56
end: 58
---
  processFiles = async (files: string[]) => {
    if (!this.db) {
      throw new Error('db not initialized')
    }
`

    const expectedOutput = [
      {
        file: 'bar',
        start: 56,
        end: 58,
        code: [
          '  processFiles = async (files: string[]) => {',
          '    if (!this.db) {',
          "      throw new Error('db not initialized')",
          '    }',
        ],
      },
    ]

    const result = parseOps(input)
    assert.deepStrictEqual(result, expectedOutput)
  })
})
