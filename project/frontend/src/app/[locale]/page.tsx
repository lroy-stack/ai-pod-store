import { useTranslations } from 'next-intl'

export default function HomePage() {
  const t = useTranslations('common')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
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
