'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-fetch'

interface DeletionCountdownBannerProps {
  deletionRequestedAt: string
  onCancelled: () => void
}

export function DeletionCountdownBanner({
  deletionRequestedAt,
  onCancelled,
}: DeletionCountdownBannerProps) {
  const t = useTranslations('Profile')
  const [cancelling, setCancelling] = useState(false)

  const requestedAt = new Date(deletionRequestedAt)
  const deleteAt = new Date(requestedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
  const now = new Date()
  const daysRemaining = Math.max(
    0,
    Math.ceil((deleteAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  )

  const handleCancel = async () => {
    setCancelling(true)
    try {
      const response = await apiFetch('/api/profile/cancel-deletion', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to cancel deletion')
      }

      toast.success(t('deletionCancelled'))
      onCancelled()
    } catch (err) {
      toast.error(t('errorCancellingDeletion'))
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-semibold text-destructive">
            {t('deletionCountdownTitle')}
          </h4>
          <p className="text-sm text-muted-foreground">
            {t('deletionCountdownDescription', { days: daysRemaining })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('deletionDate', {
              date: deleteAt.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
            })}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCancel}
        disabled={cancelling}
      >
        {cancelling && <Loader2 className="size-4 animate-spin" />}
        {t('cancelDeletion')}
      </Button>
    </div>
  )
}
