'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { Star, Heart, ShoppingCart, ChevronLeft, Shirt, Droplets, Globe, Printer, ShieldCheck, Paintbrush } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { useWishlist } from '@/hooks/useWishlist'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatPrice, getLocalizedPrice } from '@/lib/currency'
import { ProductPersonalizer, PersonalizationData } from './ProductPersonalizer'
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
  const searchParams = useSearchParams()
  const t = useTranslations('product')
  const tNav = useTranslations('navigation')
  const tCategory = useTranslations('shop.category')
  const locale = useLocale()
  const { addToCart } = useCart()
  const { isWishlisted, toggleWishlist } = useWishlist()

  // Extract variant data early for default selection
  const sizes = product?.variants && 'sizes' in product.variants ? product.variants.sizes as string[] : undefined
  const colors = product?.variants && 'colors' in product.variants ? product.variants.colors as string[] : undefined
  const allColors = product?.variants && 'allColors' in product.variants ? product.variants.allColors as string[] : colors
  const allSizes = product?.variants && 'allSizes' in product.variants ? product.variants.allSizes as string[] : sizes
  const unavailableCombinations = product?.variants && 'unavailableCombinations' in product.variants
    ? product.variants.unavailableCombinations as Array<{ color: string; size: string }>
    : []
  const colorImageIndices = product?.variants && 'colorImageIndices' in product.variants ? product.variants.colorImageIndices as Record<string, number[]> : undefined
  const sizeImageIndices = product?.variants && 'sizeImageIndices' in product.variants ? product.variants.sizeImageIndices as Record<string, number[]> : undefined

  const hasColorMapping = !!(colorImageIndices && Object.keys(colorImageIndices).length > 0)
  const hasSizeMapping = !!(sizeImageIndices && Object.keys(sizeImageIndices).length > 0)

  // Available sets for quick lookup
  const availableColorSet = new Set(colors || [])
  const availableSizeSet = new Set(sizes || [])

  // Read ?color= from URL to pre-select the variant from ProductCard navigation
  const initialColor = searchParams.get('color')

  const [selectedImage, setSelectedImage] = useState(0)
  // Auto-select first option when variant-to-image mapping exists
  const [selectedSize, setSelectedSize] = useState<string>(
    hasSizeMapping && sizes && sizes.length > 0 ? sizes[0] : ''
  )
  const [selectedColor, setSelectedColor] = useState<string>(
    initialColor && colors?.includes(initialColor)
      ? initialColor
      : (hasColorMapping && colors && colors.length > 0 ? colors[0] : '')
  )
  const [quantity, setQuantity] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [personalization, setPersonalization] = useState<PersonalizationData | null>(null)

  // Filter images by selected variant (color takes priority, then size)
  const visibleImages: string[] = (() => {
    if (!product) return []
    // Color filter
    if (hasColorMapping && selectedColor && colorImageIndices?.[selectedColor]) {
      return colorImageIndices[selectedColor].map((idx: number) => product.images[idx]).filter(Boolean)
    }
    // Size filter (for products like mugs with 11oz/15oz)
    if (hasSizeMapping && selectedSize && sizeImageIndices?.[selectedSize]) {
      return sizeImageIndices[selectedSize].map((idx: number) => product.images[idx]).filter(Boolean)
    }
    return product.images.filter(Boolean)
  })()

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

  const wishlisted = product ? isWishlisted(product.id) : false

  // Check if current combination is available
  const isCurrentCombinationAvailable = (() => {
    if (!product?.inStock) return false
    // If we have unavailable combinations, check current selection
    if (unavailableCombinations.length > 0 && selectedColor && selectedSize) {
      return !unavailableCombinations.some(
        uc => uc.color === selectedColor && uc.size === selectedSize
      )
    }
    // If only color matters, check if color is available
    if (selectedColor && !availableColorSet.has(selectedColor)) return false
    // If only size matters, check if size is available
    if (selectedSize && !availableSizeSet.has(selectedSize)) return false
    return product?.inStock !== false
  })()

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
            {visibleImages[selectedImage] ? (
              <Image
                src={visibleImages[selectedImage]}
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
          {visibleImages.length > 1 && (
            <div className="grid grid-cols-4 gap-4">
              {visibleImages.map((image: string, index: number) => (
                <Button
                  key={image}
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

          {/* Product Specifications */}
          {(product.materials || product.careInstructions || product.printTechnique || product.manufacturingCountry) && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">{t('specifications')}</h2>

              {product.materials && (
                <div className="flex items-start gap-3">
                  <Shirt className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t('materials')}</p>
                    <p className="text-sm text-muted-foreground">{product.materials}</p>
                  </div>
                </div>
              )}

              {product.careInstructions && (
                <div className="flex items-start gap-3">
                  <Droplets className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t('careInstructions')}</p>
                    <p className="text-sm text-muted-foreground">{product.careInstructions}</p>
                  </div>
                </div>
              )}

              {product.printTechnique && (
                <div className="flex items-start gap-3">
                  <Printer className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t('printTechnique')}</p>
                    <p className="text-sm text-muted-foreground">{product.printTechnique}</p>
                  </div>
                </div>
              )}

              {product.manufacturingCountry && (
                <div className="flex items-start gap-3">
                  <Globe className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t('madeIn')}</p>
                    <p className="text-sm text-muted-foreground">{product.manufacturingCountry}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GPSR Safety Information (EU regulation) */}
          {product.safetyInformation && (
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ShieldCheck className="size-4 shrink-0" />
                {t('safetyInformation')}
                <span className="ml-auto text-xs group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div
                className="mt-2 text-sm text-muted-foreground prose prose-sm max-w-none [&_p]:my-1 [&_strong]:text-foreground"
                dangerouslySetInnerHTML={{ __html: product.safetyInformation }}
              />
            </details>
          )}

          <Separator />

          {/* Variants */}
          <div className="space-y-4">
            {allSizes && allSizes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">{t('size')}</label>
                  {product.category === 'apparel' && <SizeGuide productType={product.title} />}
                </div>
                <Select value={selectedSize} onValueChange={(size) => {
                  setSelectedSize(size)
                  if (hasSizeMapping) setSelectedImage(0)
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectVariant')} />
                  </SelectTrigger>
                  <SelectContent>
                    {allSizes.map((size: string) => {
                      const isSizeAvailable = availableSizeSet.has(size)
                      return (
                        <SelectItem
                          key={size}
                          value={size}
                          disabled={!isSizeAvailable}
                          className={cn(!isSizeAvailable && 'opacity-40 line-through')}
                        >
                          {size}{!isSizeAvailable ? ` — ${t('outOfStock')}` : ''}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {allColors && allColors.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">{t('color')}</label>
                <Select value={selectedColor} onValueChange={(color) => {
                  setSelectedColor(color)
                  // Reset to first image of the new color
                  setSelectedImage(0)
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectVariant')} />
                  </SelectTrigger>
                  <SelectContent>
                    {allColors.map((color: string) => {
                      const isColorAvailable = availableColorSet.has(color)
                      return (
                        <SelectItem
                          key={color}
                          value={color}
                          disabled={!isColorAvailable}
                          className={cn(!isColorAvailable && 'opacity-40 line-through')}
                        >
                          {color}{!isColorAvailable ? ` — ${t('outOfStock')}` : ''}
                        </SelectItem>
                      )
                    })}
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

          {/* Personalization badge */}
          {personalization && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Paintbrush className="size-3" />
                &quot;{personalization.text.slice(0, 25)}{personalization.text.length > 25 ? '...' : ''}&quot;
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setPersonalization(null)}
              >
                {t('personalizeClear')}
              </Button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              className="flex-1"
              size="lg"
              disabled={!isCurrentCombinationAvailable || isAddingToCart}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="size-5 mr-2" />
              {!isCurrentCombinationAvailable ? t('outOfStock') : isAddingToCart ? t('adding') || 'Adding...' : t('addToCart')}
            </Button>
            <ProductPersonalizer
              productId={product.id}
              productTitle={product.title}
              productImage={visibleImages[selectedImage] || product.image}
              category={product.category}
              onPersonalized={setPersonalization}
              onClear={() => setPersonalization(null)}
              initialData={personalization || undefined}
            />
            <Button
              variant="outline"
              size="lg"
              onClick={() => toggleWishlist(product.id)}
              aria-label={wishlisted ? t('removeFromWishlist') : t('addToWishlist')}
            >
              <Heart
                className={cn(
                  'size-5',
                  wishlisted ? 'fill-destructive text-destructive' : 'text-muted-foreground'
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
