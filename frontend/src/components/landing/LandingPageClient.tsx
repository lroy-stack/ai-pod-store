'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { HeroSection } from '@/components/landing/HeroSection'
import { DropCollection } from '@/components/landing/DropCollection'
import { BrandStatement } from '@/components/landing/BrandStatement'
import { ChatCTA } from '@/components/landing/ChatCTA'
import { MCPInstall } from '@/components/landing/MCPInstall'
import { TrustBar } from '@/components/landing/TrustBar'
import { Testimonials } from '@/components/landing/Testimonials'
import { NewsletterSignup } from '@/components/landing/NewsletterSignup'
import type { HeroCampaign } from '@/types/marketing'

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
  campaign: HeroCampaign | null
  collectionProducts: DropProduct[]
  collectionName: string
  collectionSlug: string
  reviews: Review[]
  totalOrders: number
  averageRating: number
}

export function LandingPageClient({
  locale,
  campaign,
  collectionProducts,
  collectionName,
  collectionSlug,
  reviews,
  totalOrders,
  averageRating,
}: LandingPageClientProps) {
  const searchParams = useSearchParams()

  useEffect(() => {
    const newsletter = searchParams.get('newsletter')
    if (newsletter === 'confirmed') {
      const messages = {
        en: 'Subscription confirmed! Welcome to the club.',
        es: '¡Suscripcion confirmada! Bienvenido/a al club.',
        de: 'Abonnement bestatigt! Willkommen im Club.',
      }
      toast.success(messages[locale as keyof typeof messages] || messages.en)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [searchParams, locale])

  return (
    <>
      {/* Hero — dynamic campaign from DB */}
      <HeroSection campaign={campaign} locale={locale} />

      {/* AI Chat CTA — primary conversion path */}
      <ChatCTA locale={locale} />

      {/* MCP Integration guide — connect from Claude/ChatGPT */}
      <MCPInstall />

      {/* DROP collection grid */}
      {collectionProducts.length > 0 && (
        <DropCollection
          products={collectionProducts}
          collectionName={collectionName}
          collectionSlug={collectionSlug}
          locale={locale}
        />
      )}

      {/* Brand identity statement */}
      <BrandStatement />

      {/* Social proof */}
      <Testimonials
        reviews={reviews}
        totalOrders={totalOrders}
        averageRating={averageRating}
      />

      {/* Trust badges */}
      <TrustBar />

      {/* Newsletter */}
      <section className="px-6 py-16 md:py-24 bg-muted/20 overflow-hidden">
        <NewsletterSignup locale={locale as 'en' | 'es' | 'de'} />
      </section>
    </>
  )
}
