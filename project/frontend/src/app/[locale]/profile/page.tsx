import { getTranslations } from 'next-intl/server'
import LogoutButton from '@/components/auth/LogoutButton'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Profile' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Profile' })

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
            <LogoutButton locale={locale} />
          </div>

          <div className="bg-card shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-foreground">
                {t('profileInformation')}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {t('profileDescription')}
              </p>
            </div>
            <div className="border-t border-border">
              <dl>
                <div className="bg-muted px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-muted-foreground">{t('nameLabel')}</dt>
                  <dd className="mt-1 text-sm text-foreground sm:mt-0 sm:col-span-2">
                    {t('namePlaceholder')}
                  </dd>
                </div>
                <div className="bg-card px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-muted-foreground">{t('emailLabel')}</dt>
                  <dd className="mt-1 text-sm text-foreground sm:mt-0 sm:col-span-2">
                    {t('emailPlaceholder')}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
