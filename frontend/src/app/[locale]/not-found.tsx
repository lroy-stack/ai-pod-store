'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useParams } from 'next/navigation'

export default function NotFound() {
  const params = useParams()
  const locale = (params?.locale as string) || 'en'

  let title = 'Page Not Found'
  let description = 'The page you are looking for does not exist or has been moved.'
  let backLabel = 'Back to Store'

  try {
    const t = useTranslations('errors')
    title = t('notFoundTitle')
    description = t('notFoundDescription')
    backLabel = t('backToStore')
  } catch {
    // Translations may not be available, use defaults above
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
        <Button asChild>
          <Link href={`/${locale}`}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  )
}
