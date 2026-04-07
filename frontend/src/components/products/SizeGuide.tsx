'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Ruler } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { STORE_DEFAULTS } from '@/lib/store-config'

interface SizeGuideProps {
  productType: string
}

// Size guide data for different product types (measurements in cm)
const sizeGuideData: Record<string, {
  headers: string[]
  rows: Array<{ size: string; measurements: string[] }>
  unit: string
}> = {
  tshirt: {
    headers: ['Size', 'Chest', 'Length', 'Shoulder'],
    rows: [
      { size: 'S', measurements: ['86-91 cm', '69 cm', '41 cm'] },
      { size: 'M', measurements: ['97-102 cm', '71 cm', '43 cm'] },
      { size: 'L', measurements: ['107-112 cm', '74 cm', '46 cm'] },
      { size: 'XL', measurements: ['117-122 cm', '76 cm', '48 cm'] },
      { size: 'XXL', measurements: ['127-132 cm', '79 cm', '51 cm'] },
    ],
    unit: STORE_DEFAULTS.measurementUnit,
  },
  hoodie: {
    headers: ['Size', 'Chest', 'Length', 'Shoulder', 'Sleeve'],
    rows: [
      { size: 'S', measurements: ['91-97 cm', '66 cm', '43 cm', '84 cm'] },
      { size: 'M', measurements: ['102-107 cm', '69 cm', '46 cm', '86 cm'] },
      { size: 'L', measurements: ['112-117 cm', '71 cm', '48 cm', '89 cm'] },
      { size: 'XL', measurements: ['122-127 cm', '74 cm', '51 cm', '91 cm'] },
    ],
    unit: STORE_DEFAULTS.measurementUnit,
  },
  sweatpants: {
    headers: ['Size', 'Waist', 'Hip', 'Inseam'],
    rows: [
      { size: 'S', measurements: ['71-76 cm', '91-97 cm', '74 cm'] },
      { size: 'M', measurements: ['81-86 cm', '102-107 cm', '76 cm'] },
      { size: 'L', measurements: ['91-97 cm', '112-117 cm', '79 cm'] },
      { size: 'XL', measurements: ['102-107 cm', '122-127 cm', '81 cm'] },
    ],
    unit: STORE_DEFAULTS.measurementUnit,
  },
  tank: {
    headers: ['Size', 'Chest', 'Length', 'Shoulder'],
    rows: [
      { size: 'S', measurements: ['86-91 cm', '66 cm', '36 cm'] },
      { size: 'M', measurements: ['97-102 cm', '69 cm', '38 cm'] },
      { size: 'L', measurements: ['107-112 cm', '71 cm', '41 cm'] },
      { size: 'XL', measurements: ['117-122 cm', '74 cm', '43 cm'] },
    ],
    unit: STORE_DEFAULTS.measurementUnit,
  },
}

export function SizeGuide({ productType }: SizeGuideProps) {
  const t = useTranslations('product.sizeGuide')
  const [open, setOpen] = useState(false)

  // Map real category slugs to size guide keys
  const categoryMap: Record<string, string> = {
    't-shirts': 'tshirt',
    'pullover-hoodies': 'hoodie',
    'zip-hoodies': 'hoodie',
    'crewnecks': 'hoodie',
    'tanks': 'tank',
    'sweatpants': 'sweatpants',
  }
  const normalizedType = categoryMap[productType.toLowerCase()] || productType.toLowerCase().replace(/[-\s]+/g, '')
  const guideData = sizeGuideData[normalizedType] || sizeGuideData['tshirt']

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="h-auto p-0 text-sm text-primary hover:underline">
          <Ruler className="size-3 mr-1" />
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {guideData.headers.map((header, index) => (
                  <TableHead key={index} className={index === 0 ? 'font-bold' : ''}>
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {guideData.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  <TableCell className="font-medium">{row.size}</TableCell>
                  {row.measurements.map((measurement, cellIndex) => (
                    <TableCell key={cellIndex}>{measurement}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>{t('note')}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
