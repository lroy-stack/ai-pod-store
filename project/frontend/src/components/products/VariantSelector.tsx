'use client'

import { cn } from '@/lib/utils'

interface VariantSelectorProps {
  allSizes?: string[]
  allColors?: string[]
  availableSizes?: Set<string>
  availableColors?: Set<string>
  selectedSize: string
  selectedColor: string
  /** Called with the clicked size value. Parent decides toggle behavior. */
  onSizeChange: (size: string) => void
  /** Called with the clicked color value. Parent decides toggle behavior. */
  onColorChange: (color: string) => void
  sizeLabel?: string
  colorLabel?: string
}

export function VariantSelector({
  allSizes,
  allColors,
  availableSizes,
  availableColors,
  selectedSize,
  selectedColor,
  onSizeChange,
  onColorChange,
  sizeLabel,
  colorLabel,
}: VariantSelectorProps) {
  const hasSizes = (allSizes?.length ?? 0) > 0
  const hasColors = (allColors?.length ?? 0) > 0

  if (!hasSizes && !hasColors) return null

  return (
    <div className="space-y-3">
      {hasSizes && (
        <div>
          {sizeLabel && (
            <label className="text-[13px] font-medium text-foreground/80 mb-2 block">
              {sizeLabel}
            </label>
          )}
          <div className="flex flex-wrap gap-1.5">
            {allSizes!.map((size) => {
              const isAvailable = !availableSizes || availableSizes.has(size)
              return (
                <button
                  key={size}
                  onClick={() => isAvailable && onSizeChange(size)}
                  disabled={!isAvailable}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all duration-200',
                    !isAvailable
                      ? 'opacity-40 cursor-not-allowed line-through border-border/40 text-muted-foreground'
                      : selectedSize === size
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-transparent text-foreground border-border/60 hover:border-border'
                  )}
                >
                  {size}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {hasColors && (
        <div>
          {colorLabel && (
            <label className="text-[13px] font-medium text-foreground/80 mb-2 block">
              {colorLabel}
            </label>
          )}
          <div className="flex flex-wrap gap-1.5">
            {allColors!.map((color) => {
              const isAvailable = !availableColors || availableColors.has(color)
              return (
                <button
                  key={color}
                  onClick={() => isAvailable && onColorChange(color)}
                  disabled={!isAvailable}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all duration-200',
                    !isAvailable
                      ? 'opacity-40 cursor-not-allowed line-through border-border/40 text-muted-foreground'
                      : selectedColor === color
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-transparent text-foreground border-border/60 hover:border-border'
                  )}
                >
                  {color}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
