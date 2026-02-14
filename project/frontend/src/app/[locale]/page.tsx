import { StorefrontLayout } from '@/components/storefront/StorefrontLayout'

/**
 * Homepage - Conversational Storefront (Primary Interface)
 *
 * This is the main customer interface — a three-panel conversational storefront.
 * The chat IS the homepage. No traditional hero banner or landing page.
 *
 * Layout:
 * - Left sidebar (240px): Store navigation + AI recommendations
 * - Center chat area: Message history + input
 * - Right detail panel (340px): Expanded product details (activated on click)
 */

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return <StorefrontLayout />
}
