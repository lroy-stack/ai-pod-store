'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  title: string
  price: number
  currency: string
  rating: number
  image: string | null
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

export default function LandingPage() {
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('landing')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const howSection = useScrollReveal()
  const showcaseSection = useScrollReveal()
  const ctaSection = useScrollReveal()

  useEffect(() => {
    const month = new Date().getMonth()
    let sort = 'featured'
    if (month >= 11 || month <= 1) sort = 'topRated'
    else if (month >= 2 && month <= 4) sort = 'newest'

    fetch(`/api/products?sort=${sort}&limit=12&locale=${locale}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.items) setProducts(data.items)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [locale])

  const steps = [
    { icon: MessageCircle, title: t('step1Title'), desc: t('step1Desc'), num: '01' },
    { icon: Palette, title: t('step2Title'), desc: t('step2Desc'), num: '02' },
    { icon: Package, title: t('step3Title'), desc: t('step3Desc'), num: '03' },
  ]

  return (
    <div className="flex flex-col">
      {/* ─── Hero ─── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 min-h-dvh">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,90vw)] aspect-square rounded-full bg-primary/[0.04] blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center max-w-4xl">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-10 landing-float shadow-lg shadow-primary/20">
            <span className="text-primary-foreground font-bold text-2xl">P</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] text-balance landing-gradient-text">
            {t('heroTitle')}
          </h1>

          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl text-balance leading-relaxed">
            {t('heroSubtitle')}
          </p>

          <Button
            size="lg"
            className="mt-12 rounded-full text-base md:text-lg px-10 md:px-14 py-6 md:py-7 h-auto shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-[1.03]"
            asChild
          >
            <Link href={`/${locale}/chat`}>
              {t('heroCTA')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>

          <p className="mt-5 text-sm text-muted-foreground">{t('heroSubCTA')}</p>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-40">
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

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-0">
                    <Skeleton className="aspect-[4/5] w-full" />
                    <div className="p-5 space-y-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : products.length > 0 ? (
            <Carousel
              opts={{ align: 'start', loop: true }}
              plugins={[Autoplay({ delay: 4500, stopOnInteraction: true })]}
              className="w-full"
            >
              <CarouselContent className="-ml-6">
                {products.map((product) => (
                  <CarouselItem
                    key={product.id}
                    className="basis-[80%] md:basis-1/2 lg:basis-1/3 pl-6"
                  >
                    <Link href={`/${locale}/shop/${product.id}`} className="group block">
                      <Card className="overflow-hidden border-border/50 group-hover:border-primary/20 group-hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1">
                        <CardContent className="p-0">
                          <div className="aspect-[4/5] relative bg-muted overflow-hidden">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Palette className="h-12 w-12 text-muted-foreground/20" />
                              </div>
                            )}
                          </div>
                          <div className="p-5">
                            <p className="font-medium line-clamp-1">{product.title}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-semibold">
                                {formatPrice(product.price, locale, product.currency || 'EUR')}
                              </span>
                              {product.rating > 0 && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Star className="h-3.5 w-3.5 fill-current" />
                                  {product.rating.toFixed(1)}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex -left-5" />
              <CarouselNext className="hidden md:flex -right-5" />
            </Carousel>
          ) : null}
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section
        ref={ctaSection.ref as React.RefObject<HTMLElement>}
        className={cn(
          'px-6 py-24 md:py-32 text-center transition-all duration-700 ease-out',
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
            className="rounded-full text-base md:text-lg px-10 md:px-14 py-6 md:py-7 h-auto shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-[1.03]"
            asChild
          >
            <Link href={`/${locale}/chat`}>
              {t('finalCTA')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="px-6 py-8 border-t border-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-[10px]">P</span>
          </div>
          <span>&copy; {new Date().getFullYear()} POD AI</span>
        </div>
      </footer>
    </div>
  )
}
