import { useRef, useState } from 'react'
import ReactTextareaAutocomplete from '@webscopeio/react-textarea-autocomplete'

export default () => {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  const loadingComponent = () => <div>Loading...</div>

  const trigger = {}

  return (
    <ReactTextareaAutocomplete
      autoFocus
      className="w-full p-4 shadow-md rounded"
      placeholder='Type "/" to see the list of commands'
      trigger={trigger}
      loadingComponent={loadingComponent}
      innerRef={(textarea) => (ref.current = textarea)}
    />
  )
}
