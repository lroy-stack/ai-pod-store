'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import Autoplay from 'embla-carousel-autoplay'
import {
  ArrowRight,
  Sparkles,
  MessageCircle,
  Palette,
  Package,
  Star,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Testimonials } from '@/components/landing/Testimonials'
import { NewsletterSignup } from '@/components/landing/NewsletterSignup'
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { BrandMark } from '@/components/ui/brand-mark'

const MetaballsBackground = dynamic(
  () => import('@/components/landing/MetaballsBackground').then((mod) => ({ default: mod.MetaballsBackground })),
  { ssr: false }
)

import type { ProductBase } from '@/types/product'

interface Product extends ProductBase {
  rating: number
  compareAtPrice?: number
}

interface Review {
  id: string
  rating: number
  title: string | null
  body: string | null
  user_name: string | null
  is_verified_purchase: boolean
  created_at: string
}

interface LandingPageClientProps {
  locale: string
  initialProducts: Product[]
  reviews: Review[]
  totalOrders: number
  averageRating: number
}

function useScrollReveal() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, visible }
}

export function LandingPageClient({
  locale,
  initialProducts,
  reviews,
  totalOrders,
  averageRating,
}: LandingPageClientProps) {
  const t = useTranslations('landing')
  const [products] = useState<Product[]>(initialProducts)

  const howSection = useScrollReveal()
  const showcaseSection = useScrollReveal()
  const ctaSection = useScrollReveal()

  const steps = [
    { icon: MessageCircle, title: t('step1Title'), desc: t('step1Desc'), num: '01' },
    { icon: Palette, title: t('step2Title'), desc: t('step2Desc'), num: '02' },
    { icon: Package, title: t('step3Title'), desc: t('step3Desc'), num: '03' },
  ]

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 min-h-dvh">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {/* CSS gradient fallback — visible instantly while WebGL loads */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background: 'radial-gradient(ellipse at 30% 50%, var(--primary) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, var(--chart-2) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, var(--chart-5) 0%, transparent 50%), var(--background)',
            }}
          />
          <MetaballsBackground />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-40 shader-fade-bottom pointer-events-none" aria-hidden="true" />

        <div className="relative z-10 flex flex-col items-center max-w-4xl">
          <div className="bg-card/50 backdrop-blur-2xl border border-border/60 rounded-3xl shadow-xl ring-1 ring-foreground/10 px-8 py-10 md:px-12 md:py-12 flex flex-col items-center">
            <div className="mb-8 landing-float">
              <BrandMark size={56} />
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] text-balance text-foreground">
              {t('heroTitle')}
            </h1>

            <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl text-balance leading-relaxed">
              {t('heroSubtitle')}
            </p>

            <Button
              size="lg"
              className="mt-10 rounded-full text-sm md:text-base px-8 md:px-10 py-3 md:py-3.5 h-auto shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 hover:scale-[1.02]"
              asChild
            >
              <Link href={`/${locale}/chat`}>
                {t('heroCTA')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <p className="mt-4 text-xs text-muted-foreground">{t('heroSubCTA')}</p>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-40 z-10">
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section
        ref={howSection.ref as React.RefObject<HTMLElement>}
        className={cn(
          'px-6 py-24 md:py-32 transition-all duration-700 ease-out',
          howSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        )}
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-3xl md:text-4xl font-bold mb-4">
            {t('howItWorks')}
          </h2>
          <p className="text-center text-muted-foreground mb-16 max-w-lg mx-auto">
            {t('howItWorksSubtitle')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {steps.map((step) => (
              <Card
                key={step.num}
                className="relative overflow-hidden border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <CardContent className="p-8 pt-10">
                  <span className="absolute top-3 right-5 text-5xl font-bold text-muted-foreground/10 select-none">
                    {step.num}
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Product Showcase ─── */}
      <section
        ref={showcaseSection.ref as React.RefObject<HTMLElement>}
        className={cn(
          'px-6 py-24 md:py-32 bg-muted/30 transition-all duration-700 ease-out',
          showcaseSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        )}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-3xl md:text-4xl font-bold">{t('seasonalPicks')}</h2>
          </div>
          <p className="text-muted-foreground mb-12">{t('showcaseSubtitle')}</p>

          {products.length > 0 ? (
            <Carousel
              opts={{ align: 'start', loop: true }}
              plugins={[Autoplay({ delay: 4500, stopOnInteraction: true })]}
              className="w-full"
            >
              <CarouselContent className="-ml-6">
                {products.map((product, index) => (
                  <CarouselItem
                    key={product.id}
                    className="basis-[80%] md:basis-1/2 lg:basis-1/3 pl-6"
                  >
                    <Link
                      href={`/${locale}/shop/${product.id}`}
                      className="group block rounded-2xl bg-card overflow-hidden border border-border/40 hover:border-border/80 shadow-sm hover:shadow-xl transition-all duration-300"
                    >
                      <div className="relative aspect-square bg-muted overflow-hidden">
                        {product.image ? (
                          <Image
                            src={product.image}
                            alt={product.title}
                            fill
                            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                            sizes="(max-width: 768px) 80vw, (max-width: 1024px) 50vw, 33vw"
                            priority={index < 3}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Palette className="h-12 w-12 text-muted-foreground/20" />
                          </div>
                        )}
                      </div>
                      <div className="px-3.5 py-3 space-y-2">
                        <h3 className="font-medium text-sm leading-snug line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                          {product.title}
                        </h3>
                        <div className="flex items-center justify-between">
                          {product.compareAtPrice ? (
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] line-through text-muted-foreground">
                                  {formatPrice(product.compareAtPrice, locale, product.currency || 'EUR')}
                                </span>
                                {(() => {
                                  const pct = Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
                                  return pct > 0 ? (
                                    <Badge variant="destructive" className="text-[10px] leading-none px-1 py-0.5">-{pct}%</Badge>
                                  ) : null
                                })()}
                              </div>
                              <span className="text-sm font-bold text-destructive tracking-tight">
                                {formatPrice(product.price, locale, product.currency || 'EUR')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-foreground tracking-tight">
                              {formatPrice(product.price, locale, product.currency || 'EUR')}
                            </span>
                          )}
                          {product.rating > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Star className="h-3 w-3 fill-rating text-rating" />
                              {product.rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex -left-5" />
              <CarouselNext className="hidden md:flex -right-5" />
            </Carousel>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-card overflow-hidden border border-border/40">
                  <Skeleton className="aspect-square w-full" />
                  <div className="px-3.5 py-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <Testimonials
        reviews={reviews}
        totalOrders={totalOrders}
        averageRating={averageRating}
      />

      {/* ─── Newsletter Signup ─── */}
      <section className="px-6 py-24 md:py-32 bg-muted/20">
        <NewsletterSignup locale={locale as 'en' | 'es' | 'de'} />
      </section>

      {/* ─── Final CTA ─── */}
      <section
        ref={ctaSection.ref as React.RefObject<HTMLElement>}
        className={cn(
          'px-6 py-24 md:py-32 text-center bg-muted/30 transition-all duration-700 ease-out',
          ctaSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        )}
      >
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-balance mb-6">
            {t('finalCTATitle')}
          </h2>
          <p className="text-lg text-muted-foreground text-balance mb-10">
            {t('finalCTASubtitle')}
          </p>
          <Button
            size="lg"
            className="rounded-full text-sm md:text-base px-8 md:px-10 py-3 md:py-3.5 h-auto shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 hover:scale-[1.02]"
            asChild
          >
            <Link href={`/${locale}/chat`}>
              {t('finalCTA')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  )
}
