import { getTranslations } from 'next-intl/server'
import LogoutButton from '@/components/auth/LogoutButton'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('common')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="absolute top-4 right-4">
        <LogoutButton locale={locale} />
      </div>
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center">
          {t('welcome')}
        </h1>
        <p className="text-center text-lg text-muted-foreground">
          {t('appName')}
        </p>
      </div>
    </main>
  )
}
