// Skeleton loading state for dynamic pricing and stock
// Shown while the server component streams in (PPR)

export function DynamicPriceStockSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-32 bg-muted rounded" />
      <div className="h-6 w-20 bg-muted rounded-full" />
    </div>
  )
}
