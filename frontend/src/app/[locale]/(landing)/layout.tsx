'use client'

import { useTranslations } from 'next-intl'

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common')

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:ring-2 focus:ring-ring"
      >
        {t('skipToContent')}
      </a>
      <main id="main-content" className="min-h-dvh bg-background text-foreground overflow-x-hidden">
        {children}
      </main>
    </>
  )
}
