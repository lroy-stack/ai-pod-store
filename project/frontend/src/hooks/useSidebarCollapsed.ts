'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'pod-sidebar-collapsed'

export function useSidebarCollapsed() {
  const [isCollapsed, setIsCollapsed] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) setIsCollapsed(stored === 'true')
  }, [])

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  return { isCollapsed, toggle }
}
