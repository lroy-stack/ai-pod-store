'use client'

import { useTranslations } from 'next-intl'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WishlistEmptyStateProps {
  onAction?: () => void
  actionLabel?: string
}

export function WishlistEmptyState({ onAction, actionLabel }: WishlistEmptyStateProps) {
  const t = useTranslations('wishlist')

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Heart className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-sm font-medium text-foreground mb-1">{t('empty')}</p>
      <p className="text-xs text-muted-foreground mb-4">{t('emptyDescription')}</p>
      {onAction && (
        <Button onClick={onAction} size="sm" variant="outline">
          <Heart className="h-3.5 w-3.5 mr-1.5" />
          {actionLabel || t('createFirst')}
        </Button>
      )}
    </div>
  )
}
