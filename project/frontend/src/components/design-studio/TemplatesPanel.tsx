'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2 } from 'lucide-react'

interface Template {
  id: string
  name: string
  name_es?: string
  name_de?: string
  category: string
  thumbnail_url: string
  fabric_json: object
}

const CATEGORIES = ['all', 'minimalist', 'vintage', 'typography', 'geometric', 'pop-art', 'botanical'] as const

interface TemplatesPanelProps {
  onApplyTemplate: (fabricJson: object) => void
  productType?: string
}

export function TemplatesPanel({ onApplyTemplate, productType }: TemplatesPanelProps) {
  const t = useTranslations('designEditor')
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      if (search) params.set('search', search)
      if (productType) params.set('product_type', productType)

      const res = await fetch(`/api/design-assets/templates?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch {
      // Silently fail — templates are optional
    } finally {
      setLoading(false)
    }
  }, [category, search, productType])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return (
    <div className="space-y-3 p-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchTemplates')}
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
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t('noTemplates')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {templates.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => onApplyTemplate(tmpl.fabric_json)}
              className="group relative aspect-square rounded-lg border border-border overflow-hidden hover:border-primary transition-colors bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tmpl.thumbnail_url}
                alt={tmpl.name}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <span className="absolute bottom-0 inset-x-0 text-[10px] text-foreground bg-card/80 px-1 py-0.5 truncate">
                {tmpl.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
