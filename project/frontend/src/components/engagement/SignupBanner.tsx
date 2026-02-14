'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

/**
 * Subtle banner in chat area for guests who've used 50%+ of daily chat limit.
 * Shows remaining message count and a signup CTA.
 */
export function SignupBanner() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const [chatUsage, setChatUsage] = useState<{ used: number; limit: number } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Only show for anonymous users
    if (user) return

    async function fetchUsage() {
      try {
        const res = await fetch('/api/usage/status')
        if (res.ok) {
          const data = await res.json()
          setChatUsage(data.usage?.chat || null)
        }
      } catch {
        // silent
      }
    }

    fetchUsage()
    const interval = setInterval(fetchUsage, 30_000)
    return () => clearInterval(interval)
  }, [user])

  // Don't show if user is logged in, banner dismissed, or usage below 50%
  if (user || dismissed || !chatUsage) return null
  if (chatUsage.limit <= 0 || chatUsage.used < chatUsage.limit * 0.5) return null

  const remaining = Math.max(0, chatUsage.limit - chatUsage.used)

  return (
    <div className="mx-3 mb-2 px-4 py-2.5 bg-muted/60 border border-border/60 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <p className="text-xs text-muted-foreground">
        {remaining > 0
          ? `${chatUsage.used} of ${chatUsage.limit} free messages used today. Sign up free for 50/day.`
          : `You've used all ${chatUsage.limit} free messages today. Sign up for more.`}
      </p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs px-3"
          onClick={() => router.push(`/${locale}/auth/register`)}
        >
          Create Account
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
