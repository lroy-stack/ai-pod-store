import { redirect } from 'next/navigation'

/**
 * /chat Redirect to Homepage
 *
 * The chat IS the homepage at /[locale]/.
 * This route exists only for backwards compatibility and SEO.
 */

export default async function ChatPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(`/${locale}`)
}
