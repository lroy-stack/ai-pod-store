'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Product {
  id: string
  slug: string
  title: string
  image?: string
  images?: string[]
}

interface ProductSwitcherProps {
  currentSlug: string
  locale: string
  onBeforeSwitch?: () => void
}

export function ProductSwitcher({ currentSlug, locale, onBeforeSwitch }: ProductSwitcherProps) {
  const router = useRouter()
  const t = useTranslations('designEditor')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open || products.length > 0) return

    setLoading(true)
    fetch('/api/products?limit=50')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const list = data?.items || data?.products || []
        setProducts(list.filter((p: Product) => p.slug && p.slug !== currentSlug))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, products.length, currentSlug])

  const handleSelect = (slug: string) => {
    setOpen(false)
    onBeforeSwitch?.()
    router.push(`/${locale}/design/${slug}`)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <ChevronDown className="size-3.5" />
          <span className="hidden sm:inline text-xs">{t('switchProduct')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            {t('noOtherProducts')}
          </div>
        ) : (
          products.map((product) => (
            <DropdownMenuItem
              key={product.id}
              onClick={() => handleSelect(product.slug)}
              className="gap-3 py-2"
            >
              {(product.images?.[0] || product.image) && (
                <img
                  src={product.images?.[0] || product.image || ''}
                  alt=""
                  className="size-8 rounded object-cover bg-muted shrink-0"
                />
              )}
              <span className="text-sm truncate">{product.title}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
