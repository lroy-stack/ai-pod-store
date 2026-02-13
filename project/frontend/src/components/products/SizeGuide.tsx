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

interface SizeGuideProps {
  productType: string
}

// Size guide data for different product types
const sizeGuideData: Record<string, {
  headers: string[]
  rows: Array<{ size: string; measurements: string[] }>
  unit: string
}> = {
  tshirt: {
    headers: ['Size', 'Chest', 'Length', 'Shoulder'],
    rows: [
      { size: 'S', measurements: ['34-36"', '27"', '16"'] },
      { size: 'M', measurements: ['38-40"', '28"', '17"'] },
      { size: 'L', measurements: ['42-44"', '29"', '18"'] },
      { size: 'XL', measurements: ['46-48"', '30"', '19"'] },
      { size: 'XXL', measurements: ['50-52"', '31"', '20"'] },
    ],
    unit: 'inches',
  },
  hoodie: {
    headers: ['Size', 'Chest', 'Length', 'Shoulder', 'Sleeve'],
    rows: [
      { size: 'S', measurements: ['36-38"', '26"', '17"', '33"'] },
      { size: 'M', measurements: ['40-42"', '27"', '18"', '34"'] },
      { size: 'L', measurements: ['44-46"', '28"', '19"', '35"'] },
      { size: 'XL', measurements: ['48-50"', '29"', '20"', '36"'] },
    ],
    unit: 'inches',
  },
  sweatpants: {
    headers: ['Size', 'Waist', 'Hip', 'Inseam'],
    rows: [
      { size: 'S', measurements: ['28-30"', '36-38"', '29"'] },
      { size: 'M', measurements: ['32-34"', '40-42"', '30"'] },
      { size: 'L', measurements: ['36-38"', '44-46"', '31"'] },
      { size: 'XL', measurements: ['40-42"', '48-50"', '32"'] },
    ],
    unit: 'inches',
  },
  tank: {
    headers: ['Size', 'Chest', 'Length', 'Shoulder'],
    rows: [
      { size: 'S', measurements: ['34-36"', '26"', '14"'] },
      { size: 'M', measurements: ['38-40"', '27"', '15"'] },
      { size: 'L', measurements: ['42-44"', '28"', '16"'] },
      { size: 'XL', measurements: ['46-48"', '29"', '17"'] },
    ],
    unit: 'inches',
  },
}

export function SizeGuide({ productType }: SizeGuideProps) {
  const t = useTranslations('product.sizeGuide')
  const [open, setOpen] = useState(false)

  // Normalize product type to match size guide keys
  const normalizedType = productType.toLowerCase().replace(/\s+/g, '')
  const guideData = sizeGuideData[normalizedType] || sizeGuideData['tshirt'] // Default to t-shirt guide

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
