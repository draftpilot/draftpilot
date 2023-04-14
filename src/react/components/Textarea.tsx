import { useRef, useState } from 'react'
import ReactTextareaAutocomplete from '@webscopeio/react-textarea-autocomplete'

type Props = {
  innerRef: React.MutableRefObject<HTMLTextAreaElement | null>
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>

export default (props: Props) => {
  const { innerRef, ...rest } = props

  const loadingComponent = () => <div>Loading...</div>

  const trigger = {}

  return (
    <ReactTextareaAutocomplete
      containerClassName="flex-1"
      autoFocus
      placeholder='Type "/" to reference a file or folder'
      trigger={trigger}
      loadingComponent={loadingComponent}
      innerRef={
        innerRef ? (textarea: HTMLTextAreaElement) => (innerRef.current = textarea) : undefined
      }
      {...rest}
    />
  )
}
