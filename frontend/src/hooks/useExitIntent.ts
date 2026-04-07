'use client'

import { useEffect, useState } from 'react'

const SESSION_KEY = 'pod_exit_intent_shown'

/**
 * Detects exit intent on desktop (mouse leaving toward browser chrome).
 * Shows only once per session via sessionStorage flag.
 */
export function useExitIntent() {
  const [triggered, setTriggered] = useState(false)

  useEffect(() => {
    // Skip if already shown this session
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return
    } catch { /* ignore */ }

    // Only on desktop (no touch)
    if ('ontouchstart' in window) return

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY < 10) {
        setTriggered(true)
        try {
          sessionStorage.setItem(SESSION_KEY, '1')
        } catch { /* ignore */ }
        document.removeEventListener('mouseleave', handleMouseLeave)
      }
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    return () => document.removeEventListener('mouseleave', handleMouseLeave)
  }, [])

  const dismiss = () => setTriggered(false)

  return { triggered, dismiss }
}
