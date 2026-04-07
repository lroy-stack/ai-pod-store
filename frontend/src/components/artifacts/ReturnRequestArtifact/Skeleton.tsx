/**
 * Skeleton loading state for ReturnRequestArtifact
 */

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function ReturnRequestSkeleton() {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 bg-muted animate-pulse rounded" />
            <div className="h-4 w-48 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Order ID and Status */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3 w-16 bg-muted animate-pulse rounded" />
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
        </div>

        <Separator />

        {/* Date Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-16 bg-muted animate-pulse rounded" />
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          </div>
        </div>

        <Separator />

        {/* Refund Amount */}
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-muted animate-pulse rounded" />
          <div className="h-6 w-20 bg-muted animate-pulse rounded" />
        </div>

        {/* Reason Input */}
        <div className="space-y-2">
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          <div className="h-20 w-full bg-muted animate-pulse rounded" />
        </div>

        {/* Note */}
        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
          <div className="h-3 w-full bg-muted animate-pulse rounded" />
          <div className="h-3 w-4/5 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <div className="h-10 flex-1 bg-muted animate-pulse rounded" />
        <div className="h-10 flex-1 bg-muted animate-pulse rounded" />
      </CardFooter>
    </Card>
  )
}
