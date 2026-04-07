import { Card, CardContent } from '@/components/ui/card'
import { resolvePlaceholders, fetchLegalSettings } from '@/lib/legal-utils'
import { notFound } from 'next/navigation'
import { SafeMarkdown } from '@/components/common/SafeMarkdown'
import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  const titles: Record<string, Record<string, string>> = {
    en: { title: 'Terms of Service', description: 'Terms and conditions for using ' + (process.env.NEXT_PUBLIC_SITE_NAME || 'My POD Store') },
    es: { title: 'Términos de Servicio', description: 'Términos y condiciones de uso de ' + (process.env.NEXT_PUBLIC_SITE_NAME || 'My POD Store') },
    de: { title: 'Nutzungsbedingungen', description: 'Allgemeine Geschäftsbedingungen für ' + (process.env.NEXT_PUBLIC_SITE_NAME || 'My POD Store') },
  }

  const t = titles[locale] || titles.en

  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `${baseUrl}/${locale}/terms`,
      languages: {
        en: `${baseUrl}/en/terms`,
        es: `${baseUrl}/es/terms`,
        de: `${baseUrl}/de/terms`,
        'x-default': `${baseUrl}/en/terms`,
      },
    },
  }
}

interface LegalPage {
  id: string
  slug: string
  title_en: string
  title_es: string
  title_de: string
  content_en: string
  content_es: string
  content_de: string
  is_active: boolean
}


async function getLegalPage(slug: string): Promise<LegalPage | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[terms-page] Missing Supabase environment variables')
      return null
    }

    // Create Supabase client for public data access
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })

    // Fetch legal page from database
    const { data, error } = await supabase
      .from('legal_pages')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error) {
      console.warn('[terms-page] Failed to fetch legal page:', error.message)
      return null
    }

    return data as LegalPage
  } catch (error) {
    console.error('[terms-page] Error fetching legal page:', error)
    return null
  }
}

export default async function TermsOfServicePage({ params }: { params: Promise<{ locale: string }> }) {
  // Next.js 16: params is async and must be awaited
  const { locale } = await params

  // Fetch legal page content from database
  const page = await getLegalPage('terms')

  if (!page) {
    notFound()
  }

  // Fetch legal settings for placeholder resolution
  const settings = await fetchLegalSettings()

  // Get locale-specific content
  const titleKey = `title_${locale}` as keyof LegalPage
  const contentKey = `content_${locale}` as keyof LegalPage

  const title = (page[titleKey] as string) || page.title_en
  let content = (page[contentKey] as string) || page.content_en

  // Resolve placeholders
  content = resolvePlaceholders(content, settings, locale)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
      </div>

      <Card className="bg-card/80 backdrop-blur-xl border-border/60 shadow-xl">
        <CardContent className="pt-8 pb-10 px-6 md:px-10 prose prose-sm md:prose-base lg:prose-lg max-w-none dark:prose-invert">
          <SafeMarkdown variant="legal">
            {content}
          </SafeMarkdown>
        </CardContent>
      </Card>

      <Card className="mt-8 border-primary/20 bg-primary/5">
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">
            {locale === 'en' && 'For questions about these terms, please contact us.'}
            {locale === 'es' && 'Para preguntas sobre estos términos, contáctenos.'}
            {locale === 'de' && 'Bei Fragen zu diesen Bedingungen kontaktieren Sie uns bitte.'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
