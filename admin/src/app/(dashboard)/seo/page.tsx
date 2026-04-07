'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Search, Globe, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { adminFetch } from '@/lib/admin-api'
import { STORE_DOMAIN } from '@/lib/store-defaults'

interface MetaTags {
  en: { title: string; description: string; keywords: string }
  es: { title: string; description: string; keywords: string }
  de: { title: string; description: string; keywords: string }
}

const defaultMetaTags: MetaTags = {
  en: {
    title: process.env.NEXT_PUBLIC_SITE_NAME! + ' - Custom Print on Demand',
    description: 'Create custom designs and order high-quality print-on-demand products.',
    keywords: 'print on demand, custom designs, t-shirts, AI designs',
  },
  es: {
    title: process.env.NEXT_PUBLIC_SITE_NAME! + ' - Impresión bajo demanda personalizada',
    description: 'Crea diseños personalizados y ordena productos de impresión bajo demanda de alta calidad.',
    keywords: 'impresión bajo demanda, diseños personalizados, camisetas, diseños AI',
  },
  de: {
    title: process.env.NEXT_PUBLIC_SITE_NAME! + ' - Benutzerdefinierter Print-on-Demand',
    description: 'Erstellen Sie individuelle Designs und bestellen Sie hochwertige Print-on-Demand-Produkte.',
    keywords: 'Print-on-Demand, individuelle Designs, T-Shirts, KI-Designs',
  },
}

export default function SEOPage() {
  const [metaTags, setMetaTags] = useState<MetaTags>(defaultMetaTags)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetaTags()
  }, [])

  const fetchMetaTags = async () => {
    try {
      const response = await adminFetch('/api/admin/seo')
      if (response.ok) {
        const data = await response.json()
        setMetaTags(data)
      }
    } catch (error) {
      console.error('Error fetching meta tags:', error)
      toast.error('Failed to load meta tags')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save all three locales
      await Promise.all([
        adminFetch('/api/admin/seo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: 'en', ...metaTags.en }),
        }),
        adminFetch('/api/admin/seo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: 'es', ...metaTags.es }),
        }),
        adminFetch('/api/admin/seo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: 'de', ...metaTags.de }),
        }),
      ])
      toast.success('SEO meta tags saved successfully')
    } catch (err) {
      toast.error('Failed to save meta tags')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateSitemap = async () => {
    setGenerating(true)
    try {
      const response = await adminFetch('/api/admin/sitemap', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to generate sitemap')
      }

      const data = await response.json()
      toast.success(`Sitemap generated successfully (${data.productCount} products)`)
    } catch (err) {
      console.error('Error generating sitemap:', err)
      toast.error('Failed to generate sitemap')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span className="text-foreground">Admin</span>
          <span>&gt;</span>
          <span>SEO Management</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold">SEO Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage meta tags, hreflang configuration, and sitemaps
          </p>
        </div>
        <p className="text-center py-12 text-muted-foreground">Loading SEO configuration...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span className="text-foreground">Admin</span>
        <span>&gt;</span>
        <span>SEO Management</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">SEO Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage meta tags, hreflang configuration, and sitemaps
        </p>
      </div>

      {/* Meta Tags Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Meta Tags per Locale
          </CardTitle>
          <CardDescription>
            Edit SEO meta tags for each language version of your store
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="en" className="space-y-4">
            <TabsList>
              <TabsTrigger value="en">English</TabsTrigger>
              <TabsTrigger value="es">Español</TabsTrigger>
              <TabsTrigger value="de">Deutsch</TabsTrigger>
            </TabsList>

            {(['en', 'es', 'de'] as const).map((locale) => (
              <TabsContent key={locale} value={locale} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`title-${locale}`}>Page Title</Label>
                  <Input
                    id={`title-${locale}`}
                    value={metaTags[locale].title}
                    onChange={(e) =>
                      setMetaTags({
                        ...metaTags,
                        [locale]: { ...metaTags[locale], title: e.target.value },
                      })
                    }
                    placeholder="Enter page title..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommended: 50-60 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`description-${locale}`}>Meta Description</Label>
                  <Textarea
                    id={`description-${locale}`}
                    value={metaTags[locale].description}
                    onChange={(e) =>
                      setMetaTags({
                        ...metaTags,
                        [locale]: {
                          ...metaTags[locale],
                          description: e.target.value,
                        },
                      })
                    }
                    placeholder="Enter meta description..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommended: 150-160 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`keywords-${locale}`}>Keywords</Label>
                  <Input
                    id={`keywords-${locale}`}
                    value={metaTags[locale].keywords}
                    onChange={(e) =>
                      setMetaTags({
                        ...metaTags,
                        [locale]: { ...metaTags[locale], keywords: e.target.value },
                      })
                    }
                    placeholder="keyword1, keyword2, keyword3"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated list
                  </p>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="mt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Meta Tags'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hreflang Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Hreflang Configuration
          </CardTitle>
          <CardDescription>
            Language and regional targeting for search engines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Hreflang Tags Status</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically generated for all product and page routes
                  </p>
                </div>
                <Badge variant="outline" className="bg-success/10 text-success">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Configured Languages:</p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">en</Badge>
                    <span className="text-sm">English</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    hreflang="en"
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">es</Badge>
                    <span className="text-sm">Español</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    hreflang="es"
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">de</Badge>
                    <span className="text-sm">Deutsch</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    hreflang="de"
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-medium mb-2">Example Implementation:</p>
              <pre className="text-xs overflow-x-auto">
{`<link rel="alternate" hreflang="en" href="https://${STORE_DOMAIN}/en/products" />
<link rel="alternate" hreflang="es" href="https://${STORE_DOMAIN}/es/products" />
<link rel="alternate" hreflang="de" href="https://${STORE_DOMAIN}/de/products" />
<link rel="alternate" hreflang="x-default" href="https://${STORE_DOMAIN}/en/products" />`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sitemap Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sitemap Generation
          </CardTitle>
          <CardDescription>
            Generate XML sitemaps for search engine indexing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Sitemap Status</p>
                <p className="text-sm text-muted-foreground">
                  Sitemaps are automatically updated daily at 16:00 UTC
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Available Sitemaps:</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <code className="text-xs">/sitemap.xml</code>
                  <Badge variant="outline">Main</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <code className="text-xs">/sitemap-en.xml</code>
                  <Badge variant="outline">EN</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <code className="text-xs">/sitemap-es.xml</code>
                  <Badge variant="outline">ES</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <code className="text-xs">/sitemap-de.xml</code>
                  <Badge variant="outline">DE</Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleGenerateSitemap} disabled={generating}>
              {generating ? 'Generating...' : 'Generate Sitemap Now'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Manual trigger for immediate regeneration
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
