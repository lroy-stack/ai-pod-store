import { getTranslations } from 'next-intl/server';
import { BillingSettings } from '@/components/billing/BillingSettings';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Billing' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

interface BillingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function BillingPage({ params }: BillingPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Billing' });

  return (
    <div className="py-8 md:py-12">
      <div className="container mx-auto px-4 md:px-0 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl">{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <BillingSettings locale={locale} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
