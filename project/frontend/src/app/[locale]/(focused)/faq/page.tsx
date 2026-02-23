import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { FAQAccordion } from '@/components/faq/FAQAccordion'
import { Card, CardContent } from '@/components/ui/card'

interface FAQPageProps {
  params: Promise<{ locale: string }>
}

// Server Component - generates metadata for SEO
export async function generateMetadata({ params }: FAQPageProps): Promise<Metadata> {
  const { locale } = await params

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://podai.com'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'POD AI'

  const title = `Frequently Asked Questions - ${siteName}`
  const description = 'Find answers to common questions about POD AI, our products, ordering, shipping, and more.'

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
      },
    },
  }
}

const faqData = [
  {
    category: 'General',
    questions: [
      {
        question: 'What is POD AI?',
        answer: 'POD AI is an AI-powered print-on-demand platform that allows you to create custom designs and order personalized products. Our platform combines cutting-edge artificial intelligence with traditional e-commerce to make product creation accessible to everyone.',
      },
      {
        question: 'How does the AI design tool work?',
        answer: 'Our AI design tool uses advanced machine learning models to help you create unique designs. Simply describe what you want, and our AI will generate design suggestions. You can then refine, customize, and perfect your design before ordering.',
      },
      {
        question: 'Do I need design experience to use POD AI?',
        answer: 'No! POD AI is designed for everyone, regardless of design experience. Our AI assistant guides you through the process and handles the technical aspects, so you can focus on bringing your creative vision to life.',
      },
    ],
  },
  {
    category: 'Orders & Shipping',
    questions: [
      {
        question: 'How long does shipping take?',
        answer: 'Shipping times vary by location and product type. Domestic orders typically arrive within 3-7 business days, while international orders may take 7-14 business days. Production time is usually 2-5 business days before shipping.',
      },
      {
        question: 'Can I track my order?',
        answer: 'Yes! Once your order ships, you\'ll receive a tracking number via email. You can also track all your orders from your account dashboard.',
      },
      {
        question: 'Do you ship internationally?',
        answer: 'Yes, we ship to most countries worldwide. Shipping costs and delivery times vary by destination. International orders may be subject to customs fees and import taxes.',
      },
      {
        question: 'What if my order arrives damaged?',
        answer: 'We take quality seriously. If your order arrives damaged, please contact our support team within 7 days of delivery with photos of the damage. We\'ll arrange for a replacement or refund.',
      },
    ],
  },
  {
    category: 'Products & Customization',
    questions: [
      {
        question: 'What products can I customize?',
        answer: 'We offer hundreds of products including apparel (t-shirts, hoodies, hats), home decor (posters, canvas prints, pillows), accessories (phone cases, bags, stickers), and drinkware (mugs, water bottles). New products are added regularly.',
      },
      {
        question: 'What file formats do you accept?',
        answer: 'Our AI design tool accepts most common image formats including PNG, JPG, SVG, and PDF. For best results, we recommend high-resolution images (at least 300 DPI).',
      },
      {
        question: 'Can I use my own designs?',
        answer: 'Absolutely! You can upload your own designs or use our AI tool to create new ones. Make sure you have the rights to any images or artwork you upload.',
      },
      {
        question: 'What are the size and quality requirements?',
        answer: 'Each product has specific size requirements, which are displayed during the design process. For best quality, we recommend uploading high-resolution images. Our AI tool automatically optimizes your designs for each product.',
      },
    ],
  },
  {
    category: 'Pricing & Payments',
    questions: [
      {
        question: 'How much do products cost?',
        answer: 'Pricing varies by product type, size, and customization options. All prices are displayed clearly during the design and checkout process. We offer competitive pricing with no hidden fees.',
      },
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover), PayPal, and other payment methods through our secure payment processor, Stripe.',
      },
      {
        question: 'Are there any additional fees?',
        answer: 'The price you see at checkout is the final price, including all fees. International orders may be subject to customs fees and import taxes charged by the destination country.',
      },
    ],
  },
  {
    category: 'Returns & Refunds',
    questions: [
      {
        question: 'What is your return policy?',
        answer: 'We offer a 30-day satisfaction guarantee. If you\'re not completely satisfied with your order, contact us within 30 days of delivery to request a return or exchange. Custom products must be defective or damaged to qualify for return.',
      },
      {
        question: 'How do I request a refund?',
        answer: 'Contact our support team with your order number and reason for the refund. We\'ll review your request and process approved refunds within 5-7 business days.',
      },
      {
        question: 'Can I cancel my order?',
        answer: 'Orders can be canceled within 24 hours of placement, before production begins. After production starts, orders cannot be canceled. Please contact support immediately if you need to cancel.',
      },
    ],
  },
]

export default async function FAQPage({ params }: FAQPageProps) {
  const { locale } = await params

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">Frequently Asked Questions</h1>
        <p className="text-lg text-muted-foreground">
          Find answers to common questions about our platform, products, and services.
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
        <h3 className="mb-2 text-lg font-semibold">Still have questions?</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Can't find the answer you're looking for? Our support team is here to help.
        </p>
        <a
          href={`/${locale}/contact`}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Contact Support
        </a>
      </div>
    </div>
  )
}
