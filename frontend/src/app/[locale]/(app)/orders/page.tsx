import { getTranslations } from 'next-intl/server'
import OrdersView from '@/components/orders/OrdersView'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Orders' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <div className="py-8 md:py-12 px-4 md:px-6 lg:px-8">
      <OrdersView locale={locale} />
    </div>
  )
}
