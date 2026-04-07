'use client'

import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface QuantitySelectorProps {
  quantity: number
  onQuantityChange: (quantity: number) => void
  min?: number
  max?: number
  label?: string
}

export function QuantitySelector({
  quantity,
  onQuantityChange,
  min = 1,
  max = 99,
  label,
}: QuantitySelectorProps) {
  return (
    <div className="flex items-center gap-3">
      {label && (
        <label className="text-[13px] font-medium text-foreground/80">{label}</label>
      )}
      <div className="flex items-center border border-border/60 rounded-lg">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-l-lg rounded-r-none"
          onClick={() => onQuantityChange(Math.max(min, quantity - 1))}
          disabled={quantity <= min}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-10 text-center text-sm font-medium tabular-nums">{quantity}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-r-lg rounded-l-none"
          onClick={() => onQuantityChange(Math.min(max, quantity + 1))}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
