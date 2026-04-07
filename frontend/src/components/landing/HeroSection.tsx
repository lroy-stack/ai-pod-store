'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BrandMark } from '@/components/ui/brand-mark'
import { MetaballsBackground } from '@/components/landing/MetaballsBackground'
import { STORE_DEFAULTS } from '@/lib/store-config'
import type { HeroCampaign } from '@/types/marketing'

interface HeroSectionProps {
  campaign: HeroCampaign | null
  locale: string
}

// Premium entrance easing — aggressive ease-out with slight overshoot feel
const SMOOTH_OUT = [0.16, 1, 0.3, 1] as const

export function HeroSection({ campaign, locale }: HeroSectionProps) {
  const t = useTranslations('landing')

  const title = campaign?.title?.[locale] || campaign?.title?.en || t('fallbackTitle')
  const subtitle = campaign?.subtitle?.[locale] || campaign?.subtitle?.en || ''
  const ctaText = campaign?.cta_text?.[locale] || campaign?.cta_text?.en || t('fallbackCta')
  const ctaUrl = campaign?.cta_url || `/${locale}/shop`
  const subCtaText = campaign?.sub_cta_text?.[locale] || campaign?.sub_cta_text?.en || t('freeShippingBanner', { threshold: STORE_DEFAULTS.freeShippingThreshold })
  const imageUrl = campaign?.image_url || null
  const imageAlt = campaign?.image_alt?.[locale] || campaign?.image_alt?.en || (process.env.NEXT_PUBLIC_SITE_NAME || '')

  const resolvedCtaUrl = ctaUrl.startsWith('/') && !ctaUrl.startsWith(`/${locale}`)
    ? `/${locale}${ctaUrl}`
    : ctaUrl

  // Split title into words for staggered reveal
  const titleWords = title.split(' ')

  return (
    <section className="relative min-h-[85dvh] flex items-center bg-background overflow-hidden px-6 py-16 md:py-24">
      {/* Animated metaballs background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <MetaballsBackground />
      </div>

      {/* Bottom gradient fade into next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 md:h-48 z-[1] pointer-events-none bg-gradient-to-t from-background to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

          {/* ═══ Copy column ═══ */}
          <div className="flex flex-col items-start order-2 lg:order-1">

            {/* Brand mark — early subtle fade */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: SMOOTH_OUT, delay: 0.5 }}
              className="mb-6"
            >
              <BrandMark size={40} />
            </motion.div>

            {/* Title — word-by-word mask reveal */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] text-foreground font-[family-name:var(--font-display)]">
              {titleWords.map((word, i) => (
                <span key={i} className="inline-block overflow-hidden align-bottom mr-[0.25em]">
                  <motion.span
                    className="inline-block"
                    initial={{ y: '110%', rotateX: 45 }}
                    animate={{ y: '0%', rotateX: 0 }}
                    transition={{
                      duration: 0.7,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.6 + i * 0.1,
                    }}
                  >
                    {word}
                  </motion.span>
                </span>
              ))}
            </h1>

            {/* Subtitle badge — slide from left */}
            {subtitle && (
              <motion.div
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease: SMOOTH_OUT, delay: 1.0 }}
                className="mt-5"
              >
                <Badge
                  variant="secondary"
                  className="text-xs sm:text-sm tracking-widest uppercase px-4 py-1.5 font-medium"
                >
                  {subtitle}
                </Badge>
              </motion.div>
            )}

            {/* CTA button — spring scale */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 22,
                delay: 1.15,
              }}
              className="mt-8"
            >
              <Button
                size="lg"
                className="rounded-full text-sm md:text-base px-8 md:px-10 py-3 md:py-3.5 h-auto shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 transition-all duration-300"
                asChild
              >
                <Link href={resolvedCtaUrl}>
                  {ctaText}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>

            {/* Sub-CTA text — gentle fade */}
            {subCtaText && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1.35 }}
                className="mt-4 text-sm text-muted-foreground"
              >
                {subCtaText}
              </motion.p>
            )}
          </div>

          {/* ═══ Product image column ═══ */}
          <div className="relative flex items-center justify-center order-1 lg:order-2">
            {imageUrl ? (
              <motion.div
                className="relative w-full max-w-[280px] sm:max-w-[340px] md:max-w-[450px] lg:max-w-[560px] mx-auto"
                initial={{ opacity: 0, y: 100, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 1.0,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.3,
                }}
              >
                {/* Subtle floating idle after entrance */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{
                    duration: 4,
                    ease: 'easeInOut',
                    repeat: Infinity,
                    delay: 1.5,
                  }}
                >
                  <Image
                    src={imageUrl}
                    alt={imageAlt}
                    width={1200}
                    height={1600}
                    sizes="(max-width: 640px) 280px, (max-width: 768px) 340px, (max-width: 1024px) 450px, 560px"
                    priority
                    quality={90}
                    className="object-contain w-full h-auto drop-shadow-2xl"
                  />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: SMOOTH_OUT, delay: 0.3 }}
                className="w-full aspect-[3/4] max-w-[450px] bg-muted rounded-2xl flex items-center justify-center"
              >
                <BrandMark size={80} />
              </motion.div>
            )}
          </div>

        </div>
      </div>
    </section>
  )
}
