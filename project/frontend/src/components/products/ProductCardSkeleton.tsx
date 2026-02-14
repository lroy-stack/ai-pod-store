export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl bg-card overflow-hidden border border-border/40">
      {/* Image */}
      <div className="aspect-square bg-muted animate-pulse" />

      {/* Content */}
      <div className="px-3.5 py-3 space-y-2">
        <div className="space-y-1.5">
          <div className="h-4 bg-muted rounded-md animate-pulse w-3/4" />
          <div className="h-3 bg-muted rounded-md animate-pulse w-full" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-4 bg-muted rounded-md animate-pulse w-16" />
          <div className="h-3 bg-muted rounded-md animate-pulse w-12" />
        </div>
        {/* Action buttons row */}
        <div className="flex gap-1.5 pt-0.5">
          <div className="flex-1 h-8 bg-muted rounded-lg animate-pulse" />
          <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  )
}
