'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00',
  '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#FF6B35', '#7C3AED', '#059669', '#DC2626',
  '#2563EB', '#D97706', '#DB2777', '#6366F1',
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const t = useTranslations('designEditor.properties')
  const [hexInput, setHexInput] = useState(value)

  // Sync internal state when prop changes (e.g., switching selected objects)
  useEffect(() => { setHexInput(value) }, [value])

  const handleHexChange = (hex: string) => {
    setHexInput(hex)
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex)
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{t('color')}</Label>
      <div className="grid grid-cols-8 gap-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => {
              onChange(color)
              setHexInput(color)
            }}
            className={cn(
              'size-7 rounded-md border-2 transition-all hover:scale-110',
              value === color ? 'border-primary ring-2 ring-ring' : 'border-border'
            )}
            style={{ backgroundColor: color }}
            aria-label={color}
          />
        ))}
      </div>
      <Input
        value={hexInput}
        onChange={(e) => handleHexChange(e.target.value)}
        placeholder="#000000"
        className="h-8 text-xs font-mono"
      />
    </div>
  )
}
