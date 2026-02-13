'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { Star, Heart, ShoppingCart, ChevronLeft } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatPrice, getLocalizedPrice } from '@/lib/currency'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ProductCard } from '@/components/products/ProductCard'

// Mock product data - will be replaced with API call
const mockProducts = {
  '1': {
    id: '00000000-0000-0000-0000-000000000001',
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
    id: '00000000-0000-0000-0000-000000000002',
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
    id: '00000000-0000-0000-0000-000000000003',
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
  '4': {
    id: '4',
    title: 'Poster',
    description: 'High-quality art poster',
    longDescription: 'Decorate your space with our premium art posters. Printed on high-quality paper with vibrant colors that last.',
    price: 19.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/f59e0b/ffffff?text=Poster',
    ],
    rating: 4.6,
    reviewCount: 87,
    category: 'home',
    inStock: true,
    variants: {
      sizes: ['A3', 'A4', 'A2'],
    },
  },
  '5': {
    id: '5',
    title: 'Phone Case',
    description: 'Protective phone case',
    longDescription: 'Keep your phone safe with our durable protective case. Slim design with shock-absorbing corners.',
    price: 16.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/ef4444/ffffff?text=Case',
    ],
    rating: 4.4,
    reviewCount: 312,
    category: 'accessories',
    inStock: true,
    variants: {
      models: ['iPhone 14', 'iPhone 15', 'Samsung S23'],
    },
  },
  '6': {
    id: '6',
    title: 'Tote Bag',
    description: 'Eco-friendly tote bag',
    longDescription: 'Carry your essentials in style with our eco-friendly tote bag. Made from sustainable materials.',
    price: 18.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/06b6d4/ffffff?text=Bag',
    ],
    rating: 4.7,
    reviewCount: 143,
    category: 'accessories',
    inStock: true,
    variants: {
      colors: ['Natural', 'Black', 'Navy'],
    },
  },
}

// Add UUID aliases for products 1-3
mockProducts['00000000-0000-0000-0000-000000000001'] = mockProducts['1']
mockProducts['00000000-0000-0000-0000-000000000002'] = mockProducts['2']
mockProducts['00000000-0000-0000-0000-000000000003'] = mockProducts['3']

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('product')
  const tNav = useTranslations('navigation')
  const tCategory = useTranslations('shop.category')
  const locale = useLocale()
  const { addToCart } = useCart()
  const productId = params.id as string
  const product = mockProducts[productId as keyof typeof mockProducts]

  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)

  // Extract variants to avoid TypeScript union narrowing issues
  const sizes = product?.variants && 'sizes' in product.variants ? product.variants.sizes : undefined
  const colors = product?.variants && 'colors' in product.variants ? product.variants.colors : undefined

  // Get related products (same category, exclude current product, limit to 4)
  // Use a Set to track unique product IDs and avoid duplicates
  const seenIds = new Set<string>()
  const relatedProducts = Object.values(mockProducts)
    .filter((p) => {
      if (p.category !== product?.category || p.id === product?.id || seenIds.has(p.id)) {
        return false
      }
      seenIds.add(p.id)
      return true
    })
    .slice(0, 4)
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.price,
      currency: p.currency,
      image: p.images[0],
      rating: p.rating,
      reviewCount: p.reviewCount,
      category: p.category,
    }))

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

  // Convert price to locale's currency and format it
  const localizedPrice = getLocalizedPrice(product.price, product.currency, locale)
  const formattedPrice = formatPrice(localizedPrice, locale)

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

  const handleAddToCart = async () => {
    if (!product) return

    // Validate variant selection if applicable
    if (sizes && sizes.length > 0 && !selectedSize) {
      return // Size is required but not selected
    }
    if (colors && colors.length > 0 && !selectedColor) {
      return // Color is required but not selected
    }

    setIsAddingToCart(true)
    try {
      await addToCart(
        product.id, // Use product.id (the UUID) instead of productId (URL param)
        quantity,
        {
          size: selectedSize || undefined,
          color: selectedColor || undefined,
        },
        product.title,
        product.price
      )
    } catch (error) {
      // Error is already handled by useCart with toast
      console.error('Failed to add to cart:', error)
    } finally {
      setIsAddingToCart(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb Navigation */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${locale}`}>{tNav('home')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${locale}/shop`}>{tNav('shop')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${locale}/shop?category=${product.category}`}>
                {tCategory(product.category)}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{product.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

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
            <p className="text-3xl font-bold">{formattedPrice}</p>
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
            {sizes && sizes.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">{t('size')}</label>
                <Select value={selectedSize} onValueChange={setSelectedSize}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectVariant')} />
                  </SelectTrigger>
                  <SelectContent>
                    {sizes.map((size: string) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {colors && colors.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">{t('color')}</label>
                <Select value={selectedColor} onValueChange={setSelectedColor}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectVariant')} />
                  </SelectTrigger>
                  <SelectContent>
                    {colors.map((color: string) => (
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
              disabled={!product.inStock || isAddingToCart}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="size-5 mr-2" />
              {isAddingToCart ? t('adding') || 'Adding...' : t('addToCart')}
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

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <>
          <Separator className="my-12" />

          <div>
            <h2 className="text-2xl font-bold mb-6">{t('relatedProducts')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
