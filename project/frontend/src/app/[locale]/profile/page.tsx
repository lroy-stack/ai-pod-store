import { getTranslations } from 'next-intl/server';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { unstable_setRequestLocale } from 'next-intl/server';

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
  unstable_setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Profile' });

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-card rounded-lg shadow-sm border border-border p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {t('title')}
            </h1>
            <p className="text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>

          <ProfileForm locale={locale} />
        </div>
      </div>
    </div>
  );
}
