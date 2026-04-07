'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { motion } from 'motion/react'
import { ArrowRight, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { FADE_UP, STAGGER_CONTAINER, STAGGER_ITEM } from '@/hooks/useMotionConfig'

interface DropProduct {
  id: string
  slug: string
  title: string
  price: number
  compare_at_price: number | null
  currency: string
  image: string | null
  rating: number
  is_featured: boolean
}

interface DropCollectionProps {
  products: DropProduct[]
  collectionName: string
  collectionSlug: string
  locale: string
}

export function DropCollection({ products, collectionName, collectionSlug, locale }: DropCollectionProps) {
  const t = useTranslations('landing')

  if (products.length === 0) return null

  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      variants={STAGGER_CONTAINER}
      className="px-6 py-16 md:py-24"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div variants={FADE_UP} className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight font-[family-name:var(--font-display)]">
              {collectionName}
            </h2>
          </div>
          <Link
            href={`/${locale}/shop?collection=${collectionSlug}`}
            className="hidden md:flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {t('viewCollection')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
            <motion.div
              key={product.id}
              variants={STAGGER_ITEM}
              className={cn(
                product.is_featured && 'col-span-2 row-span-2'
              )}
            >
              <Link
                href={`/${locale}/shop/${product.slug}`}
                className="group block rounded-2xl bg-card overflow-hidden border border-border/40 hover:border-border/80 shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <div className={cn(
                  'relative bg-muted overflow-hidden',
                  product.is_featured ? 'aspect-[3/4]' : 'aspect-square'
                )}>
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.title}
                      fill
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                      sizes={product.is_featured
                        ? '(max-width: 768px) 100vw, (max-width: 1024px) 66vw, 50vw'
                        : '(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'
                      }
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-muted-foreground/30 text-4xl font-bold font-[family-name:var(--font-display)]">S</span>
                    </div>
                  )}
                  {/* Badges: discount takes priority, then featured */}
                  {product.compare_at_price && product.compare_at_price > product.price ? (
                    <Badge
                      variant="destructive"
                      className="absolute top-3 left-3 text-[10px] tracking-wider uppercase font-semibold"
                    >
                      -{Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)}%
                    </Badge>
                  ) : product.is_featured ? (
                    <Badge
                      variant="secondary"
                      className="absolute top-3 left-3 text-[10px] tracking-wider uppercase"
                    >
                      Featured
                    </Badge>
                  ) : null}
                </div>
                <div className="px-3 py-3 sm:px-4 sm:py-3.5 space-y-1.5">
                  <h3 className="font-medium text-sm leading-snug line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                    {product.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {product.compare_at_price && product.compare_at_price > product.price ? (
                        <>
                          <span className="text-xs line-through text-muted-foreground">
                            {formatPrice(product.compare_at_price, locale, product.currency || 'EUR')}
                          </span>
                          <span className="text-sm font-semibold text-destructive tracking-tight">
                            {formatPrice(product.price, locale, product.currency || 'EUR')}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-semibold text-foreground tracking-tight">
                          {formatPrice(product.price, locale, product.currency || 'EUR')}
                        </span>
                      )}
                    </div>
                    {product.rating > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Star className="h-3 w-3 fill-rating text-rating" />
                        {product.rating.toFixed(1)}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Mobile View All */}
        <div className="mt-8 text-center md:hidden">
          <Link
            href={`/${locale}/shop?collection=${collectionSlug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
          >
            {t('viewCollection')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </motion.section>
  )
}
