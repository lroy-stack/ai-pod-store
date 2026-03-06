'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Generation {
  id: string
  prompt: string
  image_url: string
  provider: string
  inference_ms: number
  created_at: string
}

interface DesignHistoryPanelProps {
  onSelect?: (generationId: string, imageUrl: string) => void
  className?: string
}

export function DesignHistoryPanel({ onSelect, className }: DesignHistoryPanelProps) {
  const t = useTranslations('designStudio')
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/designs/history', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setGenerations(data.generations || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className={cn('flex gap-2 overflow-x-auto py-2', className)}>
        {[1, 2, 3].map(i => (
          <div key={i} className="size-16 shrink-0 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (generations.length === 0) {
    return (
      <div className={cn('text-center py-6 text-muted-foreground text-sm', className)}>
        <Sparkles className="size-8 mx-auto mb-2 opacity-30" />
        <p>{t('historyEmpty')}</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {t('historyTitle')}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {generations.map(gen => (
          <button
            key={gen.id}
            type="button"
            className="size-16 shrink-0 rounded-md border-2 border-border overflow-hidden hover:border-primary transition-colors relative"
            onClick={() => onSelect?.(gen.id, gen.image_url)}
            title={gen.prompt}
          >
            {gen.image_url ? (
              <Image
                src={gen.image_url}
                alt={gen.prompt}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Sparkles className="size-4 text-muted-foreground" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
