import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Checkout' })

  return {
    title: t('cancelTitle'),
    description: t('cancelDescription'),
  }
}

export default async function CheckoutCancelPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Checkout' })

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Cancel Icon */}
        <div className="flex justify-center">
          <div className="size-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="size-12 text-destructive" />
          </div>
        </div>

        {/* Cancel Message */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            {t('cancelTitle')}
          </h1>
          <p className="text-muted-foreground">
            {t('cancelMessage')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-4">
          <Button asChild size="lg">
            <Link href={`/${locale}/cart`}>
              {t('cancelReturnToCart')}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${locale}/shop`}>
              {t('cancelContinueShopping')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
