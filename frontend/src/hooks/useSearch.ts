'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ProductCard } from '@/types/product'

const RECENT_SEARCHES_KEY = 'pod-store:recent-searches'
const MAX_RECENT = 5
const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export interface UseSearchReturn {
  query: string
  setQuery: (q: string) => void
  clearQuery: () => void
  results: ProductCard[]
  total: number
  isLoading: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  debouncedQuery: string
  recentSearches: string[]
  addRecentSearch: (q: string) => void
  clearRecentSearches: () => void
}

export function useSearch(locale: string): UseSearchReturn {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductCard[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS)

  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (stored) setRecentSearches(JSON.parse(stored))
    } catch (_e) { /* localStorage unavailable (SSR or private mode) */ }
  }, [])

  // Fetch on debouncedQuery change
  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      setResults([])
      setTotal(0)
      setIsLoading(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)

    fetch(
      `/api/products?q=${encodeURIComponent(debouncedQuery)}&limit=5&locale=${locale}`,
      { signal: controller.signal }
    )
      .then(r => r.json())
      .then(data => {
        if (!controller.signal.aborted) {
          setResults(data.success ? (data.items ?? []) : [])
          setTotal(data.success ? (data.total ?? 0) : 0)
          setIsLoading(false)
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setResults([])
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [debouncedQuery, locale])

  const addRecentSearch = useCallback((q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setRecentSearches(prev => {
      const next = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, MAX_RECENT)
      try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)) } catch (_e) { /* ignore */ }
      return next
    })
  }, [])

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    try { localStorage.removeItem(RECENT_SEARCHES_KEY) } catch (_e) { /* ignore */ }
  }, [])

  const clearQuery = useCallback(() => {
    setQuery('')
    setResults([])
    setTotal(0)
    abortRef.current?.abort()
  }, [])

  return {
    query, setQuery, clearQuery,
    results, total, isLoading,
    isOpen, setIsOpen,
    debouncedQuery,
    recentSearches, addRecentSearch, clearRecentSearches,
  }
}
