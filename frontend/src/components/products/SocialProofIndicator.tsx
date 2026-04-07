'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Flame, Eye } from 'lucide-react'

interface SocialProofIndicatorProps {
  productId: string
}

export function SocialProofIndicator({ productId }: SocialProofIndicatorProps) {
  const t = useTranslations('product')
  const [data, setData] = useState<{
    viewsToday: number
    ordersThisWeek: number
    sellingFast: boolean
  } | null>(null)

  useEffect(() => {
    if (!productId) return

    const fetchSocialProof = async () => {
      try {
        const res = await fetch(`/api/products/${productId}/social-proof`)
        if (res.ok) {
          setData(await res.json())
        }
      } catch {
        // Silently fail — social proof is non-critical
      }
    }

    fetchSocialProof()
  }, [productId])

  if (!data || (data.ordersThisWeek === 0 && data.viewsToday === 0)) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {data.sellingFast && (
        <Badge variant="destructive" className="gap-1 text-xs">
          <Flame className="size-3" />
          {t('sellingFast')}
        </Badge>
      )}
      {data.ordersThisWeek > 0 && (
        <span className="text-xs text-muted-foreground">
          {t('boughtThisWeek', { count: data.ordersThisWeek })}
        </span>
      )}
      {data.viewsToday > 0 && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Eye className="size-3" />
          {t('viewedToday', { count: data.viewsToday })}
        </span>
      )}
    </div>
  )
}
