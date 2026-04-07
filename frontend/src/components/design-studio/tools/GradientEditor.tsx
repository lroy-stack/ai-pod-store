'use client'

import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { ColorPicker } from './ColorPicker'

export type FillMode = 'solid' | 'linear' | 'radial'

interface GradientEditorProps {
  mode: FillMode
  solidColor: string
  startColor: string
  endColor: string
  angle: number
  onModeChange: (mode: FillMode) => void
  onSolidColorChange: (color: string) => void
  onStartColorChange: (color: string) => void
  onEndColorChange: (color: string) => void
  onAngleChange: (angle: number) => void
}

export function GradientEditor({
  mode,
  solidColor,
  startColor,
  endColor,
  angle,
  onModeChange,
  onSolidColorChange,
  onStartColorChange,
  onEndColorChange,
  onAngleChange,
}: GradientEditorProps) {
  const t = useTranslations('designEditor.effects')

  const modes: FillMode[] = ['solid', 'linear', 'radial']

  return (
    <div className="space-y-2">
      <Label className="text-xs">{t('gradient')}</Label>

      {/* Mode selector */}
      <div className="flex gap-1">
        {modes.map((m) => (
          <Button
            key={m}
            variant={mode === m ? 'default' : 'outline'}
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={() => onModeChange(m)}
          >
            {t(m)}
          </Button>
        ))}
      </div>

      {mode === 'solid' && (
        <ColorPicker value={solidColor} onChange={onSolidColorChange} />
      )}

      {(mode === 'linear' || mode === 'radial') && (
        <div className="space-y-2">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{t('startColor')}</span>
            <ColorPicker value={startColor} onChange={onStartColorChange} />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{t('endColor')}</span>
            <ColorPicker value={endColor} onChange={onEndColorChange} />
          </div>
          {mode === 'linear' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('angle')}</span>
                <span className="text-xs text-muted-foreground w-8 text-right">{angle}°</span>
              </div>
              <Slider value={[angle]} onValueChange={([v]) => onAngleChange(v)} min={0} max={360} step={1} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
