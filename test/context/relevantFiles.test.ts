import assert from 'assert'

import { combineSnippets, Snippet } from '@/context/relevantFiles'

describe('combineSnippets', () => {
  it('same file, different functions', () => {
    const snippets: Snippet[] = [
      {
        path: 'src/pages/api/drafts/run.ts:handler1#0-2',
        contents:
          'src/pages/api/drafts/run.ts:handler1#0-2\nfunction handler1() {\n  console.log("Hello");\n}',
      },
      {
        path: 'src/pages/api/drafts/run.ts:handler2#0-2',
        contents:
          'src/pages/api/drafts/run.ts:handler2#0-2\nfunction handler2() {\n  console.log("World");\n}',
      },
    ]
    const expectedResult: Snippet[] = [
      {
        path: 'src/pages/api/drafts/run.ts:handler1',
        contents:
          'src/pages/api/drafts/run.ts:handler1\nfunction handler1() {\n  console.log("Hello");\n}',
      },
      {
        path: 'src/pages/api/drafts/run.ts:handler2',
        contents:
          'src/pages/api/drafts/run.ts:handler2\nfunction handler2() {\n  console.log("World");\n}',
      },
    ]

    const result = combineSnippets(snippets)
    assert.deepEqual(result, expectedResult)
  })

  it('same file, same function, overlapping', () => {
    const snippets: Snippet[] = [
      {
        path: 'src/pages/api/drafts/run.ts:handler#0-2',
        contents:
          'src/pages/api/drafts/run.ts:handler#0-2\nfunction handler() {\n  console.log("Hello");',
      },
      {
        path: 'src/pages/api/drafts/run.ts:handler#2-3',
        contents: 'src/pages/api/drafts/run.ts:handler#2-3\n  console.log("World");\n}',
      },
    ]

    const expectedResult: Snippet[] = [
      {
        path: 'src/pages/api/drafts/run.ts:handler',
        contents:
          'src/pages/api/drafts/run.ts:handler\nfunction handler() {\n  console.log("Hello");\n  console.log("World");\n}',
      },
    ]

    const result = combineSnippets(snippets)
    assert.deepEqual(result, expectedResult)
  })

  it('same file, same function, not overlapping', () => {
    const snippets: Snippet[] = [
      {
        path: 'src/pages/api/drafts/run.ts:handler#0-1',
        contents: 'src/pages/api/drafts/run.ts:handler#0-1\nfunction handler() {',
      },
      {
        path: 'src/pages/api/drafts/run.ts:handler#3-4',
        contents: 'src/pages/api/drafts/run.ts:handler#3-4\n  console.log("World");\n}',
      },
    ]

    const expectedResult: Snippet[] = [
      {
        path: 'src/pages/api/drafts/run.ts:handler',
        contents:
          'src/pages/api/drafts/run.ts:handler\nfunction handler() {\n...\n  console.log("World");\n}',
      },
    ]

    const result = combineSnippets(snippets)
    assert.deepEqual(result, expectedResult)
  })
})
