import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { BRAND, BASE_URL, CONTACT } from '@/lib/store-config'
import { ContactForm } from '@/components/contact/ContactForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, MessageSquare, Clock } from 'lucide-react'

interface ContactPageProps {
  params: Promise<{ locale: string }>
}

// Server Component - generates metadata for SEO
export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'contact' })

  const baseUrl = BASE_URL
  const siteName = BRAND.name

  const title = `${t('title')} - ${siteName}`
  const description = t('subtitle')

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}/contact`,
      siteName,
      locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/${locale}/contact`,
      languages: {
        'en': `${baseUrl}/en/contact`,
        'es': `${baseUrl}/es/contact`,
        'de': `${baseUrl}/de/contact`,
        'x-default': `${baseUrl}/en/contact`,
      },
    },
  }
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'contact' })

  const formTranslations = {
    nameLabel: t('nameLabel'),
    namePlaceholder: t('namePlaceholder'),
    emailLabel: t('emailLabel'),
    emailPlaceholder: t('emailPlaceholder'),
    subjectLabel: t('subjectLabel'),
    subjectGeneral: t('subjectGeneral'),
    subjectTech: t('subjectTech'),
    subjectOrder: t('subjectOrder'),
    subjectProduct: t('subjectProduct'),
    subjectPartnership: t('subjectPartnership'),
    subjectFeedback: t('subjectFeedback'),
    messageLabel: t('messageLabel'),
    messagePlaceholder: t('messagePlaceholder'),
    sendButton: t('sendButton'),
    sending: t('sending'),
    successTitle: t('successTitle'),
    successDesc: t('successDesc'),
    errorTitle: t('errorTitle'),
    errorDesc: t('errorDesc'),
    errorFallback: t('errorFallback'),
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="size-6 text-primary" />
              </div>
              <CardTitle>{t('emailTitle')}</CardTitle>
              <CardDescription>{t('emailSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="font-medium">{t('generalInquiries')}</p>
                  <a href={`mailto:${CONTACT.general}`} className="text-primary hover:underline">
                    {CONTACT.general}
                  </a>
                </div>
                <div>
                  <p className="font-medium">{t('support')}</p>
                  <a href={`mailto:${CONTACT.support}`} className="text-primary hover:underline">
                    {CONTACT.support}
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <MessageSquare className="size-6 text-primary" />
              </div>
              <CardTitle>{t('liveChatTitle')}</CardTitle>
              <CardDescription>{t('liveChatSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('liveChatDesc')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="size-6 text-primary" />
              </div>
              <CardTitle>{t('responseTimeTitle')}</CardTitle>
              <CardDescription>{t('responseTimeSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('responseTimeDesc')}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('formTitle')}</CardTitle>
              <CardDescription>
                {t('formSubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContactForm locale={locale} translations={formTranslations} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
