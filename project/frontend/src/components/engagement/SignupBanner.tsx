'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

/**
 * Subtle banner in chat area for guests who've used 50%+ of daily chat limit.
 * Shows remaining message count and a signup CTA.
 *
 * Pass `messageCount` to trigger a realtime refetch after each new message.
 */
export function SignupBanner({ messageCount = 0 }: { messageCount?: number }) {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const t = useTranslations('engagement.signupBanner')
  const [chatUsage, setChatUsage] = useState<{ used: number; limit: number } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const fetchUsage = useCallback(async () => {
    if (user) return
    try {
      const res = await fetch('/api/usage/status')
      if (res.ok) {
        const data = await res.json()
        setChatUsage(data.usage?.chat || null)
      }
    } catch {
      // silent
    }
  }, [user])

  // Periodic polling (30s)
  useEffect(() => {
    if (user) return
    fetchUsage()
    const interval = setInterval(fetchUsage, 30_000)
    return () => clearInterval(interval)
  }, [user, fetchUsage])

  // Immediate refetch when message count changes
  useEffect(() => {
    if (messageCount > 0) fetchUsage()
  }, [messageCount, fetchUsage])

  if (user || dismissed || !chatUsage) return null
  if (chatUsage.limit <= 0 || chatUsage.used < chatUsage.limit * 0.5) return null

  const remaining = Math.max(0, chatUsage.limit - chatUsage.used)

  return (
    <div className="flex justify-center mb-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="inline-flex items-center gap-3 px-4 py-2 bg-muted/60 border border-border/60 rounded-full text-sm text-muted-foreground">
        <span>
          {remaining > 0
            ? t('remaining', { used: chatUsage.used, limit: chatUsage.limit })
            : t('exhausted', { limit: chatUsage.limit })}
        </span>
        <Button
          size="sm"
          className="h-7 text-xs px-3 rounded-full"
          onClick={() => router.push(`/${locale}/auth/register`)}
        >
          {t('cta')}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground/60 hover:text-foreground"
          aria-label="Dismiss"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
