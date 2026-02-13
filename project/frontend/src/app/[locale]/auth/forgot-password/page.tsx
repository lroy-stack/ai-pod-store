import { getTranslations } from 'next-intl/server'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Auth' })

  return {
    title: t('forgotPasswordTitle'),
    description: t('forgotPasswordDescription'),
  }
}

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted py-12 px-4 sm:px-6 lg:px-8">
      <ForgotPasswordForm locale={locale} />
    </div>
  )
}
