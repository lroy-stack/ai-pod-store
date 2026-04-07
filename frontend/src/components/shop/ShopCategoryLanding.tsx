'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CategoryGrid } from '@/components/shop/CategoryGrid'
import { ProductCard } from '@/components/products/ProductCard'
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed'

interface CategoryData {
  slug: string
  name: string
  imageUrl: string | null
  productCount: number
  previewImages: string[]
}

interface ShopCategoryLandingProps {
  locale: string
  categories: CategoryData[]
  totalProducts: number
}

export function ShopCategoryLanding({ locale, categories, totalProducts }: ShopCategoryLandingProps) {
  const t = useTranslations('shop')
  const router = useRouter()
  const [inputValue, setInputValue] = useState('')
  const { recentlyViewed } = useRecentlyViewed()

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      router.push(`/${locale}/shop?q=${encodeURIComponent(inputValue.trim())}`)
    }
  }

  const clearSearch = () => {
    setInputValue('')
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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="pl-10 pr-10 neu-input"
          />
          {inputValue && (
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

      {/* Category Grid */}
      <CategoryGrid categories={categories} locale={locale} />

      {/* Recently Viewed Section */}
      {recentlyViewed.length > 0 && (
        <>
          <Separator className="my-12" />

          <div>
            <h2 className="text-2xl font-bold mb-6">{t('recentlyViewed')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {recentlyViewed.slice(0, 4).map((recentProduct) => (
                <ProductCard
                  key={recentProduct.id}
                  product={{
                    id: recentProduct.id,
                    slug: recentProduct.slug,
                    title: recentProduct.title,
                    description: '',
                    price: recentProduct.price,
                    currency: recentProduct.currency,
                    image: recentProduct.image || '',
                    compareAtPrice: recentProduct.compareAtPrice,
                    rating: 0,
                    reviewCount: 0,
                    variants: recentProduct.colorImages ? { colorImages: recentProduct.colorImages } : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
