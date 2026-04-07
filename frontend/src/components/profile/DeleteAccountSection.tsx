'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { DeletionCountdownBanner } from './DeletionCountdownBanner'
import { apiFetch } from '@/lib/api-fetch'

export function DeleteAccountSection() {
  const t = useTranslations('Profile')
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [pendingDeletion, setPendingDeletion] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDeletionStatus() {
      try {
        const res = await fetch('/api/user/profile', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        if (data.profile?.deletion_requested_at) {
          setPendingDeletion(data.profile.deletion_requested_at)
        }
      } catch {
        // Ignore — profile page handles auth redirect
      }
    }
    fetchDeletionStatus()
  }, [])

  const handleDeleteAccount = async () => {
    setIsDeleting(true)

    try {
      const response = await apiFetch('/api/profile/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete account')
      }

      toast.success(t('accountDeletedSuccess'))

      // Close dialog and redirect to home after a short delay
      setIsOpen(false)
      setTimeout(() => {
        window.location.href = '/en'
      }, 1500)
    } catch (err: any) {
      console.error('Error deleting account:', err)
      toast.error(err.message || t('accountDeleteError'))
    } finally {
      setIsDeleting(false)
    }
  }

  // If deletion is pending, show countdown banner instead of delete button
  if (pendingDeletion) {
    return (
      <DeletionCountdownBanner
        deletionRequestedAt={pendingDeletion}
        onCancelled={() => setPendingDeletion(null)}
      />
    )
  }

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
      <h3 className="text-lg font-semibold text-destructive mb-2">
        {t('dangerZone')}
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {t('dangerZoneDescription')}
      </p>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive">
            {t('deleteAccount')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteAccountConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteAccountConfirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <p className="text-sm text-muted-foreground">
              {t('deleteAccountWarning1')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('deleteAccountWarning2')}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isDeleting}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? t('deleting') : t('confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
