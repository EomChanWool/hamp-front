// src/hooks/useColorMode.ts
import { useEffect, useState } from 'react'

export function useColorMode(): 'dark' | 'light' {
  const getMode = () =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'

  const [mode, setMode] = useState<'dark' | 'light'>(getMode)

  useEffect(() => {
    const obs = new MutationObserver(() => setMode(getMode()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  return mode
}