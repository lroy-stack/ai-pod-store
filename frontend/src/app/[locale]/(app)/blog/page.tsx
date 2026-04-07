import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BRAND } from '@/lib/store-config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

type BlogPost = {
  id: string
  slug: string
  title_en: string
  title_es: string
  title_de: string
  excerpt_en: string | null
  excerpt_es: string | null
  excerpt_de: string | null
  published_at: string
  featured_image: string | null
  views: number
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'blog' })

  const brandName = BRAND.name

  return {
    title: t('metaTitle', { brandName }),
    description: t('metaDescription', { brandName }),
  }
}

export default async function BlogListingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'blog' })
  const brandName = BRAND.name

  // Fetch published blog posts
  const { data: posts, error } = await supabaseAdmin
    .from('blog_posts')
    .select('id, slug, title_en, title_es, title_de, excerpt_en, excerpt_es, excerpt_de, published_at, featured_image, views')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Failed to fetch blog posts:', error)
  }

  const blogPosts: BlogPost[] = posts || []

  function getLocalizedTitle(post: BlogPost): string {
    if (locale === 'es') return post.title_es
    if (locale === 'de') return post.title_de
    return post.title_en
  }

  function getLocalizedExcerpt(post: BlogPost): string | null {
    if (locale === 'es') return post.excerpt_es
    if (locale === 'de') return post.excerpt_de
    return post.excerpt_en
  }

  return (
    <div className="min-h-screen px-6 py-24 md:py-32">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('title')}</h1>
        <p className="text-lg text-muted-foreground mb-12">{t('subtitle', { brandName })}</p>

        {blogPosts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">{t('noPosts')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {blogPosts.map((post) => {
              const title = getLocalizedTitle(post)
              const excerpt = getLocalizedExcerpt(post)
              const publishedDate = new Date(post.published_at).toLocaleDateString(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })

              return (
                <Link key={post.id} href={`/${locale}/blog/${post.slug}`} className="block">
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <CardTitle className="text-2xl">{title}</CardTitle>
                        <Badge variant="secondary">{publishedDate}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {excerpt && (
                        <p className="text-muted-foreground line-clamp-3">{excerpt}</p>
                      )}
                      <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{post.views} {t('views')}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
