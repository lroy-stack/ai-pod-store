/**
 * Skeleton loading state for ProductMockupArtifact
 */

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

export function ProductMockupSkeleton() {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mockup Image Skeleton */}
        <div className="aspect-square w-full bg-muted animate-pulse rounded-lg" />

        {/* Product Info Skeleton */}
        <div className="space-y-2">
          <div className="h-3 w-24 bg-muted animate-pulse rounded" />
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <div className="h-10 flex-1 bg-muted animate-pulse rounded" />
        <div className="h-10 flex-1 bg-muted animate-pulse rounded" />
      </CardFooter>
    </Card>
  )
}
