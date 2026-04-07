import { Skeleton } from '@/components/ui/skeleton'
import { CategoryCardSkeleton } from '@/components/shop/CategoryCardSkeleton'

export default function ShopLoading() {
  return (
    <div className="py-8 md:py-12 px-4 md:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="mb-8">
          <Skeleton className="h-10 w-48 mb-4" />
          <Skeleton className="h-5 w-96 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Search bar skeleton */}
        <div className="mb-8">
          <Skeleton className="h-10 w-full max-w-2xl" />
        </div>

        {/* Category cards grid skeleton */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CategoryCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
