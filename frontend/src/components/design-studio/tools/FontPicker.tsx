'use client'

import { useTranslations } from 'next-intl'
import { AVAILABLE_FONTS } from '@/lib/fabric-init'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FontPickerProps {
  value: string
  onChange: (font: string) => void
}

export function FontPicker({ value, onChange }: FontPickerProps) {
  const t = useTranslations('designEditor.properties')

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{t('font')}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder={t('selectFont')} />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_FONTS.map((font) => (
            <SelectItem key={font} value={font}>
              <span style={{ fontFamily: font }}>{font}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
