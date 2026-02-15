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
import { Sparkles, Download, Shirt, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useLocale } from 'next-intl'

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

  useEffect(() => {
    async function fetchDesigns() {
      try {
        const response = await fetch('/api/designs')
        if (!response.ok) {
          throw new Error('Failed to fetch designs')
        }
        const data = await response.json()
        setDesigns(data.designs || [])
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
      <div className="container mx-auto py-12 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              {t('loading') || 'Loading your designs...'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="text-center space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button onClick={() => window.location.reload()}>
            {t('retry') || 'Try Again'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-12 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t('title') || 'My Designs'}</h1>
            <p className="text-sm text-muted-foreground">
              {t('subtitle') || 'Your AI-generated design collection'}
            </p>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {designs.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mx-auto">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">
              {t('emptyTitle') || 'No designs yet'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t('emptyDescription') || 'Start creating AI-generated designs in the chat'}
            </p>
            <Link href={`/${locale}/chat`}>
              <Button className="bg-primary hover:bg-primary/90">
                <Sparkles className="h-4 w-4 mr-2" />
                {t('createDesign') || 'Create Your First Design'}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Designs Grid */}
      {designs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {designs.map((design) => (
            <Card key={design.id} className="group overflow-hidden">
              <CardContent className="p-0">
                {/* Design Image */}
                <div className="relative aspect-square w-full overflow-hidden bg-muted">
                  {design.thumbnail_url || design.image_url ? (
                    <Image
                      src={design.thumbnail_url || design.image_url || ''}
                      alt={design.prompt}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Sparkles className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}

                  {/* Moderation Badge */}
                  {design.moderation_status === 'pending' && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="text-xs">
                        Pending
                      </Badge>
                    </div>
                  )}
                  {design.moderation_status === 'rejected' && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="destructive" className="text-xs">
                        Rejected
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Design Info */}
                <div className="p-4 space-y-2">
                  <p className="text-sm line-clamp-2 text-foreground">
                    {design.prompt}
                  </p>
                  {design.style && (
                    <Badge variant="outline" className="capitalize text-xs">
                      {design.style}
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(design.created_at).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>

              <CardFooter className="p-4 pt-0 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    if (design.image_url) {
                      window.open(design.image_url, '_blank')
                    }
                  }}
                  disabled={!design.image_url}
                >
                  <Download className="h-3 w-3 mr-1" />
                  {t('download') || 'Download'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled
                >
                  <Shirt className="h-3 w-3 mr-1" />
                  {t('apply') || 'Apply'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
