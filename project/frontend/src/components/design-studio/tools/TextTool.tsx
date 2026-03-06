'use client'

import { useTranslations } from 'next-intl'
import { Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { FontPicker } from './FontPicker'
import { ColorPicker } from './ColorPicker'
import { ShadowControl } from './ShadowControl'
import { GradientEditor, type FillMode } from './GradientEditor'
import { EmbroideryConstraints } from '../EmbroideryConstraints'

interface TextToolProps {
  onAddText: (text: string) => void
  // Selected text properties
  selectedText?: string
  selectedFont?: string
  selectedFontSize?: number
  selectedColor?: string
  selectedAlign?: string
  selectedBold?: boolean
  selectedItalic?: boolean
  // Text effects
  shadowEnabled?: boolean
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  outlineEnabled?: boolean
  outlineColor?: string
  outlineWidth?: number
  fillMode?: FillMode
  gradientStartColor?: string
  gradientEndColor?: string
  gradientAngle?: number
  // Change handlers for selected object
  onFontChange?: (font: string) => void
  onFontSizeChange?: (size: number) => void
  onColorChange?: (color: string) => void
  onAlignChange?: (align: string) => void
  onBoldToggle?: () => void
  onItalicToggle?: () => void
  // Effect handlers
  onShadowToggle?: (enabled: boolean) => void
  onShadowColorChange?: (color: string) => void
  onShadowBlurChange?: (blur: number) => void
  onShadowOffsetXChange?: (x: number) => void
  onShadowOffsetYChange?: (y: number) => void
  onOutlineToggle?: (enabled: boolean) => void
  onOutlineColorChange?: (color: string) => void
  onOutlineWidthChange?: (width: number) => void
  onFillModeChange?: (mode: FillMode) => void
  onGradientStartColorChange?: (color: string) => void
  onGradientEndColorChange?: (color: string) => void
  onGradientAngleChange?: (angle: number) => void
  // Curve properties
  curveEnabled?: boolean
  curveAngle?: number
  curveDirection?: 'up' | 'down'
  onCurveToggle?: (enabled: boolean) => void
  onCurveAngleChange?: (angle: number) => void
  onCurveDirectionChange?: (direction: 'up' | 'down') => void
  // Embroidery mode
  isEmbroidery?: boolean
  embroideryUsedColors?: string[]
}

export function TextTool({
  onAddText,
  selectedText,
  selectedFont = 'Inter',
  selectedFontSize = 32,
  selectedColor = '#000000',
  selectedAlign = 'center',
  selectedBold = false,
  selectedItalic = false,
  shadowEnabled = false,
  shadowColor = 'rgba(0,0,0,0.5)',
  shadowBlur = 10,
  shadowOffsetX = 5,
  shadowOffsetY = 5,
  outlineEnabled = false,
  outlineColor = '#000000',
  outlineWidth = 2,
  fillMode = 'solid',
  gradientStartColor = '#ff0000',
  gradientEndColor = '#0000ff',
  gradientAngle = 0,
  onFontChange,
  onFontSizeChange,
  onColorChange,
  onAlignChange,
  onBoldToggle,
  onItalicToggle,
  onShadowToggle,
  onShadowColorChange,
  onShadowBlurChange,
  onShadowOffsetXChange,
  onShadowOffsetYChange,
  onOutlineToggle,
  onOutlineColorChange,
  onOutlineWidthChange,
  onFillModeChange,
  onGradientStartColorChange,
  onGradientEndColorChange,
  onGradientAngleChange,
  curveEnabled = false,
  curveAngle = 180,
  curveDirection = 'up',
  onCurveToggle,
  onCurveAngleChange,
  onCurveDirectionChange,
  isEmbroidery = false,
  embroideryUsedColors = [],
}: TextToolProps) {
  const t = useTranslations('designEditor')

  return (
    <div className="space-y-4 p-3">
      {/* Add new text */}
      <div className="space-y-1.5">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => onAddText(t('text.placeholder'))}
        >
          <Type className="size-4" />
          {t('text.addText')}
        </Button>
      </div>

      {/* Properties for selected text */}
      {selectedText !== undefined && (
        <>
          <FontPicker
            value={selectedFont}
            onChange={(f) => onFontChange?.(f)}
          />

          <div className="space-y-1.5">
            <Label className="text-xs">{t('properties.fontSize')}</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[selectedFontSize]}
                onValueChange={([v]) => onFontSizeChange?.(v)}
                min={12}
                max={120}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8 text-right">{selectedFontSize}</span>
            </div>
          </div>

          {/* Fill: Embroidery thread picker OR Gradient editor */}
          {isEmbroidery ? (
            <EmbroideryConstraints
              currentColor={selectedColor}
              usedColors={embroideryUsedColors}
              onColorSelect={(c) => onColorChange?.(c)}
            />
          ) : (
            <GradientEditor
              mode={fillMode}
              solidColor={selectedColor}
              startColor={gradientStartColor}
              endColor={gradientEndColor}
              angle={gradientAngle}
              onModeChange={(m) => onFillModeChange?.(m)}
              onSolidColorChange={(c) => onColorChange?.(c)}
              onStartColorChange={(c) => onGradientStartColorChange?.(c)}
              onEndColorChange={(c) => onGradientEndColorChange?.(c)}
              onAngleChange={(a) => onGradientAngleChange?.(a)}
            />
          )}

          {/* Alignment */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('properties.alignment')}</Label>
            <div className="flex gap-1">
              {[
                { value: 'left', icon: AlignLeft },
                { value: 'center', icon: AlignCenter },
                { value: 'right', icon: AlignRight },
              ].map(({ value, icon: Icon }) => (
                <Button
                  key={value}
                  variant={selectedAlign === value ? 'default' : 'outline'}
                  size="icon"
                  className="size-8"
                  onClick={() => onAlignChange?.(value)}
                >
                  <Icon className="size-4" />
                </Button>
              ))}
            </div>
          </div>

          {/* Bold / Italic */}
          <div className="flex gap-1">
            <Button
              variant={selectedBold ? 'default' : 'outline'}
              size="icon"
              className="size-8"
              onClick={onBoldToggle}
            >
              <Bold className="size-4" />
            </Button>
            <Button
              variant={selectedItalic ? 'default' : 'outline'}
              size="icon"
              className="size-8"
              onClick={onItalicToggle}
            >
              <Italic className="size-4" />
            </Button>
          </div>

          <Separator />

          {/* Curve */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t('effects.curve')}</Label>
              <Switch checked={curveEnabled} onCheckedChange={(v) => onCurveToggle?.(v)} />
            </div>
            {curveEnabled && (
              <div className="space-y-2 pl-1">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('effects.curveAngle')}</span>
                    <span className="text-xs text-muted-foreground w-10 text-right">{curveAngle}°</span>
                  </div>
                  <Slider
                    value={[curveAngle]}
                    onValueChange={([v]) => onCurveAngleChange?.(v)}
                    min={-360}
                    max={360}
                    step={5}
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={curveDirection === 'up' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => onCurveDirectionChange?.('up')}
                  >
                    {t('effects.curveUp')}
                  </Button>
                  <Button
                    variant={curveDirection === 'down' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => onCurveDirectionChange?.('down')}
                  >
                    {t('effects.curveDown')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {!isEmbroidery && <Separator />}

          {/* Outline (Stroke) — hidden in embroidery mode */}
          {!isEmbroidery && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('effects.outline')}</Label>
                <Switch checked={outlineEnabled} onCheckedChange={(v) => onOutlineToggle?.(v)} />
              </div>
              {outlineEnabled && (
                <div className="space-y-2 pl-1">
                  <ColorPicker value={outlineColor} onChange={(c) => onOutlineColorChange?.(c)} />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('effects.outlineWidth')}</span>
                      <span className="text-xs text-muted-foreground w-6 text-right">{outlineWidth}</span>
                    </div>
                    <Slider
                      value={[outlineWidth]}
                      onValueChange={([v]) => onOutlineWidthChange?.(v)}
                      min={1}
                      max={10}
                      step={0.5}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {!isEmbroidery && <Separator />}

          {/* Shadow — hidden in embroidery mode */}
          {!isEmbroidery && (
            <ShadowControl
              enabled={shadowEnabled}
              color={shadowColor}
              blur={shadowBlur}
              offsetX={shadowOffsetX}
              offsetY={shadowOffsetY}
              onToggle={(v) => onShadowToggle?.(v)}
              onColorChange={(c) => onShadowColorChange?.(c)}
              onBlurChange={(v) => onShadowBlurChange?.(v)}
              onOffsetXChange={(v) => onShadowOffsetXChange?.(v)}
              onOffsetYChange={(v) => onShadowOffsetYChange?.(v)}
            />
          )}
        </>
      )}
    </div>
  )
}
