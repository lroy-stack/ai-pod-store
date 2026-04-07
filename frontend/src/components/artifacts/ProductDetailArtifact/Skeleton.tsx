'use client'

/**
 * ProductDetailSkeleton - Loading state for product detail card
 */

import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface ProductDetailSkeletonProps {
  variant?: 'inline' | 'full'
}

export function ProductDetailSkeleton({ variant = 'inline' }: ProductDetailSkeletonProps) {
  return (
    <Card className={cn('overflow-hidden', variant === 'inline' && 'max-w-2xl')}>
      <div className={cn('grid gap-6', variant === 'full' ? 'md:grid-cols-2' : 'md:grid-cols-[300px_1fr]')}>
        {/* Image skeleton */}
        <div className="h-64 w-full animate-pulse bg-muted md:h-auto" />

        {/* Content skeleton */}
        <div className="flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-6 w-24 animate-pulse rounded bg-muted" />
              </div>
              <div className="space-y-2 text-right">
                <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            {/* Description skeleton */}
            <div className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>

            <Separator />

            {/* Variants skeleton */}
            <div className="space-y-2">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="flex gap-2">
                <div className="h-6 w-12 animate-pulse rounded bg-muted" />
                <div className="h-6 w-12 animate-pulse rounded bg-muted" />
                <div className="h-6 w-12 animate-pulse rounded bg-muted" />
              </div>
            </div>

            <Separator />

            {/* Shipping skeleton */}
            <div className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
            </div>
          </CardContent>

          <CardFooter className="flex gap-2">
            <div className="h-10 flex-1 animate-pulse rounded bg-muted" />
            <div className="h-10 w-10 animate-pulse rounded bg-muted" />
          </CardFooter>
        </div>
      </div>
    </Card>
  )
}
