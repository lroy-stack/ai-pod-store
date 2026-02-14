'use client'

/**
 * ProductGridArtifact Skeleton - Loading state
 *
 * Displays animated shimmer placeholders while product_search tool executes
 */

import { Card, CardContent } from '@/components/ui/card'

interface ProductGridSkeletonProps {
  count?: number
  variant?: 'inline' | 'full'
}

export function ProductGridSkeleton({ count = 6, variant = 'inline' }: ProductGridSkeletonProps) {
  return (
    <div
      className={`grid gap-4 ${
        variant === 'inline'
          ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      }`}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="overflow-hidden">
          <CardContent className="p-0">
            {/* Image Skeleton */}
            <div className="aspect-square bg-muted animate-pulse" />

            {/* Content Skeleton */}
            <div className="p-4 space-y-3">
              {/* Title */}
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />

              {/* Rating */}
              <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />

              {/* Price */}
              <div className="h-5 bg-muted rounded w-1/3 animate-pulse" />

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <div className="flex-1 h-9 bg-muted rounded animate-pulse" />
                <div className="flex-1 h-9 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
