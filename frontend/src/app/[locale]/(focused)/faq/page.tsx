import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { BRAND, BASE_URL } from '@/lib/store-config'
import { FAQAccordion } from '@/components/faq/FAQAccordion'
import { Card, CardContent } from '@/components/ui/card'

interface FAQPageProps {
  params: Promise<{ locale: string }>
}

// Server Component - generates metadata for SEO
export async function generateMetadata({ params }: FAQPageProps): Promise<Metadata> {
  const { locale } = await params

  const baseUrl = BASE_URL
  const siteName = BRAND.name

  const titles: Record<string, string> = {
    en: `Frequently Asked Questions - ${siteName}`,
    es: `Preguntas Frecuentes - ${siteName}`,
    de: `Häufig gestellte Fragen - ${siteName}`,
  }
  const descriptions: Record<string, string> = {
    en: 'Find answers to common questions about ' + (process.env.NEXT_PUBLIC_SITE_NAME || 'My POD Store') + ', our products, ordering, shipping, and more.',
    es: 'Encuentra respuestas a preguntas comunes sobre ' + (process.env.NEXT_PUBLIC_SITE_NAME || 'My POD Store') + ', nuestros productos, pedidos, envíos y más.',
    de: 'Finden Sie Antworten auf häufige Fragen zu ' + (process.env.NEXT_PUBLIC_SITE_NAME || 'My POD Store') + ', unseren Produkten, Bestellungen, Versand und mehr.',
  }
  const title = titles[locale] || titles.en
  const description = descriptions[locale] || descriptions.en

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}/faq`,
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
      canonical: `${baseUrl}/${locale}/faq`,
      languages: {
        'en': `${baseUrl}/en/faq`,
        'es': `${baseUrl}/es/faq`,
        'de': `${baseUrl}/de/faq`,
        'x-default': `${baseUrl}/en/faq`,
      },
    },
  }
}

export default async function FAQPage({ params }: FAQPageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'faq' })

  const faqData = [
    {
      category: t('catGeneral'),
      questions: [
        { question: t('q1'), answer: t('a1') },
        { question: t('q2'), answer: t('a2') },
        { question: t('q3'), answer: t('a3') },
      ],
    },
    {
      category: t('catOrders'),
      questions: [
        { question: t('q4'), answer: t('a4') },
        { question: t('q5'), answer: t('a5') },
        { question: t('q6'), answer: t('a6') },
        { question: t('q7'), answer: t('a7') },
      ],
    },
    {
      category: t('catProducts'),
      questions: [
        { question: t('q8'), answer: t('a8') },
        { question: t('q9'), answer: t('a9') },
        { question: t('q10'), answer: t('a10') },
        { question: t('q11'), answer: t('a11') },
      ],
    },
    {
      category: t('catPricing'),
      questions: [
        { question: t('q12'), answer: t('a12') },
        { question: t('q13'), answer: t('a13') },
        { question: t('q14'), answer: t('a14') },
      ],
    },
    {
      category: t('catReturns'),
      questions: [
        { question: t('q15'), answer: t('a15') },
        { question: t('q16'), answer: t('a16') },
        { question: t('q17'), answer: t('a17') },
        { question: t('q18'), answer: t('a18') },
      ],
    },
  ]

  // Flatten all Q&A for FAQPage JSON-LD
  const allQuestions = faqData.flatMap(cat => cat.questions)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: allQuestions.map(item => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
              },
            })),
          }),
        }}
      />
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <div className="space-y-8">
        {faqData.map((category, idx) => (
          <div key={idx}>
            <h2 className="mb-4 text-2xl font-semibold">{category.category}</h2>
            <Card>
              <CardContent className="p-0">
                <FAQAccordion questions={category.questions} />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-lg border border-border bg-muted/30 p-6 text-center">
        <h3 className="mb-2 text-lg font-semibold">{t('stillQuestions')}</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('stillQuestionsDesc')}
        </p>
        <a
          href={`/${locale}/contact`}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t('contactSupport')}
        </a>
      </div>
    </div>
    </>
  )
}
