'use client'

import { useParams, useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Check } from 'lucide-react'

interface AuthWallModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason?: string
}

const BENEFITS = [
  '50 AI chats per day',
  '3 AI designs per day',
  'Save wishlists permanently',
  'Order tracking & history',
]

export function AuthWallModal({ open, onOpenChange, reason }: AuthWallModalProps) {
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) || 'en'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Create your free account</DialogTitle>
          {reason && (
            <DialogDescription>{reason}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3 py-2">
          {BENEFITS.map((benefit) => (
            <div key={benefit} className="flex items-center gap-3">
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground">{benefit}</span>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex flex-col gap-2 pt-1">
          <Button
            onClick={() => {
              onOpenChange(false)
              router.push(`/${locale}/auth/register`)
            }}
            className="w-full"
          >
            Sign Up Free
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              router.push(`/${locale}/auth/login`)
            }}
            className="w-full"
          >
            Log In
          </Button>
          <button
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground hover:text-foreground text-center pt-1 transition-colors"
          >
            Continue as guest
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
