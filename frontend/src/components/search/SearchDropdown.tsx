import { Clock, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Separator } from '@/components/ui/separator'
import { SearchResultItem } from './SearchResultItem'
import type { ProductCard } from '@/types/product'

interface SearchDropdownProps {
  locale: string
  query: string
  debouncedQuery: string
  results: ProductCard[]
  total: number
  isLoading: boolean
  highlightedIndex: number
  recentSearches: string[]
  onSelectProduct: (product: ProductCard) => void
  onSelectRecent: (q: string) => void
  onClearRecent: () => void
  onViewAll: () => void
}

function SearchSkeleton() {
  return (
    <div className="space-y-0.5 p-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <div className="h-12 w-12 rounded-lg bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-muted animate-pulse rounded-full w-3/4" />
            <div className="h-3 bg-muted animate-pulse rounded-full w-1/3" />
          </div>
          <div className="h-4 w-14 bg-muted animate-pulse rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function SearchDropdown({
  locale,
  query,
  debouncedQuery,
  results,
  total,
  isLoading,
  highlightedIndex,
  recentSearches,
  onSelectProduct,
  onSelectRecent,
  onClearRecent,
  onViewAll,
}: SearchDropdownProps) {
  const t = useTranslations('storefront')

  const showRecent = !query && recentSearches.length > 0
  // Show skeleton only when loading with no previous results
  const showSkeleton = query.length >= 2 && isLoading && results.length === 0
  const showResults = results.length > 0
  const showEmpty = debouncedQuery.length >= 2 && !isLoading && results.length === 0

  if (!showRecent && !showSkeleton && !showResults && !showEmpty) return null

  return (
    <>
      {/* Recent Searches */}
      {showRecent && (
        <div>
          <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t('searchRecent')}
            </span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClearRecent}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('searchClearRecent')}
            </button>
          </div>
          <div className="pb-2">
            {recentSearches.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelectRecent(s)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-accent/50 transition-colors"
              >
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-foreground">{s}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {showSkeleton && <SearchSkeleton />}

      {/* Results — shown even while re-loading (spinner in input handles feedback) */}
      {showResults && (
        <div className="py-1">
          {results.map((product, i) => (
            <SearchResultItem
              key={product.id}
              product={product}
              highlighted={highlightedIndex === i}
              locale={locale}
              onClick={() => onSelectProduct(product)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {showEmpty && (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {t('searchNoResults', { query: debouncedQuery })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('searchNoResultsHint')}
          </p>
        </div>
      )}

      {/* Footer: View All Results */}
      {showResults && (
        <>
          <Separator />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onViewAll}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-primary hover:bg-accent/50 transition-colors font-medium"
          >
            <span>{t('searchViewAll', { count: total, query: debouncedQuery })}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        </>
      )}
    </>
  )
}
