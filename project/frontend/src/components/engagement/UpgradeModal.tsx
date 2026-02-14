'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Check, Sparkles } from 'lucide-react'

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason?: string
}

const FREE_FEATURES = [
  '50 chats/day',
  '3 designs/day',
  '5 mockups/day',
]

const PREMIUM_FEATURES = [
  '500 chats/day',
  '30 designs/day',
  '50 mockups/day',
  '10 bonus credits/month',
  'Priority support',
]

export function UpgradeModal({ open, onOpenChange, reason }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/subscription/create', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  async function handleBuyCredits() {
    setLoading(true)
    try {
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: 'small' }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Upgrade to Premium
          </DialogTitle>
          {reason && (
            <DialogDescription>{reason}</DialogDescription>
          )}
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          {/* Free column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Free</Badge>
            </div>
            {FREE_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-3.5 w-3.5 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>

          {/* Premium column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary">Premium</Badge>
              <span className="text-sm font-medium text-foreground">9.99/mo</span>
            </div>
            {PREMIUM_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={handleUpgrade} disabled={loading} className="w-full">
            {loading ? 'Redirecting...' : 'Upgrade Now \u2014 \u20AC9.99/mo'}
          </Button>
          <button
            onClick={handleBuyCredits}
            disabled={loading}
            className="text-sm text-primary hover:underline text-center transition-colors"
          >
            Or buy credits: 15 designs for 4.99
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
