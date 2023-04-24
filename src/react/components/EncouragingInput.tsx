import React, { useState, useEffect, useRef } from 'react'

const UPDATE_INTERVAL = 5_000

const EncouragingInput = ({ value }: { value: string }) => {
  const [encouragingMessage, setEncouragingMessage] = useState('')
  const lastUpdate = useRef<number>(0)

  useEffect(() => {
    if (!value || Date.now() - lastUpdate.current < UPDATE_INTERVAL) return

    const length = value.length
    const messageSet =
      length < 50
        ? [
            'Provide more details for better results',
            'The more detail the better',
            "Remember that I can't read your mind",
            'Keep writing!',
            'Please add more detail',
          ]
        : ['Keep going!', "You're doing great!", 'That looks great!', 'Anything to add?']

    const randomIndex = Math.floor(Math.random() * messageSet.length)
    setEncouragingMessage(messageSet[randomIndex])
    lastUpdate.current = Date.now()
  }, [value])

  return encouragingMessage ? (
    <div className="mt-2 text-sm text-gray-600">{encouragingMessage}</div>
  ) : null
}

export default EncouragingInput
