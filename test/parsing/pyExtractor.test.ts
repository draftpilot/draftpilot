import { PyExtractor } from '@/parsing/pyExtractor'
import { SourceFile } from '@/types'
import assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const SAMPLE_FILE = 'sample.py'
const __dirname = 'test/parsing'

describe('pyExtractor', () => {
  it('should parse sample.py correctly', async () => {
    const sampleFilePath = path.join(__dirname, SAMPLE_FILE)
    const sampleFileContent = fs.readFileSync(sampleFilePath, 'utf-8')

    const parser = new PyExtractor()
    const content: SourceFile = { name: SAMPLE_FILE, contents: sampleFileContent }
    const result = await parser.parse(content)

    assert.equal(result.length, 5, result.map((r) => r.path).join(', '))

    assert(result[0].path.startsWith(SAMPLE_FILE + '#MyClass.__init__'))
    assert(result[1].path.startsWith(SAMPLE_FILE + '#MyClass.add'))
    assert(result[2].path.startsWith(SAMPLE_FILE + '#MyClass.subtract'))
    assert(result[3].path.startsWith(SAMPLE_FILE + '#my_function'))
    assert(result[4].path.startsWith(SAMPLE_FILE + '#main'))

    assert(result.every((doc) => doc.contents))
  })
})
