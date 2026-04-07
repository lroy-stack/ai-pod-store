'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, Copy, FlipHorizontal2, FlipVertical2, Eraser, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { useDesignEditor } from '@/hooks/useDesignEditor'
import { TextTool } from './tools/TextTool'
import { ImageTool } from './tools/ImageTool'
import { LayersPanel } from './LayersPanel'
import { TemplatesPanel } from './TemplatesPanel'
import { ClipartPanel } from './ClipartPanel'
import { MyDesignsPanel } from './MyDesignsPanel'
import type { FillMode } from './tools/GradientEditor'

interface CanvasPropertiesProps {
  onAddText: (text: string) => void
  onAddImage: (url: string) => Promise<void>
  onAddSVG?: (svgText: string) => Promise<void>
  onApplyTemplate?: (fabricJson: object) => void
  productType?: string
  onRemoveSelected: () => void
  onDuplicateSelected: () => void
  // Text property change handlers
  onFontChange?: (font: string) => void
  onFontSizeChange?: (size: number) => void
  onColorChange?: (color: string) => void
  onAlignChange?: (align: string) => void
  onBoldToggle?: () => void
  onItalicToggle?: () => void
  // Text effect handlers
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
  // Opacity
  onOpacityChange?: (opacity: number) => void
  // Transform
  onFlipH?: () => void
  onFlipV?: () => void
  onRotate?: (angle: number) => void
  // Layers
  onBringForward?: () => void
  onSendBackward?: () => void
  onBringToFront?: () => void
  onSendToBack?: () => void
  onToggleVisibility?: (id: string, visible: boolean) => void
  onToggleLock?: (id: string, locked: boolean) => void
  onReplaceSelectedImage?: (newUrl: string) => void
  onUploadSuccess?: () => void
}

