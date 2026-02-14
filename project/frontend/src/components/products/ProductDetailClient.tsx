'use client'

import { useRouter } from 'next/navigation'
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
import { SizeGuide } from '@/components/products/SizeGuide'
import { ReviewForm } from '@/components/products/ReviewForm'

interface ProductDetailClientProps {
  product: any
  relatedProducts: any[]
  reviews: any[]
}

export function ProductDetailClient({ product, relatedProducts, reviews }: ProductDetailClientProps) {
  const router = useRouter()
  const t = useTranslations('product')
  const tNav = useTranslations('navigation')
  const tCategory = useTranslations('shop.category')
  const locale = useLocale()
  const { addToCart } = useCart()

  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)

  // Extract variants to avoid TypeScript union narrowing issues
  const sizes = product?.variants && 'sizes' in product.variants ? product.variants.sizes : undefined
  const colors = product?.variants && 'colors' in product.variants ? product.variants.colors : undefined

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

  const toggleWishlist = async () => {
    if (!product) return

    try {
      if (isWishlisted) {
        // Remove from wishlist - for now just toggle state
        // Will need item_id to properly remove, so just toggle
        setIsWishlisted(false)
      } else {
        // Add to wishlist - need to get user's default wishlist first
        const wishlistsRes = await fetch('/api/wishlist')
        const wishlistsData = await wishlistsRes.json()

        let wishlistId: string

        if (wishlistsData.wishlists && wishlistsData.wishlists.length > 0) {
          // Use first wishlist
          wishlistId = wishlistsData.wishlists[0].id
        } else {
          // Create new wishlist
          const createRes = await fetch('/api/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'My Wishlist' }),
          })
          const createData = await createRes.json()
          wishlistId = createData.wishlist.id
        }

        // Add item to wishlist
        const response = await fetch('/api/wishlist/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wishlist_id: wishlistId,
            product_id: product.id,
            variant_id: null,
          }),
        })

        if (response.ok) {
          setIsWishlisted(true)
        } else if (response.status === 409) {
          // Already in wishlist
          setIsWishlisted(true)
        }
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error)
    }
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
        product.id,
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
            {product.images[selectedImage] ? (
              <Image
                src={product.images[selectedImage]}
                alt={product.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                {product.title}
              </div>
            )}
          </div>

          {/* Thumbnail Gallery */}
          {product.images.filter(Boolean).length > 1 && (
            <div className="grid grid-cols-4 gap-4">
              {product.images.filter(Boolean).map((image: string, index: number) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => setSelectedImage(index)}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden border-2 transition-colors p-0 h-auto',
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
                </Button>
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
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">{t('size')}</label>
                  {product.category === 'apparel' && <SizeGuide productType={product.title} />}
                </div>
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
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl font-bold">{t('reviews')}</h2>
          <div className="flex items-center gap-4">
            {renderStars(product.rating)}
            <span className="text-sm text-muted-foreground">
              {product.rating.toFixed(1)} {t('outOf')} 5
            </span>
          </div>
        </div>

        {product.reviewCount === 0 || reviews.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-2">{t('noReviews')}</p>
              <p className="text-sm text-muted-foreground">{t('beTheFirst')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              {t('showingReviews', { count: reviews.length, total: product.reviewCount })}
            </p>
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">{review.author}</p>
                        {review.verified && (
                          <Badge variant="outline" className="text-xs">
                            {t('verifiedPurchase')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(review.date).toLocaleDateString(locale, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    {renderStars(review.rating)}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{review.comment}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Review Form */}
        <div className="mt-8">
          {!showReviewForm ? (
            <Button onClick={() => setShowReviewForm(true)} variant="outline" className="w-full sm:w-auto">
              {t('writeReview')}
            </Button>
          ) : (
            <ReviewForm
              productId={product.id}
              onReviewSubmitted={() => {
                setShowReviewForm(false)
                router.refresh()
              }}
            />
          )}
        </div>
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
