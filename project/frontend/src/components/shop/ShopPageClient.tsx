'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductGrid } from '@/components/products/ProductGrid'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { cn } from '@/lib/utils'

type SortOption = 'featured' | 'priceLowToHigh' | 'priceHighToLow' | 'newest' | 'topRated'

interface Product {
  id: string
  title: string
  description: string
  price: number
  currency: string
  image: string
  rating: number
  reviewCount: number
  category: string
  inStock: boolean
  createdAt: string
  variants?: {
    sizes?: string[]
    colors?: string[]
    colorImages?: Record<string, string>
  }
}

interface ShopPageClientProps {
  locale: string
  initialProducts: Product[]
  initialTotal: number
  initialCategories: string[]
  initialCategoryCounts: Record<string, number>
  searchQuery?: string
  category?: string
  sort?: SortOption
}

const PRODUCTS_PER_PAGE = 20

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
  initialCategories,
  initialCategoryCounts,
  searchQuery: initialSearchQuery = '',
  category: initialCategory = 'all',
  sort: initialSort = 'featured',
}: ShopPageClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useTranslations('shop')

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory)
  const [sortBy, setSortBy] = useState<SortOption>(initialSort)
  const [showNewArrivals, setShowNewArrivals] = useState(searchParams.get('newArrivals') === 'true')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [totalProducts, setTotalProducts] = useState(initialTotal)
  const [categories] = useState<string[]>(initialCategories)
  const [categoryCounts] = useState<Record<string, number>>(initialCategoryCounts)

  // Collapsible category chips — show first VISIBLE_COUNT, expand with "+N" button
  const VISIBLE_COUNT = 6
  const [showAllCategories, setShowAllCategories] = useState(false)
  const visibleCategories = showAllCategories ? categories : categories.slice(0, VISIBLE_COUNT)
  const hiddenCount = categories.length - VISIBLE_COUNT

  // Sync state from URL when searchParams change (e.g. sidebar navigation)
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '')
    setSelectedCategory(searchParams.get('category') || 'all')
    const s = searchParams.get('sort') as SortOption | null
    setSortBy(s && s in sortMap ? s : 'featured')
    setShowNewArrivals(searchParams.get('newArrivals') === 'true')
    setCurrentPage(1)
  }, [searchParams])

  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      const urlParams = new URLSearchParams()
      urlParams.set('page', currentPage.toString())
      urlParams.set('limit', PRODUCTS_PER_PAGE.toString())
      urlParams.set('locale', locale)
      if (selectedCategory !== 'all') urlParams.set('category', selectedCategory)
      if (searchQuery.trim()) urlParams.set('q', searchQuery.trim())
      if (showNewArrivals) urlParams.set('newArrivals', 'true')
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
  }, [currentPage, locale, selectedCategory, searchQuery, sortBy, showNewArrivals])

  // Fetch products when filters change
  useEffect(() => {
    // Skip initial fetch since we have server-side data
    if (currentPage !== 1 || selectedCategory !== initialCategory || searchQuery !== initialSearchQuery || sortBy !== initialSort) {
      fetchProducts()
    }
  }, [fetchProducts, currentPage, selectedCategory, searchQuery, sortBy, initialCategory, initialSearchQuery, initialSort])

  const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE)

  const getCategoryCount = (category: string) => categoryCounts[category] ?? 0

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setCurrentPage(1)
  }

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    setCurrentPage(1)
  }

  const handleSortChange = (value: SortOption) => {
    setSortBy(value)
    setCurrentPage(1)
  }

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('subtitle')}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {t('totalProducts', { count: totalProducts })}
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="mb-8">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 -translate-y-1/2 size-8"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Category Filters and Sort */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        {/* Collapsible category chips */}
        <div className="flex flex-wrap gap-1.5">
          {visibleCategories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              className="rounded-full"
              onClick={() => handleCategoryChange(category)}
            >
              {t.has(`category.${category}`) ? t(`category.${category}`) : category.charAt(0).toUpperCase() + category.slice(1)}
              <span className="ml-1 opacity-60">{getCategoryCount(category)}</span>
            </Button>
          ))}
          {hiddenCount > 0 && !showAllCategories && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-dashed"
              onClick={() => setShowAllCategories(true)}
            >
              +{hiddenCount}
            </Button>
          )}
          {showAllCategories && hiddenCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full size-8"
              onClick={() => setShowAllCategories(false)}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="sort" className="text-sm font-medium whitespace-nowrap">
            {t('sortBy')}:
          </label>
          <Select value={sortBy} onValueChange={(value) => handleSortChange(value as SortOption)}>
            <SelectTrigger id="sort" className="w-[200px]">
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

      {/* Results count */}
      {(searchQuery || selectedCategory !== 'all') && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {searchQuery
              ? t('searchResults', { count: totalProducts, query: searchQuery })
              : t('categoryResults', { count: totalProducts })}
          </p>
        </div>
      )}

      <ProductGrid
        products={products}
        isLoading={isLoading}
        emptyMessage={
          searchQuery
            ? t('noResults', { query: searchQuery })
            : selectedCategory !== 'all'
              ? t('noCategoryResults', { category: t(`category.${selectedCategory}`) })
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
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
            ))}
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

    </div>
  )
}
