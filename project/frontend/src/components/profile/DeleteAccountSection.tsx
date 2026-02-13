'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
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

export function DeleteAccountSection() {
  const t = useTranslations('Profile')
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteAccount = async () => {
    setIsDeleting(true)

    try {
      const response = await fetch('/api/profile/delete', {
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
        // Force a full page reload to clear all client-side state
        window.location.href = '/en'
      }, 1500)
    } catch (err: any) {
      console.error('Error deleting account:', err)
      toast.error(err.message || t('accountDeleteError'))
    } finally {
      setIsDeleting(false)
    }
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
