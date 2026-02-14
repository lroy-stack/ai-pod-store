export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl bg-card overflow-hidden border border-border/40">
      {/* Image Skeleton — square */}
      <div className="aspect-square bg-muted animate-pulse" />

      {/* Content — matches ProductCard px-3.5 py-3 */}
      <div className="px-3.5 py-3 space-y-1.5">
        {/* Title */}
        <div className="h-4 bg-muted rounded-md animate-pulse w-3/4" />
        {/* Description */}
        <div className="h-3 bg-muted rounded-md animate-pulse w-full" />
        {/* Price + Rating row */}
        <div className="flex items-center justify-between pt-1">
          <div className="h-4 bg-muted rounded-md animate-pulse w-16" />
          <div className="h-3 bg-muted rounded-md animate-pulse w-12" />
        </div>
      </div>
    </div>
  )
}
