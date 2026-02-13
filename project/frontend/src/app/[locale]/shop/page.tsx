import { useTranslations } from 'next-intl'
import { ProductGrid } from '@/components/products/ProductGrid'

// Mock products for now - will be replaced with API call
const mockProducts = [
  {
    id: '1',
    title: 'Classic T-Shirt',
    description: 'Comfortable cotton t-shirt',
    price: 24.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/3b82f6/ffffff?text=T-Shirt',
    rating: 4.5,
    reviewCount: 128,
    category: 'apparel',
  },
  {
    id: '2',
    title: 'Hoodie',
    description: 'Cozy fleece hoodie',
    price: 49.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/8b5cf6/ffffff?text=Hoodie',
    rating: 4.8,
    reviewCount: 94,
    category: 'apparel',
  },
  {
    id: '3',
    title: 'Mug',
    description: 'Ceramic coffee mug',
    price: 14.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/10b981/ffffff?text=Mug',
    rating: 4.3,
    reviewCount: 256,
    category: 'home',
  },
  {
    id: '4',
    title: 'Poster',
    description: 'High-quality art poster',
    price: 19.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/f59e0b/ffffff?text=Poster',
    rating: 4.6,
    reviewCount: 87,
    category: 'home',
  },
  {
    id: '5',
    title: 'Phone Case',
    description: 'Protective phone case',
    price: 16.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/ef4444/ffffff?text=Case',
    rating: 4.4,
    reviewCount: 312,
    category: 'accessories',
  },
  {
    id: '6',
    title: 'Tote Bag',
    description: 'Eco-friendly tote bag',
    price: 18.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/06b6d4/ffffff?text=Bag',
    rating: 4.7,
    reviewCount: 143,
    category: 'accessories',
  },
]

export default function ShopPage() {
  const t = useTranslations('shop')

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ProductGrid products={mockProducts} />
    </div>
  )
}
