import { CodebaseEditor } from '@/directors/codebaseEditor'
import { MessagePayload } from '@/types'
import assert from 'assert'

const plan = `PLAN: Append sessionId to URL and load session from URL
1. Modify \`loadSession\` to append the sessionId to the current browser URL if it doesn't already match.
2. Modify \`loadSessions\` to check if there is a sessionId in the URL, and if so, load that particular session.

---
- src/react/stores/messageStore.ts - Modify \`loadSession\` and \`loadSessions\` methods to implement the desired behavior.
- README.md - talk about how great I am.

---
confidence: high`

const payload: MessagePayload = {
  id: '123',
  message: { content: plan, role: 'assistant' },
  history: [],
}

describe('codebaseEditor', () => {
  it('should parse a plan', () => {
    const editor = new CodebaseEditor(new Set())

    const result = editor.getFilesFromPlan(plan)

    assert.deepEqual(result, ['src/react/stores/messageStore.ts', 'README.md'])
  })

  it('should parse a plan with no files', () => {
    const plan = `RESEARCH: do some research`

    const editor = new CodebaseEditor(new Set())
    const result = editor.getFilesFromPlan(plan)
    assert.deepEqual(result, [])
  })

  it('should read the requested files', () => {
    const editor = new CodebaseEditor(new Set())
    const result = editor.readFilesToEdit(payload, plan)

    assert.deepEqual(result.filesToEdit, ['README.md', 'newfile.md'])
    assert(result.fileBodies[0].includes('Draftpilot'))
    assert(result.fileBodies[1].length > 0)
  })
})
