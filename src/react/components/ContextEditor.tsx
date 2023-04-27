import { API } from '@/react/api/api'
import Button from '@/react/components/Button'
import uiStore from '@/react/stores/uiStore'
import { ChatMessage, Intent } from '@/types'
import { generateUUID } from '@/utils/utils'
import { useStore } from '@nanostores/react'
import React, { useEffect, useState } from 'react'

const NO_CONTEXT_TEXT = `Please write a few sentences about your project to help your completions be more relevant.

For example: the frontend uses react and tailwindcss and lives in src/react. The backend uses express and postgres.`

const ContextEditor: React.FC = () => {
  const [context, setContext] = useState(uiStore.projectContext.get() || '')
  const [saved, setSaved] = useState(false)
  const [inferringContext, setInferringContext] = useState<string | false>(false)
  const onboarding = useStore(uiStore.onboarding)

  const handleSave = () => {
    setSaved(true)
    uiStore.saveProjectContext(context)

    setTimeout(() => {
      setSaved(false)
      if (!onboarding) uiStore.editingProjectContext.set(false)
    }, 3000)
  }

  useEffect(() => {
    if (onboarding) {
      setInferringContext('')
      const message: ChatMessage = {
        content: 'infer-project-context',
        role: 'user',
        intent: Intent.GEN_CONTEXT,
      }
      const payload = { id: generateUUID(), message, history: [] }
      API.sendMessage(payload, (response) => {
        if (typeof response == 'string') {
          setInferringContext((ctx) => (ctx || '') + response)
        } else {
          setInferringContext(false)
          handleSave()
        }
      })
    }
  }, [onboarding])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Project Context</h1>
      <p className="mb-4">
        Add anything you want the AI to know - where to find certain files, how to make certain
        changes, etc. Especially for areas where your project is unusual, add some helpful context,
        like how to use the API for any specialized packages.
      </p>
      {inferringContext && (
        <div className="bg-yellow-100 p-4 rounded-md mb-4">
          We're inferring your project context from your files...
        </div>
      )}
      <textarea
        className="w-full h-64 p-4 bg-gray-100 rounded-md -mx-4"
        value={inferringContext ? inferringContext : context}
        placeholder={NO_CONTEXT_TEXT}
        onChange={(e) => setContext(e.target.value)}
      />
      <Button className="bg-blue-500 mt-4" onClick={handleSave}>
        {saved ? 'Saved.' : 'Save'}
      </Button>
    </div>
  )
}

export default ContextEditor
