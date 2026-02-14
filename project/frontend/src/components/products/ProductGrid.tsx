'use client'

import { ProductCard } from './ProductCard'
import { ProductCardSkeleton } from './ProductCardSkeleton'

interface Product {
  id: string
  title: string
  description: string
  price: number
  currency: string
  image: string
  rating?: number
  reviewCount?: number
  category?: string
}

interface ProductGridProps {
  products: Product[]
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
  // min 200px per card → naturally goes from 1→2→3→4 cols as space allows
  const gridClasses = 'grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4'

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
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
