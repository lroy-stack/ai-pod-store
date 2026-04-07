'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function GuestWishlistBanner() {
  const t = useTranslations('wishlist')
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="mb-4 px-4 py-2.5 bg-muted/60 border border-border/60 rounded-xl flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">{t('signInHeadline')}</p>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" className="h-7 text-xs px-3" asChild>
          <Link href={`/${locale}/auth/register`}>{t('createAccount')}</Link>
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
