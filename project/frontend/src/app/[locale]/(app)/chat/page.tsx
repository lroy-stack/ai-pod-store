import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'storefront' })
  return {
    title: t('chatMetaTitle'),
    description: t('chatMetaDescription'),
  }
}

/**
 * /chat — AI Chat Interface
 *
 * ChatArea lives in StorefrontLayout (always mounted, CSS visibility toggle).
 * This page renders null — the layout handles showing ChatArea when pathname is /chat.
 */
export default function ChatPage() {
  return null
}
