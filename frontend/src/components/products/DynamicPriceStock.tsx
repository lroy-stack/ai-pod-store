// Server component for dynamic pricing and stock information
// This component will stream in after the static shell loads (PPR)

import { Badge } from '@/components/ui/badge'
import { formatPrice, getLocalizedPrice } from '@/lib/currency'

interface DynamicPriceStockProps {
  productId: string
  price: number
  currency: string
  locale: string
}

// Simulate async data fetching for dynamic pricing/stock
async function getDynamicPriceAndStock(productId: string, price: number, currency: string) {
  // Simulate network delay to demonstrate PPR
  await new Promise(resolve => setTimeout(resolve, 100))

  // In production, this would fetch real-time pricing and stock from the database
  // For now, return the product data with some randomness to show it's dynamic
  const inStock = true // In production: check actual inventory
  const dynamicPrice = price // In production: apply dynamic pricing rules

  return {
    price: dynamicPrice,
    currency,
    inStock,
  }
}

export async function DynamicPriceStock({ productId, price, currency, locale }: DynamicPriceStockProps) {
  const data = await getDynamicPriceAndStock(productId, price, currency)
  const localizedPrice = getLocalizedPrice(data.price, data.currency, locale)
  const formattedPrice = formatPrice(localizedPrice, locale)

  return (
    <div className="space-y-4">
      <p className="text-4xl font-bold text-foreground">{formattedPrice}</p>
      {data.inStock ? (
        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
          In Stock
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
          Out of Stock
        </Badge>
      )}
    </div>
  )
}
