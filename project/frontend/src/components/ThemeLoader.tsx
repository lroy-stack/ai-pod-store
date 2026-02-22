'use client'

import { useEffect } from 'react'
import { loadActiveTheme } from '@/lib/theme-loader'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

/**
 * Client-side theme polling.
 * Initial theme is injected server-side in layout.tsx (zero FOUC).
 * This component periodically refreshes the theme to detect admin changes.
 */
export function ThemeLoader() {
  useEffect(() => {
    // Initial client-side load to replace server-injected style with dynamic one
    loadActiveTheme().catch(() => {})

    const interval = setInterval(() => {
      loadActiveTheme().catch(() => {})
    }, POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [])

  return null
}
