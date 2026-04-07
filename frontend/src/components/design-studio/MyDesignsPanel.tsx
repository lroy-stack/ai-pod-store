'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface Design {
  id: string
  prompt: string
  style?: string
  image_url: string
  bg_removed_url?: string
  thumbnail_url?: string
  created_at: string
}

interface MyDesignsPanelProps {
  onAddDesignImage: (url: string) => Promise<void>
}

export function MyDesignsPanel({ onAddDesignImage }: MyDesignsPanelProps) {
  const t = useTranslations('designEditor')
  const locale = useLocale()
  const [designs, setDesigns] = useState<Design[]>([])
  const [loading, setLoading] = useState(true)
  const [requiresAuth, setRequiresAuth] = useState(false)

  const fetchDesigns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/designs')
      if (res.ok) {
        const data = await res.json()
        if (data.requiresAuth) {
          setRequiresAuth(true)
          setDesigns([])
        } else {
          setDesigns(data.designs || [])
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDesigns()
  }, [fetchDesigns])

  const handleClick = (design: Design) => {
    const url = design.bg_removed_url || design.image_url
    onAddDesignImage(url)
  }

  return (
    <div className="space-y-3 p-3">
      <p className="text-xs text-muted-foreground">
        {t('myDesignsDescription')}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : requiresAuth ? (
        <div className="text-center py-8 space-y-3">
          <Sparkles className="size-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('myDesignsAuthRequired') || 'Sign in to see your designs'}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/auth/login`}>{t('signIn') || 'Sign In'}</Link>
          </Button>
        </div>
      ) : designs.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <Sparkles className="size-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('myDesignsEmpty')}</p>
          <p className="text-xs text-muted-foreground">{t('myDesignsEmptyHint')}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/chat`}>{t('goToChat')}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {designs.map((design) => (
            <button
              key={design.id}
              onClick={() => handleClick(design)}
              className="group relative aspect-square rounded-lg border border-border overflow-hidden hover:border-primary transition-colors bg-muted"
              title={design.prompt}
            >
              <img
                src={design.thumbnail_url || design.bg_removed_url || design.image_url}
                alt={design.prompt}
                loading="lazy"
                className="w-full h-full object-contain p-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              {/* Fallback when image fails to load */}
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground p-2 text-center leading-tight pointer-events-none">
                <Sparkles className="size-6 opacity-30" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur-sm px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-foreground truncate">{design.prompt}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
