import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Checkout' })

  return {
    title: t('successTitle'),
    description: t('successDescription'),
  }
}

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ session_id?: string }>
}) {
  const { locale } = await params
  const { session_id } = await searchParams

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="size-20 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle className="size-12 text-success" />
          </div>
        </div>

        {/* Success Message */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Payment Successful!
          </h1>
          <p className="text-muted-foreground">
            Your order has been placed successfully. We've sent a confirmation email with your order details.
          </p>
        </div>

        {/* Session ID (for development) */}
        {session_id && (
          <p className="text-xs text-muted-foreground font-mono break-all">
            Session: {session_id}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-4">
          <Button asChild size="lg">
            <Link href={`/${locale}/orders`}>
              View Order
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${locale}/shop`}>
              Continue Shopping
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
