'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2 } from 'lucide-react'

interface Clipart {
  id: string
  name: string
  name_es?: string
  name_de?: string
  category: string
  svg_url: string
  thumbnail_url?: string
}

const CATEGORIES = ['all', 'icons', 'shapes', 'borders', 'illustrations', 'patterns', 'text-decorations'] as const

interface ClipartPanelProps {
  onAddClipart: (svgUrl: string) => void
}

export function ClipartPanel({ onAddClipart }: ClipartPanelProps) {
  const t = useTranslations('designEditor')
  const [clipart, setClipart] = useState<Clipart[]>([])
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')

  const fetchClipart = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      if (search) params.set('search', search)

      const res = await fetch(`/api/design-assets/clipart?${params}`)
      if (res.ok) {
        const data = await res.json()
        setClipart(data)
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [category, search])

  useEffect(() => {
    fetchClipart()
  }, [fetchClipart])

  const handleClick = async (item: Clipart) => {
    try {
      // Handle data: URLs directly (no fetch needed)
      if (item.svg_url.startsWith('data:')) {
        const match = item.svg_url.match(/^data:image\/svg\+xml[;,](.*)$/)
        if (match) {
          const svgText = match[1].startsWith('base64,')
            ? atob(match[1].slice(7))
            : decodeURIComponent(match[1])
          onAddClipart(svgText)
          return
        }
      }

      const res = await fetch(item.svg_url)
      if (!res.ok) return
      const svgText = await res.text()
      onAddClipart(svgText)
    } catch {
      // Fetch failed — ignore
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchClipart')}
          className="pl-8 h-9 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((cat) => (
          <Badge
            key={cat}
            variant={category === cat ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setCategory(cat)}
          >
            {cat === 'all' ? t('allCategories') : cat}
          </Badge>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : clipart.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t('noClipart')}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {clipart.map((item) => (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              className="aspect-square rounded-lg border border-border p-2 hover:border-primary transition-colors bg-muted flex items-center justify-center"
              title={item.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.thumbnail_url || item.svg_url}
                alt={item.name}
                loading="lazy"
                className="max-w-full max-h-full object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
