import { getTranslations } from 'next-intl/server'
import RegisterForm from '@/components/auth/RegisterForm'
import { Card, CardContent } from '@/components/ui/card'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Auth' })

  return {
    title: t('registerTitle'),
    description: t('registerDescription'),
  }
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <div className="flex items-center justify-center py-8 md:py-12 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <RegisterForm locale={locale} />
        </CardContent>
      </Card>
    </div>
  )
}
