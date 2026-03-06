'use client'

import { ProductCard } from './ProductCard'
import { ProductCardSkeleton } from './ProductCardSkeleton'
import type { ProductCard as ProductCardType } from '@/types/product'

interface ProductGridProps {
  products: ProductCardType[]
  isLoading?: boolean
  emptyMessage?: string
  skeletonCount?: number
}

export function ProductGrid({
  products,
  isLoading = false,
  emptyMessage = 'No products found',
  skeletonCount = 8
}: ProductGridProps) {
  // CSS grid with auto-fill so columns adapt to available container width
  // min 200px per card → naturally goes from 1→2→3→4→5 cols as space allows
  // neu-grid class in globals.css allows theme override via --grid-card-min / --grid-gap
  const gridClasses = 'neu-grid'

  // Show loading skeletons
  if (isLoading) {
    return (
      <div className={gridClasses}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  // Show empty state
  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">{emptyMessage}</p>
      </div>
    )
  }

  // Show products
  return (
    <div className={gridClasses}>
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} priority={i < 4} />
      ))}
    </div>
  )
}
