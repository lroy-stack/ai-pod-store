'use client'

import Image from 'next/image'
import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRef, useCallback, useEffect } from 'react'

interface ProductImageGalleryProps {
  images: string[]
  alt: string
  selectedIndex: number
  onSelectIndex: (index: number) => void
  aspectRatio?: 'square' | '4/3'
  sizes?: string
}

export function ProductImageGallery({
  images,
  alt,
  selectedIndex,
  onSelectIndex,
  aspectRatio = '4/3',
  sizes = '(max-width: 1024px) 100vw, 40vw',
}: ProductImageGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isScrolling = useRef(false)

  // Scroll to selected image when index changes programmatically
  useEffect(() => {
    if (isScrolling.current || !scrollRef.current) return
    const container = scrollRef.current
    const target = container.children[selectedIndex] as HTMLElement
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
    }
  }, [selectedIndex])

  // Detect which image is visible after scroll ends
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    isScrolling.current = true

    const container = scrollRef.current
    const scrollLeft = container.scrollLeft
    const width = container.clientWidth
    const newIndex = Math.round(scrollLeft / width)

    if (newIndex !== selectedIndex && newIndex >= 0 && newIndex < images.length) {
      onSelectIndex(newIndex)
    }

    // Reset flag after scroll settles
    clearTimeout((handleScroll as any)._timer)
    ;(handleScroll as any)._timer = setTimeout(() => { isScrolling.current = false }, 150)
  }, [selectedIndex, images.length, onSelectIndex])

  if (images.length === 0) {
    return (
      <div className={cn(
        'w-full rounded-2xl bg-muted overflow-hidden relative',
        aspectRatio === '4/3' ? 'aspect-[4/3]' : 'aspect-square'
      )}>
        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
          <ImageOff className="h-12 w-12" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Swipeable image container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          'flex overflow-x-auto snap-x snap-mandatory scrollbar-hide rounded-2xl bg-muted',
          '-mx-5 px-5' // bleed to panel edges for full-width feel
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {images.map((img, idx) => (
          <div
            key={img}
            className={cn(
              'flex-shrink-0 snap-start relative',
              aspectRatio === '4/3' ? 'aspect-[4/3]' : 'aspect-square',
              'w-full'
            )}
          >
            <Image
              src={img}
              alt={`${alt} ${idx + 1}`}
              fill
              className="object-cover"
              sizes={sizes}
              priority={idx === 0}
            />
          </div>
        ))}
      </div>

      {/* Thumbnails (desktop) + Dots (mobile) */}
      {images.length > 1 && (
        <>
          <div className="hidden md:flex gap-2 overflow-x-auto pb-1">
            {images.map((img, idx) => (
              <button
                key={img}
                onClick={() => onSelectIndex(idx)}
                className={cn(
                  'relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all duration-200 flex-shrink-0',
                  selectedIndex === idx
                    ? 'border-primary'
                    : 'border-border/40 hover:border-border/80'
                )}
              >
                <Image src={img} alt={`${alt} ${idx + 1}`} fill className="object-cover" sizes="56px" />
              </button>
            ))}
          </div>
          <div className="flex md:hidden items-center justify-center gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => onSelectIndex(idx)}
                className="min-w-[28px] min-h-[28px] flex items-center justify-center"
                aria-label={`Image ${idx + 1}`}
              >
                <span className={cn(
                  'w-2 h-2 rounded-full transition-all duration-200',
                  selectedIndex === idx
                    ? 'bg-primary scale-110'
                    : 'bg-muted-foreground/25 hover:bg-muted-foreground/40'
                )} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
