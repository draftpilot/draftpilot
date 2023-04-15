import { HTMLAttributes, PropsWithChildren } from 'react'

export default function ({
  children,
  ...rest
}: PropsWithChildren<HTMLAttributes<HTMLButtonElement>>) {
  return (
    <button {...rest} className={`p-2 rounded  text-white cursor-pointer ${rest.className}`}>
      {children}
    </button>
  )
}
