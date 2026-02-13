import { getTranslations } from 'next-intl/server'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('common')

  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-6 md:p-24">
      <div className="max-w-5xl w-full items-center justify-center text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-8">
          {t('welcome')}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t('appName')}
        </p>
      </div>
    </main>
  )
}
