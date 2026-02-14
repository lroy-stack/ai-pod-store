'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductGrid } from '@/components/products/ProductGrid'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
}

const PRODUCTS_PER_PAGE = 8

// Map frontend sort keys to API sort params
const sortMap: Record<SortOption, string | undefined> = {
  featured: undefined,
  priceLowToHigh: 'priceLowToHigh',
  priceHighToLow: 'priceHighToLow',
  newest: 'newest',
  topRated: 'topRated',
}

export default function ShopPage() {
  const t = useTranslations('shop')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('featured')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [totalProducts, setTotalProducts] = useState(0)
  const [categories, setCategories] = useState<string[]>(['all'])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})

  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', currentPage.toString())
      params.set('limit', PRODUCTS_PER_PAGE.toString())
      if (selectedCategory !== 'all') params.set('category', selectedCategory)
      if (searchQuery.trim()) params.set('q', searchQuery.trim())
      const sortParam = sortMap[sortBy]
      if (sortParam) params.set('sort', sortParam)

      const res = await fetch(`/api/products?${params.toString()}`)
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
  }, [currentPage, selectedCategory, searchQuery, sortBy])

  // Fetch all products once to extract categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/products?limit=100')
        const data = await res.json()
        if (data.success && data.items) {
          const counts: Record<string, number> = {}
          for (const p of data.items as Product[]) {
            counts[p.category] = (counts[p.category] || 0) + 1
          }
          const cats = Object.keys(counts)
          setCategories(['all', ...cats])
          setCategoryCounts({ all: data.items.length, ...counts })
        }
      } catch (error) {
        console.error('Error fetching categories:', error)
      }
    }
    fetchCategories()
  }, [])

  // Fetch products when filters change
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE)

  const getCategoryCount = (category: string) => categoryCounts[category] ?? 0

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchProducts()
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
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Badge
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer px-4 py-2 text-sm transition-colors',
                selectedCategory === category
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'hover:bg-muted'
              )}
              onClick={() => handleCategoryChange(category)}
            >
              {t(`category.${category}`)} ({getCategoryCount(category)})
            </Badge>
          ))}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2">
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
