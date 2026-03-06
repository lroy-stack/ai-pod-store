'use client'

import Image from 'next/image'
import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const currentImage = images[selectedIndex] || images[0] || null

  return (
    <>
      <div className={cn(
        'w-full rounded-2xl bg-muted overflow-hidden relative group/img',
        aspectRatio === '4/3' ? 'aspect-[4/3]' : 'aspect-square'
      )}>
        {currentImage ? (
          <Image
            src={currentImage}
            alt={alt}
            fill
            className="object-cover group-hover/img:scale-[1.03] transition-transform duration-500 ease-out"
            sizes={sizes}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
            <ImageOff className="h-12 w-12" />
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
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
      )}
    </>
  )
}
