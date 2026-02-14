import { getTranslations } from 'next-intl/server';
import OrderDetailView from '@/components/orders/OrderDetailView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Orders' });

  return {
    title: t('orderDetailTitle'),
    description: t('orderDetailDescription'),
  };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  return (
    <div className="py-8 md:py-12 px-4 md:px-6 lg:px-8">
      <OrderDetailView locale={locale} orderId={id} />
    </div>
  );
}
