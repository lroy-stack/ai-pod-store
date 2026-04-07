import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const LABEL_STYLES: Record<string, string> = {
  trending: 'bg-primary text-primary-foreground',
  bestseller: 'bg-success text-success-foreground',
  new: 'bg-accent text-accent-foreground',
  sale: 'bg-destructive text-destructive-foreground',
  limited: 'bg-warning text-warning-foreground',
}

const LABEL_TEXT: Record<string, string> = {
  trending: 'Trending',
  bestseller: 'Bestseller',
  new: 'New',
  sale: 'Sale',
  limited: 'Limited',
}

interface ProductBadgeProps {
  labels: string[]
  className?: string
}

export function ProductBadge({ labels, className }: ProductBadgeProps) {
  if (!labels || labels.length === 0) return null

  // Show first label only (most important)
  const label = labels[0]
  const style = LABEL_STYLES[label] || 'bg-primary text-primary-foreground'
  const text = LABEL_TEXT[label] || label

  return (
    <Badge
      className={cn(
        'absolute top-2 left-2 z-10 text-xs shadow-sm',
        style,
        className
      )}
    >
      {text}
    </Badge>
  )
}
