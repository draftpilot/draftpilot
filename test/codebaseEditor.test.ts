import { CodebaseEditor } from '@/directors/codebaseEditor'
import assert from 'assert'

describe('codebaseEditor', () => {
  it('should parse a plan', () => {
    const plan = `PLAN: Append sessionId to URL and load session from URL
  1. Modify \`loadSession\` to append the sessionId to the current browser URL if it doesn't already match.
  2. Modify \`loadSessions\` to check if there is a sessionId in the URL, and if so, load that particular session.
  
  ---
  - src/react/stores/messageStore.ts - Modify \`loadSession\` and \`loadSessions\` methods to implement the desired behavior.
  - src/react/components/Sidebar.tsx - Call \`loadSessions\` in the \`useEffect\` hook to load the session from the URL when the component mounts.
  
  ---
  confidence: high`

    const editor = new CodebaseEditor(new Set())

    const result = editor.getFilesFromPlan(plan)

    assert.deepEqual(result, [
      'src/react/stores/messageStore.ts',
      'src/react/components/Sidebar.tsx',
    ])
  })
})
