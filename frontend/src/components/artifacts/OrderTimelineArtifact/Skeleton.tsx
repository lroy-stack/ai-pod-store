'use client'

/**
 * OrderTimelineArtifact Skeleton - Loading state
 *
 * Displays animated shimmer placeholders while track_order tool executes
 */

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface OrderTimelineSkeletonProps {
  eventCount?: number
}

export function OrderTimelineSkeleton({ eventCount = 5 }: OrderTimelineSkeletonProps) {
  return (
    <Card>
      <CardHeader>
        {/* Title Skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-muted rounded animate-pulse" />
          <div className="h-6 bg-muted rounded w-32 animate-pulse" />
          <div className="h-5 bg-muted rounded w-20 animate-pulse" />
        </div>
        <div className="h-4 bg-muted rounded w-24 animate-pulse mt-2" />
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Timeline Skeleton */}
        <div className="space-y-4">
          {Array.from({ length: eventCount }).map((_, index) => (
            <div key={index} className="flex gap-4">
              {/* Icon + Line */}
              <div className="flex flex-col items-center">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                {index < eventCount - 1 && (
                  <div className="w-0.5 flex-1 min-h-[40px] bg-muted animate-pulse" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-8 space-y-2">
                <div className="h-5 bg-muted rounded w-32 animate-pulse" />
                <div className="h-4 bg-muted rounded w-40 animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Tracking Number Skeleton */}
        <div>
          <div className="h-4 bg-muted rounded w-28 animate-pulse mb-2" />
          <div className="h-4 bg-muted rounded w-48 animate-pulse" />
        </div>

        <Separator />

        {/* Estimated Delivery Skeleton */}
        <div>
          <div className="h-4 bg-muted rounded w-32 animate-pulse mb-2" />
          <div className="h-4 bg-muted rounded w-40 animate-pulse" />
        </div>
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row gap-2">
        <div className="h-10 bg-muted rounded w-full sm:w-40 animate-pulse" />
        <div className="h-10 bg-muted rounded w-full sm:w-36 animate-pulse" />
      </CardFooter>
    </Card>
  )
}
