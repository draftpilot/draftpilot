import { importFixer, extractImports, clearImportsMap } from '../../src/utils/importFixer'
import * as assert from 'assert'

describe('importFixer', () => {
  afterEach(() => {
    clearImportsMap()
  })

  it('should extract absolute imports', () => {
    const content = `import React from 'react';\nimport { useState } from 'react';`
    extractImports(content)
    const result = importFixer(`import React from 'react';`)
    assert.strictEqual(result, `import React from 'react';`)
  })

  it('should convert relative imports to absolute imports', () => {
    const content = `import React from 'react';\nimport { useState } from 'react';`
    extractImports(content)
    const result = importFixer(`import { useState } from './relative/path';`)
    assert.strictEqual(result, `import { useState } from 'react';`)
  })

  it('should support require()', () => {
    const content = `const React = require('react');\nconst { useState } = require('react');`
    extractImports(content)
    const result = importFixer(`const { useState } = require('./relative/path');`)
    assert.strictEqual(result, `const { useState } = require('react');`)
  })
})
