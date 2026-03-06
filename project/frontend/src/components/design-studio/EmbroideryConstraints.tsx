'use client'

import { useTranslations } from 'next-intl'
import { MADEIRA_THREADS, MAX_THREAD_COLORS, type ThreadColor } from '@/lib/embroidery-config'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

interface EmbroideryConstraintsProps {
  currentColor: string
  usedColors: string[]
  onColorSelect: (hex: string) => void
  textSizeMm?: number | null
}

/**
 * Thread color picker and constraint warnings for embroidery products.
 * Replaces the generic color picker + gradient editor when editing embroidered items.
 */
export function EmbroideryConstraints({
  currentColor,
  usedColors,
  onColorSelect,
  textSizeMm,
}: EmbroideryConstraintsProps) {
  const t = useTranslations('designEditor.embroidery')
  const atLimit = usedColors.length >= MAX_THREAD_COLORS
  const isSmallText = textSizeMm != null && textSizeMm < 5

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{t('threadColors')}</span>
        <span className={cn('text-xs', atLimit ? 'text-destructive' : 'text-muted-foreground')}>
          {usedColors.length}/{MAX_THREAD_COLORS}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {MADEIRA_THREADS.map((thread: ThreadColor) => {
          const isSelected = currentColor.toLowerCase() === thread.hex.toLowerCase()
          const isUsed = usedColors.some(c => c.toLowerCase() === thread.hex.toLowerCase())
          const isDisabled = atLimit && !isUsed
          return (
            <button
              key={thread.threadCode}
              onClick={() => !isDisabled && onColorSelect(thread.hex)}
              disabled={isDisabled}
              className={cn(
                'size-8 rounded-md border-2 transition-all',
                isSelected
                  ? 'border-primary ring-1 ring-primary/30 scale-110'
                  : isUsed
                    ? 'border-border/70'
                    : 'border-border/30 hover:border-primary/50',
                isDisabled && 'opacity-30 cursor-not-allowed',
              )}
              style={{ backgroundColor: thread.hex }}
              title={`${thread.name} (${thread.threadCode})`}
            />
          )
        })}
      </div>

      {isSmallText && (
        <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 rounded-md p-2">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span>{t('textTooSmall')}</span>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground leading-tight">
        {t('info')}
      </p>
    </div>
  )
}
