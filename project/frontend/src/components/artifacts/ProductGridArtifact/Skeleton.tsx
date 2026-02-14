'use client'

/**
 * ProductGridArtifact Skeleton - Loading state
 *
 * Displays animated shimmer placeholders while product_search tool executes
 * Aligned with the real ProductGridArtifact component structure
 */

interface ProductGridSkeletonProps {
  count?: number
  variant?: 'inline' | 'full'
}

export function ProductGridSkeleton({ count = 6, variant = 'inline' }: ProductGridSkeletonProps) {
  return (
    <div
      className={`grid gap-3 ${
        variant === 'inline'
          ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      }`}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl bg-card overflow-hidden border border-border/40">
          {/* Image Skeleton — square, matching component */}
          <div className="aspect-square bg-muted animate-pulse" />

          {/* Content Skeleton — matching px-3.5 py-3 */}
          <div className="px-3.5 py-3 space-y-1.5">
            {/* Title */}
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            {/* Price + Rating row */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
              <div className="h-3 bg-muted rounded animate-pulse w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
