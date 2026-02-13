'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useState } from 'react'
import { Star, Heart, ShoppingCart, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Mock product data - will be replaced with API call
const mockProducts = {
  '1': {
    id: '1',
    title: 'Classic T-Shirt',
    description: 'Comfortable cotton t-shirt perfect for everyday wear. Made from 100% premium cotton with a modern fit.',
    longDescription: 'Our Classic T-Shirt combines comfort and style in one essential piece. Crafted from soft, breathable 100% cotton, this shirt features a modern fit that looks great on everyone. The durable construction ensures it will be a wardrobe staple for years to come. Available in multiple sizes and colors to match your style.',
    price: 24.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/3b82f6/ffffff?text=T-Shirt+Front',
      'https://via.placeholder.com/600x600/3b82f6/ffffff?text=T-Shirt+Back',
      'https://via.placeholder.com/600x600/3b82f6/ffffff?text=T-Shirt+Detail',
    ],
    rating: 4.5,
    reviewCount: 128,
    category: 'apparel',
    inStock: true,
    variants: {
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['Black', 'White', 'Navy', 'Gray'],
    },
  },
  '2': {
    id: '2',
    title: 'Hoodie',
    description: 'Cozy fleece hoodie for chilly days',
    longDescription: 'Stay warm and comfortable in our premium fleece hoodie. Features a soft interior lining, adjustable drawstring hood, and kangaroo pocket. Perfect for layering or wearing on its own.',
    price: 49.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/8b5cf6/ffffff?text=Hoodie+Front',
      'https://via.placeholder.com/600x600/8b5cf6/ffffff?text=Hoodie+Back',
    ],
    rating: 4.8,
    reviewCount: 94,
    category: 'apparel',
    inStock: true,
    variants: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Black', 'Gray', 'Navy'],
    },
  },
  '3': {
    id: '3',
    title: 'Mug',
    description: 'Ceramic coffee mug',
    longDescription: 'Start your day right with our high-quality ceramic mug. Microwave and dishwasher safe, this 11oz mug is perfect for coffee, tea, or hot chocolate.',
    price: 14.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/10b981/ffffff?text=Mug+Front',
      'https://via.placeholder.com/600x600/10b981/ffffff?text=Mug+Side',
    ],
    rating: 4.3,
    reviewCount: 256,
    category: 'home',
    inStock: true,
    variants: {
      colors: ['White', 'Black'],
    },
  },
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('product')
  const productId = params.id as string
  const product = mockProducts[productId as keyof typeof mockProducts]

  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [isWishlisted, setIsWishlisted] = useState(false)

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto text-center">
          <CardHeader>
            <CardTitle>{t('notFound')}</CardTitle>
            <CardDescription>{t('notFoundDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.back()} variant="outline">
              <ChevronLeft className="size-4 mr-2" />
              {t('backToShop')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price)
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'size-5',
              star <= Math.round(rating)
                ? 'fill-rating text-rating'
                : 'text-muted-foreground/50'
            )}
          />
        ))}
      </div>
    )
  }

  const toggleWishlist = () => {
    setIsWishlisted(!isWishlisted)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-6"
      >
        <ChevronLeft className="size-4 mr-2" />
        {t('backToShop')}
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image Gallery */}
        <div className="space-y-4">
          <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
            <Image
              src={product.images[selectedImage]}
              alt={product.title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>

          {/* Thumbnail Gallery */}
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-4">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden border-2 transition-colors',
                    selectedImage === index
                      ? 'border-primary'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <Image
                    src={image}
                    alt={`${product.title} ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 25vw, 12.5vw"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Title and Rating */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{product.title}</h1>
            <div className="flex items-center gap-4 mb-4">
              {renderStars(product.rating)}
              <span className="text-sm text-muted-foreground">
                {t('reviewsCount', { count: product.reviewCount })}
              </span>
            </div>
            <p className="text-3xl font-bold">{formatPrice(product.price, product.currency)}</p>
          </div>

          <Separator />

          {/* Stock Status */}
          <div>
            {product.inStock ? (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                {t('inStock')}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                {t('outOfStock')}
              </Badge>
            )}
          </div>

          {/* Description */}
          <div>
            <h2 className="text-xl font-semibold mb-2">{t('description')}</h2>
            <p className="text-muted-foreground leading-relaxed">{product.longDescription}</p>
          </div>

          <Separator />

          {/* Variants */}
          <div className="space-y-4">
            {product.variants.sizes && (
              <div>
                <label className="text-sm font-medium mb-2 block">{t('size')}</label>
                <Select value={selectedSize} onValueChange={setSelectedSize}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectVariant')} />
                  </SelectTrigger>
                  <SelectContent>
                    {product.variants.sizes.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {product.variants.colors && (
              <div>
                <label className="text-sm font-medium mb-2 block">{t('color')}</label>
                <Select value={selectedColor} onValueChange={setSelectedColor}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectVariant')} />
                  </SelectTrigger>
                  <SelectContent>
                    {product.variants.colors.map((color) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">{t('quantity')}</label>
              <Select
                value={quantity.toString()}
                onValueChange={(value) => setQuantity(parseInt(value))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              className="flex-1"
              size="lg"
              disabled={!product.inStock}
            >
              <ShoppingCart className="size-5 mr-2" />
              {t('addToCart')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={toggleWishlist}
              aria-label={isWishlisted ? t('removeFromWishlist') : t('addToWishlist')}
            >
              <Heart
                className={cn(
                  'size-5',
                  isWishlisted ? 'fill-destructive text-destructive' : ''
                )}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <Separator className="my-12" />

      <div className="max-w-4xl">
        <h2 className="text-2xl font-bold mb-6">{t('reviews')}</h2>

        {product.reviewCount === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-2">{t('noReviews')}</p>
              <p className="text-sm text-muted-foreground">{t('beTheFirst')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="py-6">
                <p className="text-muted-foreground">
                  {t('reviewsCount', { count: product.reviewCount })}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
