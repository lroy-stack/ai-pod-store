'use client'

/**
 * ComparisonTableSkeleton - Loading state for product comparison table
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ComparisonTableSkeletonProps {
  variant?: 'inline' | 'full'
  productCount?: number
}

export function ComparisonTableSkeleton({
  variant = 'inline',
  productCount = 2,
}: ComparisonTableSkeletonProps) {
  const products = Array(productCount).fill(null)
  const rows = ['Price', 'Rating', 'Availability', 'Feature 1', 'Feature 2']

  return (
    <Card className={cn('overflow-hidden', variant === 'inline' && 'max-w-4xl')}>
      <CardHeader>
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 p-4">
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                </th>
                {products.map((_, i) => (
                  <th key={i} className="min-w-[200px] p-4">
                    <div className="space-y-2">
                      <div className="mx-auto h-24 w-24 animate-pulse rounded bg-muted" />
                      <div className="mx-auto h-4 w-32 animate-pulse rounded bg-muted" />
                      <div className="mx-auto h-5 w-20 animate-pulse rounded bg-muted" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-b hover:bg-muted/50">
                  <td className="sticky left-0 z-10 bg-card p-4">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  </td>
                  {products.map((_, i) => (
                    <td key={i} className="p-4 text-center">
                      <div className="mx-auto h-6 w-20 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))}
              {/* Action row */}
              <tr className="bg-muted/50">
                <td className="sticky left-0 z-10 bg-muted/50 p-4">
                  <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                </td>
                {products.map((_, i) => (
                  <td key={i} className="p-4">
                    <div className="h-10 w-full animate-pulse rounded bg-muted" />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
