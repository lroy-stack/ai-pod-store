/**
 * ApprovalCardSkeleton - Loading state for approval card
 */

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

export function ApprovalCardSkeleton() {
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
        <div className="space-y-3">
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          <div className="space-y-2">
            <div className="h-12 bg-muted animate-pulse rounded" />
            <div className="h-12 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between">
            <div className="h-5 w-16 bg-muted animate-pulse rounded" />
            <div className="h-6 w-20 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-16 bg-muted/50 animate-pulse rounded-lg" />
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <div className="h-10 flex-1 bg-muted animate-pulse rounded" />
        <div className="h-10 flex-1 bg-muted animate-pulse rounded" />
      </CardFooter>
    </Card>
  )
}
