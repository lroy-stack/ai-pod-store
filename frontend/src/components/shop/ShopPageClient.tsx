'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { ProductGrid } from '@/components/products/ProductGrid'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { TrustBar } from '@/components/landing/TrustBar'

import { cn } from '@/lib/utils'
import type { ProductCard } from '@/types/product'

type SortOption = 'featured' | 'priceLowToHigh' | 'priceHighToLow' | 'newest' | 'topRated'

interface ShopPageClientProps {
  locale: string
  initialProducts: ProductCard[]
  initialTotal: number
  searchQuery?: string
  sort?: SortOption
  /** Category slug for client-side refetch (preserves filter on sort/page change) */
  categorySlug?: string
}

const PRODUCTS_PER_PAGE = 20

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

// Map frontend sort keys to API sort params
const sortMap: Record<SortOption, string | undefined> = {
  featured: undefined,
  priceLowToHigh: 'priceLowToHigh',
  priceHighToLow: 'priceHighToLow',
  newest: 'newest',
  topRated: 'topRated',
}

export function ShopPageClient({
  locale,
  initialProducts,
  initialTotal,
  searchQuery: initialSearchQuery = '',
  sort: initialSort = 'featured',
  categorySlug,
}: ShopPageClientProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const t = useTranslations('shop')

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [sortBy, setSortBy] = useState<SortOption>(initialSort)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [products, setProducts] = useState<ProductCard[]>(initialProducts)
  const [totalProducts, setTotalProducts] = useState(initialTotal)

  // Skip initial re-fetch since SSR already provided data
  const isInitialMount = useRef(true)

  // Sync state from URL when searchParams change
  useEffect(() => {
    const q = searchParams.get('q') || ''
    setSearchQuery(q)
    const s = searchParams.get('sort') as SortOption | null
    setSortBy(s && s in sortMap ? s : 'featured')
    setCurrentPage(1)
  }, [searchParams])

  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      const urlParams = new URLSearchParams()
      urlParams.set('page', currentPage.toString())
      urlParams.set('limit', PRODUCTS_PER_PAGE.toString())
      urlParams.set('locale', locale)
      if (categorySlug) urlParams.set('category', categorySlug)
      if (searchQuery.trim()) urlParams.set('q', searchQuery.trim())
      const sortParam = sortMap[sortBy]
      if (sortParam) urlParams.set('sort', sortParam)

      const res = await fetch(`/api/products?${urlParams.toString()}`, { cache: 'no-store' })
      const data = await res.json()

      if (data.success) {
        setProducts(data.items || [])
        setTotalProducts(data.total || 0)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, locale, categorySlug, searchQuery, sortBy])

  // Fetch products when filters change (skip initial mount — SSR data already present)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    fetchProducts()
  }, [fetchProducts])

  const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE)

  const handleSortChange = (value: SortOption) => {
    // Update state immediately (instant UI response)
    setSortBy(value)
    setCurrentPage(1)
    // Sync URL without Next.js navigation — history.replaceState skips server re-render
    // and does NOT trigger useSearchParams(), so no double fetch
    const params = new URLSearchParams(window.location.search)
    if (value === 'featured') params.delete('sort')
    else params.set('sort', value)
    const qs = params.toString()
    window.history.replaceState(null, '', `${pathname}${qs ? `?${qs}` : ''}`)
  }

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <div className="container mx-auto max-w-7xl px-4 py-6">
      {/* Toolbar: results count + sort */}
      <div className="mt-4 mb-6 flex items-center justify-between">
        {searchQuery ? (
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {t('searchResults', { count: totalProducts, query: searchQuery })}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setCurrentPage(1)
                const params = new URLSearchParams(window.location.search)
                params.delete('q')
                const qs = params.toString()
                window.history.replaceState(null, '', `${pathname}${qs ? `?${qs}` : ''}`)
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-2 py-0.5 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
              {searchQuery}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('productsCount', { count: totalProducts })}
          </p>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="sort" className="hidden md:block text-xs font-medium uppercase tracking-widest text-muted-foreground whitespace-nowrap">
            {t('sortBy')}:
          </label>
          <Select value={sortBy} onValueChange={(value) => handleSortChange(value as SortOption)}>
            <SelectTrigger id="sort" className="w-[140px] md:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">{t('sort.featured')}</SelectItem>
              <SelectItem value="priceLowToHigh">{t('sort.priceLowToHigh')}</SelectItem>
              <SelectItem value="priceHighToLow">{t('sort.priceHighToLow')}</SelectItem>
              <SelectItem value="newest">{t('sort.newest')}</SelectItem>
              <SelectItem value="topRated">{t('sort.topRated')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Product Grid */}
      <ProductGrid
        products={products}
        isLoading={isLoading}
        emptyMessage={
          searchQuery
            ? t('noResults', { query: searchQuery })
            : t('noProducts')
        }
        skeletonCount={PRODUCTS_PER_PAGE}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="flex gap-1">
            {getPageNumbers(currentPage, totalPages).map((page, idx) =>
              page === '...' ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="size-10 flex items-center justify-center text-muted-foreground"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => goToPage(page)}
                  className={cn(
                    'size-10',
                    currentPage === page && 'bg-primary text-primary-foreground'
                  )}
                >
                  {page}
                </Button>
              )
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* Trust Bar */}
      <Separator className="mt-12" />
      <TrustBar />
    </div>
    </>
  )
}
