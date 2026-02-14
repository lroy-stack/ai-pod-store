'use client'

/**
 * CartSummaryArtifact Skeleton - Loading state
 *
 * Displays animated shimmer placeholders while get_cart tool executes
 */

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface CartSummarySkeletonProps {
  itemCount?: number
}

export function CartSummarySkeleton({ itemCount = 3 }: CartSummarySkeletonProps) {
  return (
    <Card>
      <CardHeader>
        {/* Title Skeleton */}
        <div className="h-6 bg-muted rounded w-1/2 animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cart Items Skeleton */}
        {Array.from({ length: itemCount }).map((_, index) => (
          <div key={index}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                {/* Title */}
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
                {/* Price × Quantity */}
                <div className="h-3 bg-muted rounded w-1/3 animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                {/* Subtotal */}
                <div className="h-5 bg-muted rounded w-16 animate-pulse" />
              </div>
            </div>
            {index < itemCount - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </CardContent>
      <Separator />
      <CardFooter className="flex-col gap-4 pt-6">
        {/* Subtotal Skeleton */}
        <div className="w-full flex items-center justify-between">
          <div className="h-5 bg-muted rounded w-20 animate-pulse" />
          <div className="h-6 bg-muted rounded w-24 animate-pulse" />
        </div>

        {/* Buttons Skeleton */}
        <div className="w-full flex flex-col sm:flex-row gap-2">
          <div className="flex-1 h-10 bg-muted rounded animate-pulse" />
          <div className="flex-1 h-10 bg-muted rounded animate-pulse" />
        </div>

        {/* Note Skeleton */}
        <div className="h-3 bg-muted rounded w-3/4 mx-auto animate-pulse" />
      </CardFooter>
    </Card>
  )
}
