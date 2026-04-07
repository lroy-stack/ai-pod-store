export function CategoryCardSkeleton() {
  return (
    <div className="neu-card bg-card overflow-hidden">
      {/* Hero image placeholder */}
      <div className="aspect-square neu-image animate-pulse" />

      {/* Thumbnail previews placeholder */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <div className="w-10 h-10 rounded-md bg-muted animate-pulse" />
        <div className="w-10 h-10 rounded-md bg-muted animate-pulse" />
        <div className="w-10 h-10 rounded-md bg-muted animate-pulse" />
      </div>
    </div>
  )
}
