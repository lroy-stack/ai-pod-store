'use client'

import { useTranslations } from 'next-intl'
import { Type, ImageIcon, Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useDesignEditor, type LayerInfo } from '@/hooks/useDesignEditor'
import { cn } from '@/lib/utils'

interface LayersPanelProps {
  onBringForward: () => void
  onSendBackward: () => void
  onBringToFront: () => void
  onSendToBack: () => void
  onToggleVisibility: (id: string, visible: boolean) => void
  onToggleLock: (id: string, locked: boolean) => void
}

export function LayersPanel({
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onToggleVisibility,
  onToggleLock,
}: LayersPanelProps) {
  const t = useTranslations('designEditor.layers')
  const { layers, selectedObject } = useDesignEditor()

  if (layers.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        {t('empty')}
      </div>
    )
  }

  // Reverse to show top layers first
  const reversedLayers = [...layers].reverse()

  return (
    <div className="space-y-2 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('title')}
      </h3>

      {/* Z-order controls for selected object */}
      {selectedObject && (
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="size-9" onClick={onBringToFront} title={t('bringToFront')}>
            <ChevronsUp className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="size-9" onClick={onBringForward} title={t('bringForward')}>
            <ChevronUp className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="size-9" onClick={onSendBackward} title={t('sendBackward')}>
            <ChevronDown className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="size-9" onClick={onSendToBack} title={t('sendToBack')}>
            <ChevronsDown className="size-3.5" />
          </Button>
        </div>
      )}

      <Separator />

      {/* Layer list */}
      <div className="space-y-0.5">
        {reversedLayers.map((layer) => {
          const isSelected = selectedObject?.id === layer.id
          const TypeIcon = layer.type === 'text' ? Type : ImageIcon

          return (
            <div
              key={layer.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs',
                isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
              )}
            >
              <TypeIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className={cn('flex-1 truncate', !layer.visible && 'opacity-50')}>
                {layer.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => onToggleVisibility(layer.id, !layer.visible)}
                title={layer.visible ? t('visible') : t('hidden')}
              >
                {layer.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => onToggleLock(layer.id, !layer.locked)}
                title={layer.locked ? t('locked') : t('unlocked')}
              >
                {layer.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
