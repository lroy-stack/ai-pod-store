'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductGrid } from '@/components/products/ProductGrid'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Mock products for now - will be replaced with API call
const mockProducts = [
  {
    id: '1',
    title: 'Classic T-Shirt',
    description: 'Comfortable cotton t-shirt',
    price: 24.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/3b82f6/ffffff?text=T-Shirt',
    rating: 4.5,
    reviewCount: 128,
    category: 'apparel',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    title: 'Hoodie',
    description: 'Cozy fleece hoodie',
    price: 49.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/8b5cf6/ffffff?text=Hoodie',
    rating: 4.8,
    reviewCount: 94,
    category: 'apparel',
    createdAt: '2024-02-20T10:00:00Z',
  },
  {
    id: '3',
    title: 'Mug',
    description: 'Ceramic coffee mug',
    price: 14.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/10b981/ffffff?text=Mug',
    rating: 4.3,
    reviewCount: 256,
    category: 'home',
    createdAt: '2024-01-10T10:00:00Z',
  },
  {
    id: '4',
    title: 'Poster',
    description: 'High-quality art poster',
    price: 19.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/f59e0b/ffffff?text=Poster',
    rating: 4.6,
    reviewCount: 87,
    category: 'home',
    createdAt: '2024-03-05T10:00:00Z',
  },
  {
    id: '5',
    title: 'Phone Case',
    description: 'Protective phone case',
    price: 16.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/ef4444/ffffff?text=Case',
    rating: 4.4,
    reviewCount: 312,
    category: 'accessories',
    createdAt: '2024-01-25T10:00:00Z',
  },
  {
    id: '6',
    title: 'Tote Bag',
    description: 'Eco-friendly tote bag',
    price: 18.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/06b6d4/ffffff?text=Bag',
    rating: 4.7,
    reviewCount: 143,
    category: 'accessories',
    createdAt: '2024-02-10T10:00:00Z',
  },
  {
    id: '7',
    title: 'Cat Lover Mug',
    description: 'Perfect mug for cat enthusiasts',
    price: 12.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/ec4899/ffffff?text=Cat+Mug',
    rating: 4.9,
    reviewCount: 189,
    category: 'home',
    createdAt: '2024-03-15T10:00:00Z',
  },
  {
    id: '8',
    title: 'Canvas Print',
    description: 'Beautiful canvas wall art',
    price: 39.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/6366f1/ffffff?text=Canvas',
    rating: 4.6,
    reviewCount: 76,
    category: 'home',
    createdAt: '2024-02-15T10:00:00Z',
  },
  {
    id: '9',
    title: 'Baseball Cap',
    description: 'Adjustable cotton baseball cap',
    price: 19.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/14b8a6/ffffff?text=Cap',
    rating: 4.4,
    reviewCount: 203,
    category: 'accessories',
    createdAt: '2024-01-20T10:00:00Z',
  },
  {
    id: '10',
    title: 'Laptop Sleeve',
    description: 'Padded laptop protection',
    price: 24.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/f97316/ffffff?text=Sleeve',
    rating: 4.7,
    reviewCount: 154,
    category: 'accessories',
    createdAt: '2024-02-28T10:00:00Z',
  },
  {
    id: '11',
    title: 'Water Bottle',
    description: 'Insulated stainless steel bottle',
    price: 22.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/0ea5e9/ffffff?text=Bottle',
    rating: 4.8,
    reviewCount: 287,
    category: 'accessories',
    createdAt: '2024-03-10T10:00:00Z',
  },
  {
    id: '12',
    title: 'Yoga Mat',
    description: 'Non-slip exercise mat',
    price: 29.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/a855f7/ffffff?text=Yoga+Mat',
    rating: 4.5,
    reviewCount: 198,
    category: 'accessories',
    createdAt: '2024-01-30T10:00:00Z',
  },
  {
    id: '13',
    title: 'Sweatpants',
    description: 'Comfortable cotton blend sweatpants',
    price: 34.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/84cc16/ffffff?text=Sweatpants',
    rating: 4.3,
    reviewCount: 112,
    category: 'apparel',
    createdAt: '2024-02-05T10:00:00Z',
  },
  {
    id: '14',
    title: 'Coasters Set',
    description: 'Set of 4 absorbent coasters',
    price: 15.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/eab308/ffffff?text=Coasters',
    rating: 4.6,
    reviewCount: 221,
    category: 'home',
    createdAt: '2024-03-01T10:00:00Z',
  },
  {
    id: '15',
    title: 'Tank Top',
    description: 'Breathable athletic tank top',
    price: 18.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/f43f5e/ffffff?text=Tank',
    rating: 4.4,
    reviewCount: 167,
    category: 'apparel',
    createdAt: '2024-01-18T10:00:00Z',
  },
]

type SortOption = 'featured' | 'priceLowToHigh' | 'priceHighToLow' | 'newest' | 'topRated'

const PRODUCTS_PER_PAGE = 8

export default function ShopPage() {
  const t = useTranslations('shop')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('featured')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 800) // Show skeleton for 800ms on initial load
    return () => clearTimeout(timer)
  }, [])

  // Get unique categories from products
  const categories = ['all', ...Array.from(new Set(mockProducts.map((p) => p.category)))]

  // Filter products based on search query and category
  const filteredProducts = mockProducts.filter((product) => {
    // Category filter
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory

    // Search filter
    const matchesSearch =
      !searchQuery.trim() ||
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesCategory && matchesSearch
  })

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'priceLowToHigh':
        return a.price - b.price
      case 'priceHighToLow':
        return b.price - a.price
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'topRated':
        return b.rating - a.rating
      case 'featured':
      default:
        return 0 // Keep original order
    }
  })

  // Pagination
  const totalPages = Math.ceil(sortedProducts.length / PRODUCTS_PER_PAGE)
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE
  const endIndex = startIndex + PRODUCTS_PER_PAGE
  const paginatedProducts = sortedProducts.slice(startIndex, endIndex)

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Search filtering happens automatically via filteredProducts
  }

  const clearSearch = () => {
    setSearchQuery('')
    setCurrentPage(1) // Reset to page 1 when clearing search
  }

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    setCurrentPage(1) // Reset to page 1 when changing category
  }

  const handleSortChange = (value: SortOption) => {
    setSortBy(value)
    setCurrentPage(1) // Reset to page 1 when changing sort
  }

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('subtitle')}</p>
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
              {t(`category.${category}`)}
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
              ? t('searchResults', { count: sortedProducts.length, query: searchQuery })
              : t('categoryResults', { count: sortedProducts.length })}
          </p>
        </div>
      )}

      <ProductGrid
        products={paginatedProducts}
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
