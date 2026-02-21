/**
 * Skeleton loading state for PersonalizationSuggestionsArtifact
 */

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

export function PersonalizationSuggestionsSkeleton() {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-28 bg-muted animate-pulse rounded" />
              <div className="h-4 w-36 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Image skeleton */}
        <div className="aspect-square w-full max-w-[280px] mx-auto bg-muted animate-pulse rounded-lg" />

        {/* Suggestion chips skeleton */}
        <div className="space-y-2">
          <div className="h-3 w-20 bg-muted animate-pulse rounded" />
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-28 bg-muted animate-pulse rounded-md" />
            <div className="h-8 w-32 bg-muted animate-pulse rounded-md" />
            <div className="h-8 w-24 bg-muted animate-pulse rounded-md" />
          </div>
        </div>

        {/* Input skeleton */}
        <div className="space-y-2">
          <div className="h-3 w-16 bg-muted animate-pulse rounded" />
          <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
        </div>
      </CardContent>

      <CardFooter>
        <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
      </CardFooter>
    </Card>
  )
}
