'use client'

import { useEffect } from 'react'
import { loadActiveTheme } from '@/lib/theme-loader'

export function ThemeLoader() {
  useEffect(() => {
    loadActiveTheme().catch(() => {
      // Silently fail — defaults from globals.css remain active
    })
  }, [])

  return null
}
