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

const LOCALES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
]

export function Footer() {
  const t = useTranslations()
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  const handleLocaleChange = (newLocale: string) => {
    // Replace the locale in the current path
    const pathWithoutLocale = pathname.replace(`/${locale}`, '')
    router.push(`/${newLocale}${pathWithoutLocale}`)
  }

  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand & Description */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">PodClaw</h3>
            <p className="text-sm text-muted-foreground">
              {t('footer.description', {
                defaultValue:
                  'AI-powered print-on-demand storefront. Design, customize, and order unique products.',
              })}
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter"
                >
                  <Twitter className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>

          {/* Shop Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">
              {t('footer.shop', { defaultValue: 'Shop' })}
            </h4>
            <nav className="flex flex-col space-y-2 text-sm">
              <Link
                href={`/${locale}/shop`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('footer.allProducts', { defaultValue: 'All Products' })}
              </Link>
              <Link
                href={`/${locale}/shop?category=apparel`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('footer.apparel', { defaultValue: 'Apparel' })}
              </Link>
              <Link
                href={`/${locale}/shop?category=accessories`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('footer.accessories', { defaultValue: 'Accessories' })}
              </Link>
              <Link
                href={`/${locale}/shop?category=home`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('footer.home', { defaultValue: 'Home & Living' })}
              </Link>
            </nav>
          </div>

          {/* Company Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">
              {t('footer.company', { defaultValue: 'Company' })}
            </h4>
            <nav className="flex flex-col space-y-2 text-sm">
              <Link
                href={`/${locale}/about`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('footer.about', { defaultValue: 'About Us' })}
              </Link>
              <Link
                href={`/${locale}/contact`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('footer.contact', { defaultValue: 'Contact' })}
              </Link>
              <Link
                href={`/${locale}/faq`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('footer.faq', { defaultValue: 'FAQ' })}
              </Link>
            </nav>
          </div>

          {/* Legal & Language */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">
              {t('footer.legal', { defaultValue: 'Legal' })}
            </h4>
            <nav className="flex flex-col space-y-2 text-sm">
              <Link
                href={`/${locale}/privacy`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('footer.privacy', { defaultValue: 'Privacy Policy' })}
              </Link>
              <Link
                href={`/${locale}/terms`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('footer.terms', { defaultValue: 'Terms of Service' })}
              </Link>
              <Link
                href={`/${locale}/returns`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('footer.returns', { defaultValue: 'Returns & Refunds' })}
              </Link>
              <Link
                href={`/${locale}/shipping`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('footer.shipping', { defaultValue: 'Shipping Policy' })}
              </Link>
            </nav>

            {/* Language Selector */}
            <div className="pt-2">
              <label
                htmlFor="language-select"
                className="text-sm font-semibold text-foreground mb-2 block"
              >
                {t('footer.language', { defaultValue: 'Language' })}
              </label>
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

        <Separator className="my-6" />

        {/* Copyright */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>
            {t('footer.copyright', {
              defaultValue: `© ${currentYear} PodClaw. All rights reserved.`,
              year: currentYear,
            })}
          </p>
          <p className="text-xs">
            {t('footer.powered', {
              defaultValue: 'Powered by AI • Designed with care',
            })}
          </p>
        </div>
      </div>
    </footer>
  )
}
