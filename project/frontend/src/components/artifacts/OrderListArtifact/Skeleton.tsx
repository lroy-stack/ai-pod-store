'use client'

/**
 * OrderListArtifact Skeleton - Loading state
 *
 * Displays animated shimmer placeholders while get_order_history tool executes
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface OrderListSkeletonProps {
  orderCount?: number
}

export function OrderListSkeleton({ orderCount = 3 }: OrderListSkeletonProps) {
  return (
    <Card>
      <CardHeader>
        {/* Title Skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-muted rounded animate-pulse" />
          <div className="h-6 bg-muted rounded w-40 animate-pulse" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: orderCount }).map((_, index) => (
          <div key={index}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Order Info Skeleton */}
              <div className="space-y-2 flex-1">
                {/* Order ID + Badge */}
                <div className="flex items-center gap-2">
                  <div className="h-5 bg-muted rounded w-28 animate-pulse" />
                  <div className="h-5 bg-muted rounded w-20 animate-pulse" />
                </div>
                {/* Date + Total */}
                <div className="flex items-center gap-4">
                  <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                  <div className="h-4 bg-muted rounded w-20 animate-pulse" />
                </div>
              </div>

              {/* Actions Skeleton */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="h-9 bg-muted rounded w-28 animate-pulse" />
                <div className="h-9 bg-muted rounded w-28 animate-pulse" />
              </div>
            </div>

            {index < orderCount - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
