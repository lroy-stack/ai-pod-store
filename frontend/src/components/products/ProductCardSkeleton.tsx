export function ProductCardSkeleton() {
  return (
    <div className="neu-card bg-card overflow-hidden">
      {/* Image */}
      <div className="aspect-square neu-image animate-pulse" />

      {/* Content */}
      <div className="px-3.5 py-3 space-y-2">
        {/* Category + rating */}
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-16 bg-muted rounded-md animate-pulse" />
          <div className="h-2.5 w-10 bg-muted rounded-md animate-pulse" />
        </div>
        {/* Title */}
        <div className="h-4 bg-muted rounded-md animate-pulse w-3/4" />
        {/* Description */}
        <div className="space-y-1.5">
          <div className="h-3 bg-muted rounded-md animate-pulse w-full" />
          <div className="h-3 bg-muted rounded-md animate-pulse w-2/3" />
        </div>
        {/* Price */}
        <div className="h-4 bg-muted rounded-md animate-pulse w-16" />
        {/* Action buttons */}
        <div className="flex gap-1.5 pt-0.5">
          <div className="flex-1 h-8 bg-muted rounded-lg animate-pulse" />
          <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  )
}