export function CanvasProperties({
  onAddText,
  onAddImage,
  onAddSVG,
  onApplyTemplate,
  productType,
  onRemoveSelected,
  onDuplicateSelected,
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
  onOpacityChange,
  onFlipH,
  onFlipV,
  onRotate,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onToggleVisibility,
  onToggleLock,
  onReplaceSelectedImage,
  onUploadSuccess,
}: CanvasPropertiesProps) {
  const t = useTranslations('designEditor')
  const { activeTool, selectedObject } = useDesignEditor()
  const [removingBg, setRemovingBg] = useState(false)

  const handleRemoveBg = async () => {
    if (!selectedObject || selectedObject.type !== 'image' || !selectedObject.src) return
    setRemovingBg(true)
    try {
      const res = await apiFetch('/api/designs/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: selectedObject.src }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Background removal failed')
      }
      const data = await res.json()
      if (data.imageUrl && onReplaceSelectedImage) {
        onReplaceSelectedImage(data.imageUrl)
        toast.success(t('properties.bgRemoved') || 'Background removed')
      }
    } catch (err) {
      console.error('BG removal error:', err)
      toast.error(t('properties.bgRemoveFailed') || 'Failed to remove background')
    } finally {
      setRemovingBg(false)
    }
  }

  return (
    <div className="w-full lg:w-64 border-l border-border bg-card overflow-y-auto shrink-0">
      {/* Selected object actions */}
      {selectedObject && (
        <div className="p-3 border-b border-border space-y-3">
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={onDuplicateSelected}
            >
              <Copy className="size-3.5" />
              {t('properties.duplicate')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-destructive hover:text-destructive"
              onClick={onRemoveSelected}
            >
              <Trash2 className="size-3.5" />
              {t('properties.delete')}
            </Button>
          </div>
          {/* Flip buttons */}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={onFlipH}
            >
              <FlipHorizontal2 className="size-3.5" />
              {t('properties.flipH')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={onFlipV}
            >
              <FlipVertical2 className="size-3.5" />
              {t('properties.flipV')}
            </Button>
          </div>
          {/* Rotation slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t('properties.rotation')}</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{Math.round(selectedObject.angle)}°</span>
            </div>
            <Slider
              value={[selectedObject.angle]}
              min={0}
              max={360}
              step={1}
              onValueChange={([val]) => onRotate?.(val)}
            />
          </div>
          {/* Opacity slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t('properties.opacity')}</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{selectedObject.opacity ?? 100}%</span>
            </div>
            <Slider
              value={[selectedObject.opacity ?? 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([val]) => onOpacityChange?.(val / 100)}
            />
          </div>
        </div>
      )}

      {/* Tool-specific panel */}
      {activeTool === 'text' && (
        <TextTool
          onAddText={onAddText}
          selectedText={selectedObject?.type === 'text' ? selectedObject.text : undefined}
          selectedFont={selectedObject?.type === 'text' ? selectedObject.fontFamily : undefined}
          selectedFontSize={selectedObject?.type === 'text' ? selectedObject.fontSize : undefined}
          selectedColor={selectedObject?.type === 'text' ? (selectedObject.fill || '#000000') : undefined}
          selectedAlign={selectedObject?.type === 'text' ? selectedObject.textAlign : undefined}
          selectedBold={selectedObject?.type === 'text' ? selectedObject.fontWeight === 'bold' : undefined}
          selectedItalic={selectedObject?.type === 'text' ? selectedObject.fontStyle === 'italic' : undefined}
          shadowEnabled={selectedObject?.type === 'text' ? selectedObject.shadow != null : undefined}
          shadowColor={selectedObject?.type === 'text' ? selectedObject.shadow?.color : undefined}
          shadowBlur={selectedObject?.type === 'text' ? selectedObject.shadow?.blur : undefined}
          shadowOffsetX={selectedObject?.type === 'text' ? selectedObject.shadow?.offsetX : undefined}
          shadowOffsetY={selectedObject?.type === 'text' ? selectedObject.shadow?.offsetY : undefined}
          outlineEnabled={selectedObject?.type === 'text' ? (selectedObject.strokeWidth ?? 0) > 0 : undefined}
          outlineColor={selectedObject?.type === 'text' ? selectedObject.stroke : undefined}
          outlineWidth={selectedObject?.type === 'text' ? selectedObject.strokeWidth : undefined}
          onFontChange={onFontChange}
          onFontSizeChange={onFontSizeChange}
          onColorChange={onColorChange}
          onAlignChange={onAlignChange}
          onBoldToggle={onBoldToggle}
          onItalicToggle={onItalicToggle}
          onShadowToggle={onShadowToggle}
          onShadowColorChange={onShadowColorChange}
          onShadowBlurChange={onShadowBlurChange}
          onShadowOffsetXChange={onShadowOffsetXChange}
          onShadowOffsetYChange={onShadowOffsetYChange}
          onOutlineToggle={onOutlineToggle}
          onOutlineColorChange={onOutlineColorChange}
          onOutlineWidthChange={onOutlineWidthChange}
          onFillModeChange={onFillModeChange}
          onGradientStartColorChange={onGradientStartColorChange}
          onGradientEndColorChange={onGradientEndColorChange}
          onGradientAngleChange={onGradientAngleChange}
        />
      )}

      {activeTool === 'image' && (
        <ImageTool onImageAdd={onAddImage} onSVGAdd={onAddSVG} onUploadSuccess={onUploadSuccess} />
      )}

      {activeTool === 'layers' && (
        <LayersPanel
          onBringForward={onBringForward || (() => {})}
          onSendBackward={onSendBackward || (() => {})}
          onBringToFront={onBringToFront || (() => {})}
          onSendToBack={onSendToBack || (() => {})}
          onToggleVisibility={onToggleVisibility || (() => {})}
          onToggleLock={onToggleLock || (() => {})}
        />
      )}

      {activeTool === 'templates' && (
        <TemplatesPanel
          onApplyTemplate={onApplyTemplate || (() => {})}
          onAddImage={onAddImage}
          productType={productType}
        />
      )}

      {activeTool === 'clipart' && (
        <ClipartPanel
          onAddClipart={onAddSVG ? (svg: string) => { onAddSVG(svg) } : () => {}}
        />
      )}

      {activeTool === 'my-designs' && (
        <MyDesignsPanel
          onAddDesignImage={onAddImage}
        />
      )}

      {activeTool === 'select' && !selectedObject && (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          {t('tools.select')}
        </div>
      )}

      {activeTool === 'select' && selectedObject?.type === 'image' && (
        <div className="p-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            {Math.round(selectedObject.width)} × {Math.round(selectedObject.height)}px
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            disabled={removingBg || !selectedObject.src}
            onClick={handleRemoveBg}
          >
            {removingBg ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Eraser className="size-3.5" />
            )}
            {removingBg
              ? (t('properties.removingBg') || 'Removing...')
              : (t('properties.removeBg') || 'Remove Background')}
          </Button>
        </div>
      )}
    </div>
  )
}
