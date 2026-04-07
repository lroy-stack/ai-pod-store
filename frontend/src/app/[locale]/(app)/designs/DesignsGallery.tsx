'use client'

/**
 * DesignsGallery - User's design gallery page
 * Displays all AI-generated designs created by the user
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Download, Paintbrush2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useLocale } from 'next-intl'

const DEFAULT_PRODUCT_SLUG = 'three-models'

interface Design {
  id: string
  prompt: string
  style?: string
  image_url?: string
  thumbnail_url?: string
  created_at: string
  moderation_status: string
}

export function DesignsGallery() {
  const t = useTranslations('designs')
  const locale = useLocale()
  const [designs, setDesigns] = useState<Design[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requiresAuth, setRequiresAuth] = useState(false)

  useEffect(() => {
    async function fetchDesigns() {
      try {
        const response = await fetch('/api/designs')
        if (!response.ok) {
          throw new Error('Failed to fetch designs')
        }
        const data = await response.json()
        if (data.requiresAuth) {
          setRequiresAuth(true)
          setDesigns([])
        } else {
          setDesigns(data.designs || [])
        }
      } catch (err) {
        console.error('Error fetching designs:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchDesigns()
  }, [])

  if (loading) {
    return (
      <div className="px-3 py-8 sm:px-4 md:px-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-3 py-8 sm:px-4 md:px-6">
        <div className="text-center space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button onClick={() => window.location.reload()}>{t('retry')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 py-8 sm:px-4 md:px-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Auth Required State */}
      {requiresAuth && (
        <div className="text-center py-12 space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mx-auto">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">{t('authRequired')}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t('authRequiredDescription')}</p>
            <Button asChild>
              <Link href={`/${locale}/auth/login`}>{t('signIn')}</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!requiresAuth && designs.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mx-auto">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">{t('emptyTitle')}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t('emptyDescription')}</p>
            <Button asChild>
              <Link href={`/${locale}/chat`}>
                <Sparkles className="h-4 w-4 mr-2" />
                {t('createDesign')}
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Designs Grid */}
      {designs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {designs.map((design) => (
            <Card key={design.id} className="group overflow-hidden">
              <CardContent className="p-0">
                <div className="relative aspect-square w-full overflow-hidden bg-muted">
                  {design.thumbnail_url || design.image_url ? (
                    <Image
                      src={design.thumbnail_url || design.image_url || ''}
                      alt={design.prompt}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Sparkles className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}

                  {design.moderation_status === 'pending' && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="text-xs">{t('statusPending')}</Badge>
                    </div>
                  )}
                  {design.moderation_status === 'rejected' && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="destructive" className="text-xs">{t('statusRejected')}</Badge>
                    </div>
                  )}
                </div>

                <div className="p-3 space-y-1.5">
                  <p className="text-sm line-clamp-2 text-foreground">{design.prompt}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(design.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </CardContent>

              <CardFooter className="p-3 pt-0 flex flex-col gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    if (design.image_url) window.open(design.image_url, '_blank')
                  }}
                  disabled={!design.image_url}
                >
                  <Download className="h-3 w-3 mr-1.5" />
                  {t('download')}
                </Button>
                <Button
                  size="sm"
                  className="w-full text-xs"
                  asChild
                >
                  <Link href={`/${locale}/design/${DEFAULT_PRODUCT_SLUG}?designId=${design.id}`}>
                    <Paintbrush2 className="h-3 w-3 mr-1.5" />
                    {t('editInStudio')}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
