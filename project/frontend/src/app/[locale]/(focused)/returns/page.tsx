import { Card, CardContent } from '@/components/ui/card'
import { resolvePlaceholders, fetchLegalSettings } from '@/lib/legal-utils'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

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
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'
    const response = await fetch(`${adminUrl}/api/admin/legal-pages`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache for 5 minutes
      // @ts-ignore - Next.js specific fetch extension
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      console.warn('[returns-page] Failed to fetch legal pages:', response.status)
      return null
    }

    const pages: LegalPage[] = await response.json()
    const page = pages.find((p) => p.slug === slug && p.is_active)

    return page ?? null
  } catch (error) {
    console.error('[returns-page] Error fetching legal page:', error)
    return null
  }
}

export default async function ReturnsPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  // Next.js 16: params is async and must be awaited
  const { locale } = await params

  // Fetch legal page content from database
  const page = await getLegalPage('returns')

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
    <div className="min-h-screen bg-background py-8 px-4 md:py-12 md:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            {title}
          </h1>
        </div>

        {/* Content */}
        <Card className="mb-6">
          <CardContent className="pt-6 prose prose-sm md:prose-base lg:prose-lg max-w-none dark:prose-invert">
            <ReactMarkdown
              components={{
                // Custom component styling for markdown
                h1: ({ ...props }) => (
                  <h1
                    className="text-2xl md:text-3xl font-bold text-foreground mt-8 mb-4 first:mt-0"
                    {...props}
                  />
                ),
                h2: ({ ...props }) => (
                  <h2
                    className="text-xl md:text-2xl font-semibold text-foreground mt-6 mb-3"
                    {...props}
                  />
                ),
                h3: ({ ...props }) => (
                  <h3
                    className="text-lg md:text-xl font-medium text-foreground mt-4 mb-2"
                    {...props}
                  />
                ),
                p: ({ ...props }) => (
                  <p className="text-foreground leading-relaxed mb-4" {...props} />
                ),
                ul: ({ ...props }) => (
                  <ul className="list-disc pl-6 space-y-2 text-foreground mb-4" {...props} />
                ),
                ol: ({ ...props }) => (
                  <ol className="list-decimal pl-6 space-y-2 text-foreground mb-4" {...props} />
                ),
                li: ({ ...props }) => (
                  <li className="leading-relaxed text-foreground" {...props} />
                ),
                a: ({ ...props }) => (
                  <a
                    className="text-primary hover:underline font-medium"
                    {...props}
                  />
                ),
                strong: ({ ...props }) => (
                  <strong className="font-semibold text-foreground" {...props} />
                ),
                blockquote: ({ ...props }) => (
                  <blockquote
                    className="border-l-4 border-border pl-4 italic text-muted-foreground my-4"
                    {...props}
                  />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card className="mt-8 bg-muted/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              {locale === 'en' && 'For questions about returns, please contact us.'}
              {locale === 'es' && 'Para preguntas sobre devoluciones, contáctenos.'}
              {locale === 'de' && 'Bei Fragen zu Rücksendungen kontaktieren Sie uns bitte.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
