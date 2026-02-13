import { getTranslations } from 'next-intl/server'
import EmailVerificationHandler from '@/components/auth/EmailVerificationHandler'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Auth' })

  return {
    title: t('emailVerificationTitle'),
    description: t('emailVerificationDescription'),
  }
}

export default async function VerifyEmailPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted py-12 px-4 sm:px-6 lg:px-8">
      <EmailVerificationHandler locale={locale} />
    </div>
  )
}
