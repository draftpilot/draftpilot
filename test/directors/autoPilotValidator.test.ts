import assert from 'assert'

import { AutoPilotValidator } from '@/directors/autoPilotValidator'
import { CodebaseEditor } from '@/directors/codebaseEditor'
import { MessagePayload } from '@/types'

describe('autoPilotValidator', () => {
  it('should parse tsc errors', () => {
    const output =
      `src/lib/api.ts(73,1): error TS2304: Cannot find name 'editDraftRequestDescription'.
    src/lib/api.ts(77,26): error TS2532: Object is possibly 'undefined'.
    src/pages/dashboard/RepoList.tsx(118,25): error TS2322: Type '{ key: string; repo: RepoWithRequest; request: DraftRequest; onDescriptionClick: (draftId: string, currentDescription: string) => Promise<void>; }' is not assignable to type 'IntrinsicAttributes & { request: DraftRequest; repo: Repository; }'.
      Property 'onDescriptionClick' does not exist on type 'IntrinsicAttributes & { request: DraftRequest; repo: Repository; }'.
    src/pages/dashboard/RepoList.tsx(136,36): error TS2339: Property 'editDraftRequestDescription' does not exist on type 'APIService'.
    src/pages/dashboard/RepoList.tsx(137,15): error TS2551: Property 'updateDraftRequest' does not exist on type 'RepoStore'. Did you mean 'draftRequests'?`.split(
        '\n'
      )

    const apv = new AutoPilotValidator()
    const files = apv.parseTSCOutput(output)

    assert.deepEqual(files, ['src/lib/api.ts', 'src/pages/dashboard/RepoList.tsx'])
  })

  it('should parse empty file', () => {
    const output = ['']

    const apv = new AutoPilotValidator()
    const files = apv.parseTSCOutput(output)

    assert.deepEqual(files, [])
  })
})
