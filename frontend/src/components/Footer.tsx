'use client'

/**
 * Footer component for secondary pages (shop, profile, orders, admin)
 * NOT used on the conversational storefront homepage (full viewport)
 *
 * Contains:
 * - Navigation links (Shop categories — dynamic from /api/categories)
 * - Policy links (Privacy, Terms, Returns)
 * - Social media icons
 * - Language selector
 */

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Facebook, Instagram, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { STORE_DEFAULTS, SOCIAL_LINKS } from '@/lib/store-config'
import { BrandMark } from '@/components/ui/brand-mark'
import { clearConsent } from '@/lib/cookie-consent'
import { NewsletterSignup } from '@/components/landing/NewsletterSignup'

interface FooterCategory {
  slug: string
  name: string
  total_product_count: number
}

// Module-level cache — avoids re-fetching on every page navigation (static data)
const categoriesCache: Record<string, { data: FooterCategory[]; ts: number }> = {}
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const LOCALES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
]

export function Footer() {
  const t = useTranslations('footer')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const { setTheme } = useTheme()

  const [categories, setCategories] = useState<FooterCategory[]>([])

  useEffect(() => {
    const cached = categoriesCache[locale]
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setCategories(cached.data)
      return
    }
    fetch(`/api/categories?locale=${locale}`)
      .then((r) => r.json())
      .then((data: FooterCategory[]) => {
        if (Array.isArray(data)) {
          const filtered = data.filter((c) => c.total_product_count > 0)
          categoriesCache[locale] = { data: filtered, ts: Date.now() }
          setCategories(filtered)
        }
      })
      .catch(() => {}) // fail silently — footer still renders without categories
  }, [locale])

  const handleLocaleChange = (newLocale: string) => {
    const pathWithoutLocale = pathname.replace(`/${locale}`, '')
    router.push(`/${newLocale}${pathWithoutLocale}`)
  }

  const currentYear = new Date().getFullYear()

  return (
    <footer className="w-full shrink-0 border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 md:px-8 md:pb-12 md:pt-12">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 md:gap-8">
          {/* Brand & Description */}
          <div className="col-span-2 space-y-4 lg:col-span-1">
            <BrandMark showName size={36} nameHeight={18} />
            <p className="text-sm text-muted-foreground">
              {t('description')}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
                <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <Instagram className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <Facebook className="h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>

          {/* Shop Links — dynamic from /api/categories */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">{t('shop')}</h4>
            <nav className="flex flex-col space-y-2 text-sm">
              <Link href={`/${locale}/shop`} className="text-muted-foreground hover:text-foreground transition-colors">
                {t('allProducts')}
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/${locale}/shop/category/${cat.slug}`}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Company Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">{t('company')}</h4>
            <nav className="flex flex-col space-y-2 text-sm">
              <Link href={`/${locale}/about`} className="text-muted-foreground hover:text-foreground transition-colors">
                {t('about')}
              </Link>
              <Link href={`/${locale}/contact`} className="text-muted-foreground hover:text-foreground transition-colors">
                {t('contact')}
              </Link>
              <Link href={`/${locale}/faq`} className="text-muted-foreground hover:text-foreground transition-colors">
                {t('faq')}
              </Link>
            </nav>
          </div>

          {/* Legal & Language */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">{t('legal')}</h4>
            <nav className="flex flex-col space-y-2 text-sm">
              <Link href={`/${locale}/privacy`} className="text-muted-foreground hover:text-foreground transition-colors">
                {t('privacy')}
              </Link>
              <Link href={`/${locale}/terms`} className="text-muted-foreground hover:text-foreground transition-colors">
                {t('terms')}
              </Link>
              <Link href={`/${locale}/returns`} className="text-muted-foreground hover:text-foreground transition-colors">
                {t('returns')}
              </Link>
              <Link href={`/${locale}/shipping`} className="text-muted-foreground hover:text-foreground transition-colors">
                {t('shipping')}
              </Link>
              <Link href={`/${locale}/legal`} className="text-muted-foreground hover:text-foreground transition-colors">
                {t('legalNotice')}
              </Link>
              <button
                onClick={() => {
                  clearConsent();
                  window.location.reload();
                }}
                className="text-left text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('cookieSettings')}
              </button>
            </nav>

            {/* Language Selector */}
            <div className="pt-2">
              <label htmlFor="language-select" className="mb-2 block text-sm font-semibold text-foreground">
                {t('language')}
              </label>
              <div className="h-10" suppressHydrationWarning>
                <Select value={locale} onValueChange={handleLocaleChange}>
                  <SelectTrigger id="language-select" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALES.map((loc) => (
                      <SelectItem key={loc.code} value={loc.code}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Newsletter Signup */}
        <div className="mt-8 mb-2">
          <NewsletterSignup locale={locale as 'en' | 'es' | 'de'} />
        </div>

        <Separator className="my-6" />

        {/* Payment Methods */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-6 text-muted-foreground px-4">
          <span className="text-xs w-full text-center mb-1">{t('weAccept')}:</span>
          <span className="text-xs font-medium px-2 py-0.5 border border-border rounded">Visa</span>
          <span className="text-xs font-medium px-2 py-0.5 border border-border rounded">Mastercard</span>
          <span className="text-xs font-medium px-2 py-0.5 border border-border rounded">PayPal</span>
          <span className="text-xs font-medium px-2 py-0.5 border border-border rounded">Apple Pay</span>
          <span className="text-xs font-medium px-2 py-0.5 border border-border rounded">Google Pay</span>
        </div>

        {/* Copyright + Theme */}
        <div className="flex flex-col items-center gap-4 text-sm text-muted-foreground md:flex-row md:justify-between">
          <p suppressHydrationWarning>
            {t('copyright', { year: currentYear, storeName: STORE_DEFAULTS.platformName })}
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 rounded-full border border-border p-1">
              <button
                onClick={() => setTheme('light')}
                className="rounded-full p-1.5 transition-colors bg-muted text-foreground dark:bg-transparent dark:text-muted-foreground dark:hover:text-foreground"
                aria-label="Light mode"
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className="rounded-full p-1.5 transition-colors text-muted-foreground hover:text-foreground dark:bg-muted dark:text-foreground"
                aria-label="Dark mode"
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs">{t('powered')}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
