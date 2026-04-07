'use client'

/**
 * SizeGuideArtifact - Display sizing information for product types
 *
 * Renders a table showing size measurements for apparel products
 */

import { Shirt, Ruler } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'

export interface SizeGuide {
  productType: string
  unit: 'inches' | 'cm'
  sizes: {
    size: string
    chest?: number
    length?: number
    width?: number
    sleeve?: number
  }[]
}

interface SizeGuideArtifactProps {
  guide: SizeGuide
}

export function SizeGuideArtifact({ guide }: SizeGuideArtifactProps) {
  const t = useTranslations('storefront')
  const { productType, unit, sizes } = guide

  // Determine which columns to show based on available data
  const hasChest = sizes.some((s) => s.chest !== undefined)
  const hasLength = sizes.some((s) => s.length !== undefined)
  const hasWidth = sizes.some((s) => s.width !== undefined)
  const hasSleeve = sizes.some((s) => s.sleeve !== undefined)

  return (
    <Card className="w-full bg-card">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <Shirt className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{t('sizeGuide')}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {productType}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Ruler className="mr-1 h-3 w-3" />
            {unit === 'inches' ? t('inches') : t('centimeters')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 text-left text-sm font-semibold text-foreground">
                  {t('size')}
                </th>
                {hasChest && (
                  <th className="p-3 text-right text-sm font-semibold text-foreground">
                    {t('chest')}
                  </th>
                )}
                {hasLength && (
                  <th className="p-3 text-right text-sm font-semibold text-foreground">
                    {t('length')}
                  </th>
                )}
                {hasWidth && (
                  <th className="p-3 text-right text-sm font-semibold text-foreground">
                    {t('width')}
                  </th>
                )}
                {hasSleeve && (
                  <th className="p-3 text-right text-sm font-semibold text-foreground">
                    {t('sleeve')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sizes.map((size, idx) => (
                <tr
                  key={idx}
                  className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
                >
                  <td className="p-3 text-sm font-medium text-foreground">
                    {size.size}
                  </td>
                  {hasChest && (
                    <td className="p-3 text-right text-sm text-muted-foreground">
                      {size.chest || '—'}
                    </td>
                  )}
                  {hasLength && (
                    <td className="p-3 text-right text-sm text-muted-foreground">
                      {size.length || '—'}
                    </td>
                  )}
                  {hasWidth && (
                    <td className="p-3 text-right text-sm text-muted-foreground">
                      {size.width || '—'}
                    </td>
                  )}
                  {hasSleeve && (
                    <td className="p-3 text-right text-sm text-muted-foreground">
                      {size.sleeve || '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {t('sizeTip')}
        </p>
      </CardContent>
    </Card>
  )
}
