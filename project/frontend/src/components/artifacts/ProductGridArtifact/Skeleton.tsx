'use client'

/**
 * ProductGridArtifact Skeleton - Loading state
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
          ? 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))]'
          : 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))]'
      }`}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl bg-card overflow-hidden border border-border/40">
          <div className="aspect-square bg-muted animate-pulse" />
          <div className="px-3.5 py-3 space-y-1.5">
            <div className="h-4 bg-muted rounded-md animate-pulse w-3/4" />
            <div className="flex items-center justify-between">
              <div className="h-4 bg-muted rounded-md animate-pulse w-1/3" />
              <div className="h-3 bg-muted rounded-md animate-pulse w-12" />
            </div>
            <div className="flex gap-1.5 pt-0.5">
              <div className="flex-1 h-8 bg-muted rounded-lg animate-pulse" />
              <div className="h-8 w-8 bg-muted rounded-lg animate-pulse flex-shrink-0" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
