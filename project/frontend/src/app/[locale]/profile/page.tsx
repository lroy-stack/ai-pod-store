import { getTranslations } from 'next-intl/server';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { ShippingAddressList } from '@/components/profile/ShippingAddressList';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Profile' });

  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

interface ProfilePageProps {
  params: Promise<{ locale: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Profile' });

  return (
    <div className="py-8 md:py-12">
      <div className="container mx-auto px-4 md:px-0 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl">{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm locale={locale} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <ShippingAddressList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
