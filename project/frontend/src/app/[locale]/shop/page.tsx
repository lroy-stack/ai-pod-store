'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, X } from 'lucide-react'
import { ProductGrid } from '@/components/products/ProductGrid'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  },
]

export default function ShopPage() {
  const t = useTranslations('shop')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Search filtering happens automatically via filteredProducts
  }

  const clearSearch = () => {
    setSearchQuery('')
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

      {/* Category Filters */}
      <div className="mb-6">
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
              onClick={() => setSelectedCategory(category)}
            >
              {t(`category.${category}`)}
            </Badge>
          ))}
        </div>
      </div>

      {/* Results count */}
      {(searchQuery || selectedCategory !== 'all') && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {searchQuery
              ? t('searchResults', { count: filteredProducts.length, query: searchQuery })
              : t('categoryResults', { count: filteredProducts.length })}
          </p>
        </div>
      )}

      <ProductGrid products={filteredProducts} />
    </div>
  )
}
