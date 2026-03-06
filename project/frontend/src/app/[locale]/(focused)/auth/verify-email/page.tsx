import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import EmailVerificationHandler from '@/components/auth/EmailVerificationHandler'
import { Card, CardContent } from '@/components/ui/card'
import { BrandMark } from '@/components/ui/brand-mark'

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
    <div className="mx-auto max-w-md flex flex-col items-center">
      <Link href={`/${locale}/`} className="mb-6 group" aria-label="Home">
        <BrandMark size={48} />
      </Link>
      <Card className="w-full bg-card/80 backdrop-blur-xl border-border/60 shadow-xl">
        <CardContent className="pt-6">
          <EmailVerificationHandler locale={locale} />
        </CardContent>
      </Card>
    </div>
  )
}
