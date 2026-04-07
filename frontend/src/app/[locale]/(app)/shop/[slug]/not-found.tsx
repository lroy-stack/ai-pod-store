'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'

export default function ProductNotFound() {
  const params = useParams()
  const locale = (params?.locale as string) || 'en'

  let title = 'Product Not Found'
  let description = 'The product you are looking for does not exist or is no longer available.'
  let browseButton = 'Browse Products'
  let backButton = 'Back to Store'

  try {
    const t = useTranslations('errors')
    title = t('productNotFoundTitle')
    description = t('productNotFoundDescription')
    browseButton = t('browseProducts')
    backButton = t('backToStore')
  } catch {
    // Translations may not be available, use defaults above
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
        <div className="flex gap-3 justify-center">
          <Button asChild>
            <Link href={`/${locale}/shop`}>{browseButton}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/${locale}`}>{backButton}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
