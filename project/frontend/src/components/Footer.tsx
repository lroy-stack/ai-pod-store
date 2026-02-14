'use client'

/**
 * Footer component for secondary pages (shop, profile, orders, admin)
 * NOT used on the conversational storefront homepage (full viewport)
 *
 * Contains:
 * - Navigation links (Shop, About, Contact)
 * - Policy links (Privacy, Terms, Returns)
 * - Social media icons
 * - Language selector
 */

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Facebook, Twitter, Instagram, Linkedin } from 'lucide-react'
import { STORE_DEFAULTS } from '@/lib/store-config'

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
            <h3 className="text-lg font-semibold text-foreground">
              {STORE_DEFAULTS.platformName}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('description')}
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <Facebook className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                  <Twitter className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <Instagram className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                  <Linkedin className="h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>

          {/* Shop Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">{t('shop')}</h4>
            <nav className="flex flex-col space-y-2 text-sm">
              <Link href={`/${locale}/shop`} className="text-muted-foreground hover:text-foreground transition-colors">
                {t('allProducts')}
              </Link>
              <Link href={`/${locale}/shop?category=apparel`} className="text-muted-foreground hover:text-foreground transition-colors">
                {t('apparel')}
              </Link>
              <Link href={`/${locale}/shop?category=accessories`} className="text-muted-foreground hover:text-foreground transition-colors">
                {t('accessories')}
              </Link>
              <Link href={`/${locale}/shop?category=home`} className="text-muted-foreground hover:text-foreground transition-colors">
                {t('home')}
              </Link>
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

        <Separator className="my-6" />

        {/* Copyright */}
        <div className="flex flex-col items-center gap-4 text-sm text-muted-foreground md:flex-row md:justify-between">
          <p suppressHydrationWarning>
            {t('copyright', { year: currentYear, storeName: STORE_DEFAULTS.platformName })}
          </p>
          <p className="text-xs">{t('powered')}</p>
        </div>
      </div>
    </footer>
  )
}
