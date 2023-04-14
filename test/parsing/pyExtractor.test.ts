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

    assert.equal(result[0].path, SAMPLE_FILE + '#MyClass.__init__')
    assert.equal(result[1].path, SAMPLE_FILE + '#MyClass.add')
    assert.equal(result[2].path, SAMPLE_FILE + '#MyClass.subtract')
    assert.equal(result[3].path, SAMPLE_FILE + '#my_function')
    assert.equal(result[4].path, SAMPLE_FILE + '#main')

    assert(result.every((doc) => doc.contents))
  })
})
