import React, { useState, useEffect, HTMLAttributes, useRef } from 'react'

const ProgressBar = ({
  duration,
  ...rest
}: { duration: number } & HTMLAttributes<HTMLDivElement>) => {
  const [progress, setProgress] = useState(0)
  const start = useRef(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      const progress = (Date.now() - start.current) / duration
      setProgress(Math.min(progress, 1))
      if (progress >= 1) clearInterval(interval)
    }, 50)

    return () => clearInterval(interval)
  }, [duration])

  const progressPercentage = progress * 100

  return (
    <div {...rest} className={'relative h-2 rounded-full bg-gray-200 w-full ' + rest.className}>
      <div
        className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
        style={{ width: `${progressPercentage}%` }}
      />
    </div>
  )
}

export default ProgressBar
