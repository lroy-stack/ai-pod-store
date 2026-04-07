'use client'

import { CategoryCard } from '@/components/shop/CategoryCard'
import { CategoryCardSkeleton } from '@/components/shop/CategoryCardSkeleton'

interface CategoryData {
  slug: string
  name: string
  imageUrl: string | null
  productCount: number
  previewImages: string[]
}

interface CategoryGridProps {
  categories: CategoryData[]
  locale: string
  isLoading?: boolean
}

export function CategoryGrid({ categories, locale, isLoading }: CategoryGridProps) {
  if (isLoading) {
    return (
      <div className="neu-grid" style={{ '--grid-card-min': '280px' } as React.CSSProperties}>
        {Array.from({ length: 6 }).map((_, i) => (
          <CategoryCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (categories.length === 0) {
    return null
  }

  return (
    <div className="neu-grid" style={{ '--grid-card-min': '280px' } as React.CSSProperties}>
      {categories.map((cat, i) => (
        <CategoryCard
          key={cat.slug}
          slug={cat.slug}
          name={cat.name}
          imageUrl={cat.imageUrl}
          productCount={cat.productCount}
          previewImages={cat.previewImages}
          locale={locale}
          priority={i < 4}
        />
      ))}
    </div>
  )
}
