'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { BRAND } from '@/lib/store-config'

export function FocusedFooter() {
  const locale = useLocale()
  const tErr = useTranslations('errors')
  const tFoot = useTranslations('footer')
  const year = new Date().getFullYear()

  return (
    <footer className="w-full shrink-0 pb-6 pt-12">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex flex-col items-center gap-4">
          <Link
            href={`/${locale}/chat`}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 backdrop-blur-sm px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-accent hover:shadow-md"
          >
            <ArrowLeft className="size-4" />
            {tErr('backToStore')}
          </Link>

          <Separator className="max-w-xs" />

          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Link href={`/${locale}/terms`} className="hover:text-foreground transition-colors">{tFoot('terms')}</Link>
            <Link href={`/${locale}/privacy`} className="hover:text-foreground transition-colors">{tFoot('privacy')}</Link>
            <Link href={`/${locale}/returns`} className="hover:text-foreground transition-colors">{tFoot('returns')}</Link>
            <Link href={`/${locale}/shipping`} className="hover:text-foreground transition-colors">{tFoot('shipping')}</Link>
          </nav>

          <p className="text-xs text-muted-foreground/60">
            &copy; {year} {BRAND.name}
          </p>
        </div>
      </div>
    </footer>
  )
}
