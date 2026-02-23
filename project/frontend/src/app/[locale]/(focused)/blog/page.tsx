import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, ArrowRight } from 'lucide-react'

interface BlogPageProps {
  params: Promise<{ locale: string }>
}

// Server Component - generates metadata for SEO
export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { locale } = await params

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://podai.com'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'POD AI'

  const title = `Blog - ${siteName}`
  const description = 'Discover tips, tutorials, and insights about AI-powered design, print-on-demand, and creative entrepreneurship.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}/blog`,
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
      canonical: `${baseUrl}/${locale}/blog`,
      languages: {
        'en': `${baseUrl}/en/blog`,
        'es': `${baseUrl}/es/blog`,
        'de': `${baseUrl}/de/blog`,
      },
    },
  }
}

// Sample blog posts (in production, these would come from a CMS or database)
const blogPosts = [
  {
    id: '1',
    title: 'Getting Started with AI-Powered Design',
    excerpt: 'Learn how to leverage artificial intelligence to create stunning custom designs for your print-on-demand products.',
    category: 'Tutorial',
    date: '2024-02-15',
    readTime: '5 min read',
    image: '/images/blog/ai-design.jpg',
  },
  {
    id: '2',
    title: '10 Tips for Successful Print-on-Demand Business',
    excerpt: 'Discover essential strategies for building and scaling a profitable print-on-demand business in 2024.',
    category: 'Business',
    date: '2024-02-10',
    readTime: '8 min read',
    image: '/images/blog/pod-tips.jpg',
  },
  {
    id: '3',
    title: 'Understanding Color Theory for Product Design',
    excerpt: 'Master the fundamentals of color theory to create eye-catching designs that sell.',
    category: 'Design',
    date: '2024-02-05',
    readTime: '6 min read',
    image: '/images/blog/color-theory.jpg',
  },
  {
    id: '4',
    title: 'Sustainable Print-on-Demand: Our Commitment',
    excerpt: 'Learn about our eco-friendly practices and how print-on-demand reduces waste compared to traditional manufacturing.',
    category: 'Sustainability',
    date: '2024-02-01',
    readTime: '4 min read',
    image: '/images/blog/sustainability.jpg',
  },
  {
    id: '5',
    title: 'Top Product Trends for 2024',
    excerpt: 'Stay ahead of the curve with insights into the most popular print-on-demand products this year.',
    category: 'Trends',
    date: '2024-01-28',
    readTime: '7 min read',
    image: '/images/blog/trends.jpg',
  },
  {
    id: '6',
    title: 'How to Market Your Custom Products',
    excerpt: 'Proven marketing strategies to promote your designs and grow your customer base.',
    category: 'Marketing',
    date: '2024-01-22',
    readTime: '9 min read',
    image: '/images/blog/marketing.jpg',
  },
]

const categories = ['All', 'Tutorial', 'Business', 'Design', 'Sustainability', 'Trends', 'Marketing']

export default async function BlogPage({ params }: BlogPageProps) {
  const { locale } = await params

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">Blog</h1>
        <p className="text-lg text-muted-foreground">
          Tips, tutorials, and insights for creative entrepreneurs
        </p>
      </div>

      {/* Category filters */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <Badge
            key={category}
            variant={category === 'All' ? 'default' : 'outline'}
            className="cursor-pointer px-4 py-1.5 text-sm"
          >
            {category}
          </Badge>
        ))}
      </div>

      {/* Blog posts grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {blogPosts.map((post) => (
          <Card key={post.id} className="flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
            <div className="aspect-video w-full overflow-hidden bg-muted">
              <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                <span className="text-sm text-muted-foreground">Featured Image</span>
              </div>
            </div>
            <CardHeader>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {post.category}
                </Badge>
              </div>
              <CardTitle className="line-clamp-2 text-xl">{post.title}</CardTitle>
              <CardDescription className="line-clamp-3">{post.excerpt}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="size-4" />
                  <span>{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="size-4" />
                  <span>{post.readTime}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="ghost" className="w-full justify-between group">
                Read More
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Pagination placeholder */}
      <div className="mt-12 flex justify-center">
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled>
            Previous
          </Button>
          <div className="flex gap-1">
            <Button variant="default" size="sm" className="size-9">
              1
            </Button>
            <Button variant="outline" size="sm" className="size-9">
              2
            </Button>
            <Button variant="outline" size="sm" className="size-9">
              3
            </Button>
          </div>
          <Button variant="outline">
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
