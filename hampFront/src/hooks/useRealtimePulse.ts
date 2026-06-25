import { useEffect, useState } from 'react'

export function useRealtimePulse(enabled: boolean) {
  const [pulse, setPulse] = useState(0)
  const [updatedAt, setUpdatedAt] = useState(new Date())

  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => {
      setUpdatedAt(new Date())
      setPulse((v) => v + 1)
    }, 2500)
    return () => window.clearInterval(timer)
  }, [enabled])

  return { pulse, updatedAt }
}
