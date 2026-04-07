'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useSearch } from '@/hooks/useSearch'
import { SearchDropdown } from './SearchDropdown'
import type { ProductCard } from '@/types/product'

interface SearchBoxProps {
  locale: string
  placeholder?: string
  className?: string
  inputClassName?: string
  autoFocus?: boolean
  /** Called when the search should close (e.g. Esc or navigate — for mobile overlay) */
  onClose?: () => void
}

export function SearchBox({
  locale,
  placeholder,
  className,
  inputClassName,
  autoFocus,
  onClose,
}: SearchBoxProps) {
  const t = useTranslations('storefront')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const {
    query, setQuery, clearQuery,
    results, total, isLoading,
    isOpen, setIsOpen,
    debouncedQuery,
    recentSearches, addRecentSearch, clearRecentSearches,
  } = useSearch(locale)

  // Reset highlighted when results change
  useEffect(() => { setHighlightedIndex(-1) }, [results, debouncedQuery])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [setIsOpen])

  // Cmd/Ctrl+K global shortcut
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [setIsOpen])

  const navigateToProduct = useCallback(
    (product: ProductCard) => {
      addRecentSearch(query)
      setIsOpen(false)
      clearQuery()
      onClose?.()
      router.push(`/${locale}/shop/${product.slug}`)
    },
    [addRecentSearch, query, setIsOpen, clearQuery, onClose, router, locale]
  )

  const navigateToResults = useCallback(
    (q?: string) => {
      const searchQuery = (q ?? query).trim()
      if (!searchQuery) return
      addRecentSearch(searchQuery)
      setIsOpen(false)
      clearQuery()
      onClose?.()
      router.push(`/${locale}/shop?q=${encodeURIComponent(searchQuery)}`)
    },
    [addRecentSearch, query, setIsOpen, clearQuery, onClose, router, locale]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          navigateToProduct(results[highlightedIndex])
        } else if (query.trim()) {
          navigateToResults()
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        inputRef.current?.blur()
        onClose?.()
        break
    }
  }

  const dropdownVisible =
    isOpen &&
    (query.length >= 2 || (!query && recentSearches.length > 0))

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input */}
      <div className="relative">
        {isLoading ? (
          <Loader2
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin pointer-events-none"
            aria-hidden="true"
          />
        ) : (
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
        )}
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t('searchPlaceholder')}
          className={cn('pl-9', query && 'pr-8', inputClassName)}
          aria-label={t('searchPlaceholder')}
          aria-autocomplete="list"
          aria-expanded={dropdownVisible}
          aria-haspopup="listbox"
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            onClick={() => { clearQuery(); inputRef.current?.focus() }}
            onMouseDown={(e) => e.preventDefault()}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
            tabIndex={-1}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown panel */}
      {dropdownVisible && (
        <div
          role="listbox"
          className="absolute top-full mt-1.5 left-0 right-0 z-50 rounded-xl border border-border bg-card shadow-lg overflow-hidden"
        >
          <SearchDropdown
            locale={locale}
            query={query}
            debouncedQuery={debouncedQuery}
            results={results}
            total={total}
            isLoading={isLoading}
            highlightedIndex={highlightedIndex}
            recentSearches={recentSearches}
            onSelectProduct={navigateToProduct}
            onSelectRecent={(q) => navigateToResults(q)}
            onClearRecent={clearRecentSearches}
            onViewAll={() => navigateToResults()}
          />
        </div>
      )}
    </div>
  )
}
