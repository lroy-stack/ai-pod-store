import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BRAND } from '@/lib/store-config'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SafeMarkdown } from '@/components/common/SafeMarkdown'

type BlogPost = {
  id: string
  slug: string
  title_en: string
  title_es: string
  title_de: string
  content_en: string
  content_es: string
  content_de: string
  excerpt_en: string | null
  excerpt_es: string | null
  excerpt_de: string | null
  published_at: string
  featured_image: string | null
  views: number
  author_id: string | null
}

async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const { data, error } = await supabaseAdmin
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (error || !data) {
    return null
  }

  // Increment view count
  await supabaseAdmin
    .from('blog_posts')
    .update({ views: (data.views || 0) + 1 })
    .eq('id', data.id)

  return data
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const post = await getBlogPost(slug)

  if (!post) {
    return {
      title: 'Post Not Found',
    }
  }

  const title = locale === 'es' ? post.title_es : locale === 'de' ? post.title_de : post.title_en
  const excerpt =
    locale === 'es' ? post.excerpt_es : locale === 'de' ? post.excerpt_de : post.excerpt_en

  return {
    title,
    description: excerpt || undefined,
    openGraph: {
      title,
      description: excerpt || undefined,
      type: 'article',
      publishedTime: post.published_at,
      images: post.featured_image ? [post.featured_image] : undefined,
    },
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const post = await getBlogPost(slug)

  if (!post) {
    notFound()
  }

  const title = locale === 'es' ? post.title_es : locale === 'de' ? post.title_de : post.title_en
  const content =
    locale === 'es' ? post.content_es : locale === 'de' ? post.content_de : post.content_en
  const publishedDate = new Date(post.published_at).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // JSON-LD Article schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    datePublished: post.published_at,
    image: post.featured_image || undefined,
    author: {
      '@type': 'Organization',
      name: BRAND.name,
    },
  }

  return (
    <>
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="min-h-screen px-6 py-24 md:py-32">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <header className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
            <div className="flex items-center gap-4 text-muted-foreground">
              <Badge variant="secondary">{publishedDate}</Badge>
              <span>•</span>
              <span>{post.views} views</span>
            </div>
          </header>

          {/* Featured image */}
          {post.featured_image && (
            <div className="mb-12">
              <img
                src={post.featured_image}
                alt={title}
                className="w-full h-auto rounded-lg shadow-lg"
              />
            </div>
          )}

          {/* Content */}
          <Card>
            <CardContent className="p-8 prose prose-lg max-w-none dark:prose-invert">
              <SafeMarkdown variant="legal">{content}</SafeMarkdown>
            </CardContent>
          </Card>
        </div>
      </article>
    </>
  )
}
