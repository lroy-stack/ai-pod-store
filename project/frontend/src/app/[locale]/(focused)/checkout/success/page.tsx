import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, Package } from 'lucide-react'
import { getCheckoutSession } from '@/lib/stripe-checkout'
import { LOCALE_FORMAT } from '@/lib/store-config'

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

  // Fetch checkout session details from Stripe
  let sessionDetails = null
  if (session_id) {
    sessionDetails = await getCheckoutSession(session_id)
  }

  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat(LOCALE_FORMAT[locale] || 'en-IE', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  return (
    <div className="min-h-[60vh] py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Success Icon & Message */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="size-20 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="size-12 text-success" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              Payment Successful!
            </h1>
            <p className="text-muted-foreground">
              Your order has been placed successfully. We've sent a confirmation email with your order details.
            </p>
          </div>
        </div>

        {/* Order Details Card */}
        {sessionDetails && sessionDetails.payment_status === 'paid' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="size-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Email */}
              {sessionDetails.customer_email && (
                <div>
                  <p className="text-sm text-muted-foreground">Confirmation sent to:</p>
                  <p className="font-medium">{sessionDetails.customer_email}</p>
                </div>
              )}

              <Separator />

              {/* Line Items */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Items:</p>
                {sessionDetails.line_items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium">
                      {formatCurrency(item.amount_total, sessionDetails.currency)}
                    </p>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Total */}
              <div className="flex justify-between items-center">
                <p className="font-semibold text-lg">Total Paid:</p>
                <p className="font-bold text-2xl text-success">
                  {formatCurrency(sessionDetails.amount_total, sessionDetails.currency)}
                </p>
              </div>

              {/* Order Status */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Payment Status: <span className="font-medium text-success capitalize">{sessionDetails.payment_status}</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Session ID: <span className="font-mono text-xs">{sessionDetails.id}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Session Details */}
        {!sessionDetails && session_id && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>Unable to load order details. Please check your email for confirmation.</p>
              <p className="text-xs mt-2 font-mono break-all">Session: {session_id}</p>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" variant="outline">
            <Link href={`/${locale}/shop`}>
              Continue Shopping
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href={`/${locale}/orders`}>
              View My Orders
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
