import Button from '@/react/components/Button'
import uiStore from '@/react/stores/uiStore'
import React, { useState } from 'react'

const NO_CONTEXT_TEXT = `Please write a few sentences about your project to help your completions be more relevant.

For example: the frontend uses react and tailwindcss and lives in src/react. The backend uses express and postgres.`

const ContextEditor: React.FC = () => {
  const [context, setContext] = useState(uiStore.projectContext.get() || '')

  const handleSave = () => {
    // Save logic here
    uiStore.saveProjectContext(context)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Project Context</h1>
      <p className="mb-4">
        Add anything you want the AI to know - where to find certain files, how to make certain
        changes, etc. Especially for areas where your project is unusual, add some helpful context,
        like how to use the API for any specialized packages.
      </p>
      <textarea
        className="w-full h-64 p-4"
        value={context}
        placeholder={NO_CONTEXT_TEXT}
        onChange={(e) => setContext(e.target.value)}
      />
      <Button className="bg-blue-500 mt-4" onClick={handleSave}>
        Save
      </Button>
    </div>
  )
}

export default ContextEditor
