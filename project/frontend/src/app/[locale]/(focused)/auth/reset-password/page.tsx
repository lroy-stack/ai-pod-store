import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import ResetPasswordForm from '@/components/auth/ResetPasswordForm'
import { Card, CardContent } from '@/components/ui/card'
import { BrandMark } from '@/components/ui/brand-mark'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Auth' })

  return {
    title: t('resetPasswordTitle'),
    description: t('resetPasswordDescription'),
  }
}

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <div className="mx-auto max-w-md flex flex-col items-center">
      <Link href={`/${locale}/`} className="mb-6 group" aria-label="Home">
        <BrandMark size={48} />
      </Link>
      <Card className="w-full bg-card/80 backdrop-blur-xl border-border/60 shadow-xl">
        <CardContent className="pt-6">
          <ResetPasswordForm locale={locale} />
        </CardContent>
      </Card>
    </div>
  )
}
