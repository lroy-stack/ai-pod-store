'use client'

import { useEffect, useState } from 'react'
import { getCachedProducts } from '@/lib/idb-cache'
import { WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslations } from 'next-intl'

export default function OfflinePage() {
  const t = useTranslations('Offline')
  const [products, setProducts] = useState<Array<Record<string, unknown>>>([])

  useEffect(() => {
    getCachedProducts().then(setProducts).catch(() => {})
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <WifiOff className="h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-muted-foreground text-center mb-6 max-w-md">
        {t('description')}
      </p>
      <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        {t('tryAgain')}
      </Button>

      {products.length > 0 && (
        <div className="mt-8 w-full max-w-4xl">
          <h2 className="text-lg font-semibold mb-4">{t('cachedProducts')}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {products.slice(0, 12).map((product) => (
              <Card key={String(product.id)} className="overflow-hidden">
                <CardContent className="p-3">
                  <p className="font-medium text-sm truncate">{String(product.name || product.title || 'Product')}</p>
                  <p className="text-sm text-muted-foreground">
                    &euro;{Number(product.price || 0).toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
