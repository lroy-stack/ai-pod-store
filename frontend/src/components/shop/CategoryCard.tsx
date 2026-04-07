'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ImageOff } from 'lucide-react'

interface CategoryCardProps {
  slug: string
  name: string
  imageUrl: string | null
  productCount: number
  previewImages: string[]
  locale: string
  priority?: boolean
}

export function CategoryCard({
  slug,
  name,
  imageUrl,
  productCount,
  previewImages,
  locale,
  priority,
}: CategoryCardProps) {
  const t = useTranslations('shop')
  const [imgError, setImgError] = useState(false)

  const heroImage = imageUrl || previewImages[0] || null

  return (
    <Link
      href={`/${locale}/shop/category/${slug}`}
      className="group flex flex-col neu-card bg-card overflow-hidden"
    >
      {/* Hero image */}
      <div className="relative aspect-square neu-image overflow-hidden">
        {heroImage && !imgError ? (
          <Image
            src={heroImage}
            alt={name}
            fill
            className="object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            priority={priority}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
            <ImageOff className="h-10 w-10" />
          </div>
        )}

        {/* Gradient overlay — always dark for white text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(0,0,0)]/60 via-[rgb(0,0,0)]/20 to-transparent" />

        {/* Category name + count */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-lg font-bold text-primary-foreground drop-shadow-md">
            {name}
          </h3>
          <p className="text-sm text-primary-foreground/80 drop-shadow-sm">
            {t('productsCount', { count: productCount })}
          </p>
        </div>
      </div>

      {/* Thumbnail previews */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        {previewImages.slice(0, 3).map((img, i) => (
          <div key={i} className="relative w-10 h-10 rounded-md overflow-hidden border border-border flex-shrink-0">
            <Image src={img} alt="" fill className="object-cover" sizes="40px" />
          </div>
        ))}
        {productCount > 3 && (
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-muted-foreground">
              +{productCount - 3}
            </span>
          </div>
        )}
        {previewImages.length === 0 && (
          <div className="h-10 flex items-center">
            <span className="text-xs text-muted-foreground">{t('browseCategory')}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
