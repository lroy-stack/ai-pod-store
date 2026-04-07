'use client'

import { useAuth } from '@/hooks/useAuth'
import { useUsage } from '@/providers/UsageProvider'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export function UsageMeter() {
  const { user } = useAuth()
  const { usage } = useUsage()
  const t = useTranslations('usage')

  if (!user || !usage) return null

  const chatUsage = usage.usage['chat']
  const designUsage = usage.usage['design:generate']
  const mockupUsage = usage.usage['design:mockup']

  return (
    <div className="px-3 py-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {t('title')}
      </p>

      {chatUsage && chatUsage.limit > 0 && (
        <UsageBar
          label={t('chats')}
          used={chatUsage.used}
          limit={chatUsage.limit}
          periodLabel={chatUsage.periodType === 'monthly' ? t('thisMonth') : t('today')}
        />
      )}

      {designUsage && designUsage.limit > 0 && (
        <UsageBar
          label={t('designs')}
          used={designUsage.used}
          limit={designUsage.limit}
          periodLabel={designUsage.periodType === 'monthly' ? t('thisMonth') : t('today')}
        />
      )}

      {mockupUsage && mockupUsage.limit > 0 && (
        <UsageBar
          label={t('mockups')}
          used={mockupUsage.used}
          limit={mockupUsage.limit}
          periodLabel={mockupUsage.periodType === 'monthly' ? t('thisMonth') : t('today')}
        />
      )}

      {usage.credits && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{t('credits')}</span>
          <span>{t('creditsRemaining', { count: usage.credits.balance })}</span>
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
