'use client'

import { useTranslations } from 'next-intl'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function FocusedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams()
  const locale = (params?.locale as string) || 'en'

  let title = 'Something went wrong'
  let description = 'An unexpected error occurred. Please try again or go back to the store.'
  let retryLabel = 'Try again'
  let homeLabel = 'Go Home'

  try {
    const t = useTranslations('errors')
    title = t('title')
    description = t('description')
    retryLabel = t('retry')
    homeLabel = t('goHome')
  } catch {
    // Translations may not be available, use defaults above
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset}>{retryLabel}</Button>
          <Button variant="outline" asChild>
            <Link href={`/${locale}/`}>{homeLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
