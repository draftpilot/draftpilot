import { TSExtractor } from '@/parsing/tsExtractor'
import { SourceFile } from '@/types'
import assert from 'assert'

// generate a long function
const longFunc = '0+'.repeat(100) + '0'

describe('tsExtractor', () => {
  it('should parse arrows in classes ok', async () => {
    const file = `
class MyClass {
  add = (a: number, b: number) => ${longFunc}
}`

    const parser = new TSExtractor()
    const content: SourceFile = { name: 'file', contents: file }
    const result = await parser.parse(content)

    assert.equal(result[0].path, 'file:MyClass.add#0-1')
  })
})
