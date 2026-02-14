/**
 * SizeGuideArtifact Skeleton - Loading state
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function SizeGuideSkeleton() {
  return (
    <Card className="w-full max-w-2xl bg-card">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-pulse rounded bg-muted" />
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Table header */}
          <div className="flex gap-4 border-b border-border pb-3">
            <div className="h-4 w-12 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
          {/* Table rows */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 border-b border-border pb-3 last:border-b-0">
              <div className="h-4 w-12 animate-pulse rounded bg-muted" />
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-4 h-3 w-full animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  )
}
