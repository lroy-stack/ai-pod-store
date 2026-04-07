'use client'

import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ColorPicker } from './ColorPicker'

interface ShadowControlProps {
  enabled: boolean
  color: string
  blur: number
  offsetX: number
  offsetY: number
  onToggle: (enabled: boolean) => void
  onColorChange: (color: string) => void
  onBlurChange: (blur: number) => void
  onOffsetXChange: (x: number) => void
  onOffsetYChange: (y: number) => void
}

export function ShadowControl({
  enabled,
  color,
  blur,
  offsetX,
  offsetY,
  onToggle,
  onColorChange,
  onBlurChange,
  onOffsetXChange,
  onOffsetYChange,
}: ShadowControlProps) {
  const t = useTranslations('designEditor.effects')

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{t('shadow')}</Label>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>

      {enabled && (
        <div className="space-y-2 pl-1">
          <ColorPicker value={color} onChange={onColorChange} />

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('shadowBlur')}</span>
              <span className="text-xs text-muted-foreground w-6 text-right">{blur}</span>
            </div>
            <Slider value={[blur]} onValueChange={([v]) => onBlurChange(v)} min={0} max={30} step={1} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('shadowOffsetX')}</span>
              <span className="text-xs text-muted-foreground w-6 text-right">{offsetX}</span>
            </div>
            <Slider value={[offsetX]} onValueChange={([v]) => onOffsetXChange(v)} min={-20} max={20} step={1} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('shadowOffsetY')}</span>
              <span className="text-xs text-muted-foreground w-6 text-right">{offsetY}</span>
            </div>
            <Slider value={[offsetY]} onValueChange={([v]) => onOffsetYChange(v)} min={-20} max={20} step={1} />
          </div>
        </div>
      )}
    </div>
  )
}
