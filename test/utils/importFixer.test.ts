import * as assert from 'assert'

import { clearImportsMap, extractImports, importFixer } from '../../src/utils/importFixer'

describe('importFixer', () => {
  afterEach(() => {
    clearImportsMap()
  })

  it('should extract absolute imports', () => {
    const content = `import React from 'react';\nimport { useState } from 'react';`
    const map = extractImports(content)

    assert.strictEqual(map.size, 2)
    assert.strictEqual(map.get('import React'), `import React from 'react';`)
  })

  it('should convert relative imports to absolute imports', () => {
    const content = `import React from 'react';\nimport { fooBar } from '@/fooBar';`
    extractImports(content)
    const result = importFixer(`import { fooBar } from './relative/path';`)
    assert.strictEqual(result, `import { fooBar } from '@/fooBar';`)
  })

  it('should support require()', () => {
    const content = `const React = require('react');\nconst { fooBar } = require('@/fooBar');`
    extractImports(content)
    const result = importFixer(`const { fooBar } = require('./relative/path');`)
    assert.strictEqual(result, `const { fooBar } = require('@/fooBar');`)
  })
})
