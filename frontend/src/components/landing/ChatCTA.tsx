'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Send, ShoppingBag, Paintbrush, Search, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'

const TYPING_QUERIES: Record<string, string[]> = {
  en: [
    'Show me trending hoodies',
    'Design a minimalist logo tee',
    'Find gifts under 30 EUR',
    'Track my order',
    'Remove background from my design',
    'What size should I pick?',
  ],
  es: [
    'Muéstrame las sudaderas más populares',
    'Diseña una camiseta con logo minimalista',
    'Encuentra regalos por menos de 30 EUR',
    'Rastrea mi pedido',
    'Quita el fondo de mi diseño',
    '¿Qué talla me recomiendas?',
  ],
  de: [
    'Zeig mir trendige Hoodies',
    'Gestalte ein minimalistisches Logo-T-Shirt',
    'Geschenke unter 30 EUR finden',
    'Meine Bestellung verfolgen',
    'Hintergrund meines Designs entfernen',
    'Welche Größe passt mir?',
  ],
}

function AnimatedChatBar({ locale }: { locale: string }) {
  const queries = TYPING_QUERIES[locale] ?? TYPING_QUERIES.en
  const [queryIdx, setQueryIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  const currentQuery = queries[queryIdx]

  useEffect(() => {
    if (!deleting && charIdx < currentQuery.length) {
      const timer = setTimeout(() => setCharIdx((c) => c + 1), 45)
      return () => clearTimeout(timer)
    }
    if (!deleting && charIdx === currentQuery.length) {
      const timer = setTimeout(() => setDeleting(true), 2000)
      return () => clearTimeout(timer)
    }
    if (deleting && charIdx > 0) {
      const timer = setTimeout(() => setCharIdx((c) => c - 1), 25)
      return () => clearTimeout(timer)
    }
    if (deleting && charIdx === 0) {
      setDeleting(false)
      setQueryIdx((i) => (i + 1) % queries.length)
    }
  }, [charIdx, deleting, currentQuery.length, queries.length])

  return (
    <div className="w-full max-w-md mx-auto rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-foreground flex-1 truncate">
        {currentQuery.slice(0, charIdx)}
        <span className="inline-block w-0.5 h-4 bg-primary align-middle animate-pulse ml-0.5" />
      </span>
      <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
        <Send className="h-3.5 w-3.5 text-primary-foreground" />
      </div>
    </div>
  )
}

interface ChatCTAProps {
  locale: string
}

export function ChatCTA({ locale }: ChatCTAProps) {
  const t = useTranslations('landing')

  const features = [
    { icon: ShoppingBag, label: t('chatFeature1') },
    { icon: Paintbrush, label: t('chatFeature2') },
    { icon: Package, label: t('chatFeature3') },
  ]

  return (
    <section className="px-6 py-16 md:py-24">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <div className="space-y-3">
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">
            {t('chatCtaTitle')}
          </h2>
          <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto">
            {t('chatCtaSubtitle')}
          </p>
        </div>

        <AnimatedChatBar locale={locale} />

        <div className="flex items-center justify-center gap-6 md:gap-8">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4 text-primary" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <Button size="lg" asChild>
          <Link href={`/${locale}/chat`}>
            {t('chatCtaButton')}
          </Link>
        </Button>
      </div>
    </section>
  )
}
