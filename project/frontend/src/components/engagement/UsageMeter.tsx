'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface UsageEntry {
  used: number
  limit: number
  remaining: number
  periodType: 'daily' | 'monthly'
  resetAt: string
}

interface UsageData {
  tier: string
  usage: Record<string, UsageEntry>
  credits?: { balance: number }
}

export function UsageMeter() {
  const { user } = useAuth()
  const [data, setData] = useState<UsageData | null>(null)

  // React Compiler auto-memoizes this function
  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/usage/status')
      if (res.ok) {
        setData(await res.json())
      }
    } catch {
      // silent fail
    }
  }

  useEffect(() => {
    if (user) {
      fetchUsage()
      // Refresh every 60 seconds
      const interval = setInterval(fetchUsage, 60_000)
      return () => clearInterval(interval)
    } else {
      setData(null)
    }
  }, [user, fetchUsage])

  if (!user || !data) return null

  const chatUsage = data.usage['chat']
  const designUsage = data.usage['design:generate']
  const mockupUsage = data.usage['design:mockup']

  return (
    <div className="px-3 py-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Usage
      </p>

      {chatUsage && chatUsage.limit > 0 && (
        <UsageBar
          label="Chats"
          used={chatUsage.used}
          limit={chatUsage.limit}
          periodLabel={chatUsage.periodType === 'monthly' ? 'this month' : 'today'}
        />
      )}

      {designUsage && designUsage.limit > 0 && (
        <UsageBar
          label="Designs"
          used={designUsage.used}
          limit={designUsage.limit}
          periodLabel={designUsage.periodType === 'monthly' ? 'this month' : 'today'}
        />
      )}

      {mockupUsage && mockupUsage.limit > 0 && (
        <UsageBar
          label="Mockups"
          used={mockupUsage.used}
          limit={mockupUsage.limit}
          periodLabel={mockupUsage.periodType === 'monthly' ? 'this month' : 'today'}
        />
      )}

      {data.credits && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Credits</span>
          <span>{data.credits.balance} remaining</span>
        </div>
      )}
    </div>
  )
}

function UsageBar({ label, used, limit, periodLabel }: { label: string; used: number; limit: number; periodLabel: string }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const isHigh = pct >= 80

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label} <span className="opacity-60">({periodLabel})</span></span>
        <span className={cn('tabular-nums', isHigh ? 'text-destructive' : 'text-muted-foreground')}>
          {used}/{limit}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isHigh ? 'bg-destructive' : 'bg-primary'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
