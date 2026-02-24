import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Palette, Zap, Users } from 'lucide-react'

interface AboutPageProps {
  params: Promise<{ locale: string }>
}

// Server Component - generates metadata for SEO
export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { locale } = await params

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://podai.com'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Skapara'

  const title = `About Us - ${siteName}`
  const description = 'Learn about Skapara - the AI-powered print-on-demand platform that makes custom product creation easy and accessible for everyone.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}/about`,
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
      canonical: `${baseUrl}/${locale}/about`,
      languages: {
        'en': `${baseUrl}/en/about`,
        'es': `${baseUrl}/es/about`,
        'de': `${baseUrl}/de/about`,
      },
    },
  }
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">About Skapara</h1>
        <p className="text-lg text-muted-foreground">
          Empowering creativity with AI-powered print-on-demand
        </p>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Our Mission</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p className="text-muted-foreground">
              Skapara is revolutionizing the print-on-demand industry by combining cutting-edge artificial intelligence
              with traditional e-commerce. Our platform empowers creators, entrepreneurs, and businesses to bring their
              ideas to life without the complexity of traditional manufacturing.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="size-6 text-primary" />
              </div>
              <CardTitle>AI-Powered Design</CardTitle>
              <CardDescription>
                Create stunning designs with our advanced AI design tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Our AI understands your vision and helps bring it to life with intelligent design suggestions,
                automatic optimization, and creative assistance.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Palette className="size-6 text-primary" />
              </div>
              <CardTitle>Custom Products</CardTitle>
              <CardDescription>
                From apparel to home decor, customize anything
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Choose from hundreds of high-quality products and personalize them with your designs.
                Each item is printed on-demand to ensure freshness and sustainability.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="size-6 text-primary" />
              </div>
              <CardTitle>Fast Fulfillment</CardTitle>
              <CardDescription>
                Quick production and worldwide shipping
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Partner with industry-leading manufacturers for fast, reliable production and shipping.
                Track your orders in real-time from creation to delivery.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Users className="size-6 text-primary" />
              </div>
              <CardTitle>Community First</CardTitle>
              <CardDescription>
                Join thousands of creators and entrepreneurs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Connect with a vibrant community of designers, artists, and business owners.
                Share ideas, get feedback, and grow together.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Our Story</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p className="text-muted-foreground">
              Founded in 2024, Skapara emerged from a simple observation: creating custom products shouldn't
              require design expertise or large upfront investments. By leveraging the latest advances in
              artificial intelligence and machine learning, we've built a platform that democratizes creativity
              and makes entrepreneurship accessible to everyone.
            </p>
            <p className="text-muted-foreground">
              Today, Skapara serves thousands of customers worldwide, from individual creators to established
              businesses. Our AI-powered tools have generated millions of designs, and our platform has helped
              countless entrepreneurs launch and grow their brands.
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Why Choose Skapara?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">✓</span>
                <span>No inventory or upfront costs - products are made on-demand</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">✓</span>
                <span>AI-powered design tools that work with you, not against you</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">✓</span>
                <span>Sustainable production that reduces waste and environmental impact</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">✓</span>
                <span>Secure payments and reliable fulfillment through trusted partners</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">✓</span>
                <span>24/7 support from our AI assistant and human team</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
