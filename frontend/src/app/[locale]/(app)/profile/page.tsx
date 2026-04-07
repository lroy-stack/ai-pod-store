import { getTranslations } from 'next-intl/server';
import { ProfilePageClient } from '@/components/profile/ProfilePageClient';

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

  return <ProfilePageClient locale={locale} />;
}
