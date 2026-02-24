import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ContactForm } from '@/components/contact/ContactForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, MessageSquare, Clock } from 'lucide-react'

interface ContactPageProps {
  params: Promise<{ locale: string }>
}

// Server Component - generates metadata for SEO
export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { locale } = await params

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://podai.com'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Skapara'

  const title = `Contact Us - ${siteName}`
  const description = 'Get in touch with our support team. We\'re here to help with questions about orders, products, or our AI-powered platform.'

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
      },
    },
  }
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">Contact Us</h1>
        <p className="text-lg text-muted-foreground">
          Have a question? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="size-6 text-primary" />
              </div>
              <CardTitle>Email</CardTitle>
              <CardDescription>Our team is here to help</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="font-medium">General Inquiries</p>
                  <a href="mailto:hello@podai.com" className="text-primary hover:underline">
                    hello@podai.com
                  </a>
                </div>
                <div>
                  <p className="font-medium">Support</p>
                  <a href="mailto:support@podai.com" className="text-primary hover:underline">
                    support@podai.com
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
              <CardTitle>Live Chat</CardTitle>
              <CardDescription>Chat with our AI assistant</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Get instant answers to common questions or connect with our support team through our AI-powered chat.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="size-6 text-primary" />
              </div>
              <CardTitle>Response Time</CardTitle>
              <CardDescription>We're quick to respond</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We typically respond to all inquiries within 24 hours during business days.
                For urgent matters, please use our live chat.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Send us a message</CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you as soon as possible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContactForm locale={locale} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
