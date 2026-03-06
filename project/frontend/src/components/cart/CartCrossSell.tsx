'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ProductCard } from '@/components/products/ProductCard'

interface CartCrossSellProps {
  productId: string
}

export function CartCrossSell({ productId }: CartCrossSellProps) {
  const t = useTranslations('Cart')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!productId) return

    const fetchCrossSell = async () => {
      try {
        const res = await fetch(`/api/products/${productId}/cross-sell`)
        if (res.ok) {
          const data = await res.json()
          setItems(data.items || [])
        }
      } catch {
        // Silently fail — cross-sell is non-critical
      } finally {
        setLoading(false)
      }
    }

    fetchCrossSell()
  }, [productId])

  if (loading || items.length === 0) return null

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">
        {t('youMightAlsoLike')}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.slice(0, 4).map(item => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </div>
  )
}
