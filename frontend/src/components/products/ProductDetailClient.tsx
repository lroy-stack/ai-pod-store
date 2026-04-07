'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { Star, Heart, ShoppingCart, ChevronLeft, Shirt, Droplets, Globe, Printer, ShieldCheck, Paintbrush2, Share2, Truck, Package, RotateCcw } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { useWishlist } from '@/hooks/useWishlist'
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatPrice, getLocalizedPrice } from '@/lib/currency'
import { SafeHTML } from '@/components/common/SafeHTML'
import { trackProductView, trackAddToCart as trackAnalyticsAddToCart } from '@/lib/analytics'
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
import { SmartStickyCTA } from '@/components/products/SmartStickyCTA'
import { StrikethroughPrice } from '@/components/products/StrikethroughPrice'
import { SocialProofIndicator } from '@/components/products/SocialProofIndicator'
import type { ProductDetail } from '@/types/product'

interface ProductDetailClientProps {
  product: ProductDetail
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
  const { trackView, getRecentlyViewed } = useRecentlyViewed()

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

  // Build variant price lookup for per-size/color pricing
  const getVariantPrice = useMemo(() => {
    const prices = product?.variants?.prices
    if (!prices?.length) return () => product?.price ?? 0
    const map = new Map<string, number>()
    for (const vp of prices) {
      map.set(`${vp.size}::${vp.color}`, vp.price)
    }
    return (size: string, color: string): number => {
      return map.get(`${size}::${color}`)
        ?? map.get(`${size}::`)
        ?? map.get(`::${color}`)
        ?? product?.price ?? 0
    }
  }, [product?.variants?.prices, product?.price])

  // Available sets for quick lookup
  const availableColorSet = new Set(colors || [])
  const availableSizeSet = new Set(sizes || [])

  // Read ?color= from URL to pre-select the variant from ProductCard navigation
  const initialColor = searchParams.get('color')
  const compositionIdParam = searchParams.get('compositionId')

  const [selectedImage, setSelectedImage] = useState(0)
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true })

  // Sync embla carousel selection with selectedImage state
  const onEmblaSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedImage(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onEmblaSelect)
    return () => { emblaApi.off('select', onEmblaSelect) }
  }, [emblaApi, onEmblaSelect])

  // When selectedImage changes externally (thumbnail click, color change), scroll embla
  useEffect(() => {
    if (emblaApi) emblaApi.scrollTo(selectedImage, true)
  }, [emblaApi, selectedImage])

  // Auto-select: single option always, first option when image mapping exists, or URL param
  const [selectedSize, setSelectedSize] = useState<string>(
    sizes?.length === 1
      ? sizes[0]
      : (hasSizeMapping && sizes && sizes.length > 0 ? sizes[0] : '')
  )
  const [selectedColor, setSelectedColor] = useState<string>(
    initialColor && colors?.includes(initialColor)
      ? initialColor
      : (colors?.length === 1
          ? colors[0]
          : (hasColorMapping && colors && colors.length > 0 ? colors[0] : ''))
  )
  const [quantity, setQuantity] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const mainCtaRef = useRef<HTMLDivElement>(null)

  // Cross-filter: when a color is selected, compute which sizes are available for it
  const availableSizesForColor = useMemo(() => {
    if (!selectedColor || !unavailableCombinations.length) return availableSizeSet
    const blocked = new Set(
      unavailableCombinations
        .filter(uc => uc.color === selectedColor)
        .map(uc => uc.size)
    )
    return new Set([...availableSizeSet].filter(s => !blocked.has(s)))
  }, [selectedColor, unavailableCombinations, availableSizeSet])

  // Cross-filter: when a size is selected, compute which colors are available for it
  const availableColorsForSize = useMemo(() => {
    if (!selectedSize || !unavailableCombinations.length) return availableColorSet
    const blocked = new Set(
      unavailableCombinations
        .filter(uc => uc.size === selectedSize)
        .map(uc => uc.color)
    )
    return new Set([...availableColorSet].filter(c => !blocked.has(c)))
  }, [selectedSize, unavailableCombinations, availableColorSet])

  // Auto-reset size when it becomes unavailable for the selected color
  useEffect(() => {
    if (selectedSize && availableSizesForColor.size > 0 && !availableSizesForColor.has(selectedSize)) {
      const first = [...availableSizesForColor][0]
      if (first) setSelectedSize(first)
    }
  }, [availableSizesForColor, selectedSize])

  // Auto-reset color when it becomes unavailable for the selected size
  useEffect(() => {
    if (selectedColor && availableColorsForSize.size > 0 && !availableColorsForSize.has(selectedColor)) {
      const first = [...availableColorsForSize][0]
      if (first) setSelectedColor(first)
    }
  }, [availableColorsForSize, selectedColor])

  // Build colorImages map for recently viewed (color → first image URL)
  const colorImagesForCard = hasColorMapping && colorImageIndices && product?.images
    ? Object.fromEntries(
        Object.entries(colorImageIndices)
          .filter(([, indices]) => (indices as number[]).length > 0)
          .map(([color, indices]) => [color, product.images[(indices as number[])[0]]])
          .filter(([, img]) => img)
      )
    : undefined

  // Track product view in localStorage
  useEffect(() => {
    if (product) {
      trackView({
        id: product.id,
        slug: product.slug,
        title: product.title,
        price: product.price,
        currency: product.currency,
        image: product.images && product.images.length > 0 ? product.images[0] : null,
        compareAtPrice: product.compareAtPrice,
        colorImages: colorImagesForCard,
      })
      // Track analytics event
      trackProductView(product.id, product.title, product.price)
    }
  }, [product?.id])

  // Get recently viewed products excluding current one
  const recentlyViewedProducts = product ? getRecentlyViewed(product.id) : []

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

  // Compute current variant price reactively (must be before early return to respect hooks order)
  const currentVariantPrice = useMemo(
    () => getVariantPrice(selectedSize, selectedColor),
    [getVariantPrice, selectedSize, selectedColor]
  )

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
  const localizedPrice = getLocalizedPrice(currentVariantPrice, product.currency, locale)
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
    return product.inStock ?? true
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
        currentVariantPrice,
        undefined,
        compositionIdParam || undefined
      )
      // Track analytics event
      trackAnalyticsAddToCart(product.id, product.title, currentVariantPrice, quantity)
    } catch (error) {
      // Error is already handled by useCart with toast
      console.error('Failed to add to cart:', error)
    } finally {
      setIsAddingToCart(false)
    }
  }

  const handleBuyNow = async () => {
    if (!product) return
    if (sizes && sizes.length > 0 && !selectedSize) {
      toast.error(t('selectSize'))
      return
    }
    if (colors && colors.length > 0 && !selectedColor) {
      toast.error(t('selectColor'))
      return
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
        currentVariantPrice,
        undefined,
        compositionIdParam || undefined
      )
      router.push(`/${locale}/checkout`)
    } catch (error) {
      console.error('Failed to buy now:', error)
    } finally {
      setIsAddingToCart(false)
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    const title = product.title || 'Check out this product'

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch (err) {
        // User cancelled or share failed — ignore AbortError
        if (err instanceof Error && err.name !== 'AbortError') {
          await navigator.clipboard.writeText(url)
          toast(t('linkCopied'))
        }
      }
    } else {
      await navigator.clipboard.writeText(url)
      toast(t('linkCopied'))
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
              <Link href={`/${locale}/shop/category/${product.category || ''}`}>
                {tCategory.has(product.category || '')
                  ? tCategory(product.category || '')
                  : (product.category || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
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
          {/* Swipeable Carousel */}
          <div ref={emblaRef} className="overflow-hidden rounded-lg">
            <div className="flex">
              {visibleImages.length > 0 ? visibleImages.map((image: string, index: number) => (
                <div key={`slide-${index}`} className="flex-[0_0_100%] min-w-0">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="relative aspect-square bg-muted w-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                        <Image
                          src={image}
                          alt={`${product.title} ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 50vw"
                          priority={index === 0}
                        />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl p-0 bg-background border-none">
                      <DialogTitle className="sr-only">{product.title}</DialogTitle>
                      <img
                        src={image}
                        alt={product.title}
                        className="w-full h-auto rounded-lg"
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              )) : (
                <div className="flex-[0_0_100%] min-w-0">
                  <div className="relative aspect-square bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                    {product.title}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: Dot indicators + Wishlist + Share (Amazon-style row) */}
          <div className="flex items-center justify-between md:hidden">
            <div className="flex items-center gap-1.5">
              {visibleImages.length > 1 && visibleImages.map((_, index) => (
                <button
                  key={`dot-${index}`}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                  onClick={() => setSelectedImage(index)}
                  aria-label={`Image ${index + 1}`}
                >
                  <span className={cn(
                    'w-2.5 h-2.5 rounded-full transition-colors',
                    selectedImage === index ? 'bg-primary' : 'bg-muted-foreground/30'
                  )} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={(e) => { e.preventDefault(); toggleWishlist(product.id) }}
                aria-label={wishlisted ? t('removeFromWishlist') : t('addToWishlist')}
              >
                <Heart
                  className={cn(
                    'size-5',
                    wishlisted ? 'fill-destructive text-destructive' : 'text-muted-foreground'
                  )}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={handleShare}
                aria-label={t('share')}
              >
                <Share2 className="size-5" />
              </Button>
            </div>
          </div>

          {/* Thumbnail Gallery (hidden on mobile, visible on md+) */}
          {visibleImages.length > 1 && (
            <div className="hidden md:grid grid-cols-4 gap-4">
              {visibleImages.map((image: string, index: number) => (
                <Button
                  key={`img-${index}`}
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
        <div className="space-y-5">
          {/* 1. Title + Rating + Wishlist/Share (desktop only) */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">{product.title}</h1>
              {/* Desktop: Wishlist + Share beside title */}
              <div className="hidden md:flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => toggleWishlist(product.id)}
                  aria-label={wishlisted ? t('removeFromWishlist') : t('addToWishlist')}
                >
                  <Heart className={cn('size-5', wishlisted ? 'fill-destructive text-destructive' : 'text-muted-foreground')} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={handleShare}
                  aria-label={t('share')}
                >
                  <Share2 className="size-5" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap mt-1.5">
              {renderStars(product.rating ?? 0)}
              <span className="text-sm text-muted-foreground">
                {t('reviewsCount', { count: product.reviewCount ?? 0 })}
              </span>
            </div>
            <SocialProofIndicator productId={product.id} />
          </div>

          <Separator />

          {/* 2. Color selector */}
          {allColors && allColors.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('color')}{selectedColor && <span className="font-normal text-muted-foreground ml-1">— {selectedColor}</span>}
              </label>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide p-1 -m-1">
                {allColors.map((color: string) => {
                  const isColorAvailable = availableColorsForSize.has(color)
                  const colorImgIdx = colorImageIndices?.[color]?.[0]
                  const colorImg = colorImgIdx != null && product.images[colorImgIdx] ? product.images[colorImgIdx] : null
                  return (
                    <button
                      key={color}
                      onClick={() => {
                        if (!isColorAvailable) return
                        setSelectedColor(color)
                        setSelectedImage(0)
                      }}
                      disabled={!isColorAvailable}
                      className={cn(
                        'flex-shrink-0 rounded-lg border-2 p-1 transition-colors text-center',
                        selectedColor === color
                          ? 'border-primary ring-1 ring-primary/30'
                          : 'border-border hover:border-primary/50',
                        !isColorAvailable && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      {colorImg ? (
                        <Image src={colorImg} alt={color} width={56} height={56} className="rounded object-cover w-14 h-14 md:w-16 md:h-16" />
                      ) : (
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">{color.slice(0, 3)}</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 3. Size selector */}
          {allSizes && allSizes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">
                  {t('size')}{selectedSize && <span className="font-normal text-muted-foreground ml-1">— {selectedSize}</span>}
                </label>
                {['t-shirts', 'pullover-hoodies', 'zip-hoodies', 'crewnecks', 'tanks'].some(c => product.category?.includes(c)) && <SizeGuide productType={product.category || ''} />}
              </div>
              <div className="flex flex-wrap gap-2">
                {allSizes.map((size: string) => {
                  const isSizeAvailable = availableSizesForColor.has(size)
                  const isSelected = selectedSize === size
                  return (
                    <Button
                      key={size}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      disabled={!isSizeAvailable}
                      onClick={() => {
                        setSelectedSize(size)
                        if (hasSizeMapping) setSelectedImage(0)
                      }}
                      className={cn(
                        'min-w-[2.75rem] min-h-[2.75rem]',
                        !isSizeAvailable && 'opacity-40 line-through'
                      )}
                    >
                      {size}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          <Separator />

          {/* 4. Price + Stock + Shipping */}
          <div className="space-y-2">
            {product.compareAtPrice ? (
              <StrikethroughPrice
                price={localizedPrice}
                compareAtPrice={getLocalizedPrice(product.compareAtPrice, product.currency, locale)}
                locale={locale}
              />
            ) : (
              <p className="text-2xl md:text-3xl font-bold">{formattedPrice}</p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {product.inStock ? (
                <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
                  {t('inStock')}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                  {t('outOfStock')}
                </Badge>
              )}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Truck className="h-4 w-4 shrink-0" />
                <span>{t('freeShippingOver', { amount: '€50' })}</span>
              </div>
            </div>
          </div>

          {/* 5. Specifications — collapsible */}
          {(product.materials || product.careInstructions || product.printTechnique || product.manufacturingCountry) && (
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold hover:text-foreground transition-colors">
                {t('specifications')}
                <span className="text-xs group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-3 space-y-3">
                {product.materials && (
                  <div className="flex items-start gap-3">
                    <Shirt className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{t('materials')}</p>
                      <p className="text-sm text-muted-foreground">{product.materials}</p>
                    </div>
                  </div>
                )}
                {product.careInstructions && (
                  <div className="flex items-start gap-3">
                    <Droplets className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{t('careInstructions')}</p>
                      <p className="text-sm text-muted-foreground">{product.careInstructions}</p>
                    </div>
                  </div>
                )}
                {product.printTechnique && (
                  <div className="flex items-start gap-3">
                    <Printer className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{t('printTechnique')}</p>
                      <p className="text-sm text-muted-foreground">{product.printTechnique}</p>
                    </div>
                  </div>
                )}
                {product.manufacturingCountry && (
                  <div className="flex items-start gap-3">
                    <Globe className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{t('madeIn')}</p>
                      <p className="text-sm text-muted-foreground">{product.manufacturingCountry}</p>
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* GPSR Safety Information (EU regulation) */}
          {product.safetyInformation && (
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ShieldCheck className="size-4 shrink-0" />
                {t('safetyInformation')}
                <span className="ml-auto text-xs group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <SafeHTML
                html={product.safetyInformation}
                className="mt-2 text-sm text-muted-foreground prose prose-sm max-w-none [&_p]:my-1 [&_strong]:text-foreground"
              />
            </details>
          )}

          {/* Shipping Information */}
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold hover:text-foreground transition-colors">
              {t('shippingInfo')}
              <span className="text-xs group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <Truck className="size-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">{t('deliveryEstimate')}</p>
                  <p>{t('deliveryDetails')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Package className="size-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">{t('freeShippingTitle')}</p>
                  <p>{t('freeShippingDetails')}</p>
                </div>
              </div>
            </div>
          </details>

          {/* Return Policy */}
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold hover:text-foreground transition-colors">
              {t('returnPolicy')}
              <span className="text-xs group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <RotateCcw className="size-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">{t('returnTitle')}</p>
                  <p>{t('returnDetails')}</p>
                </div>
              </div>
            </div>
          </details>

          <Separator />

          {/* 6. Quantity */}
          <div className="flex items-end gap-4">
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
            {/* Custom design composition badge */}
            {compositionIdParam && (
              <Badge variant="secondary" className="gap-1.5 mb-1">
                <Paintbrush2 className="size-3" />
                Custom Design
              </Badge>
            )}
          </div>

          {/* 7. CTAs — stacked like Amazon (Add to Cart then Buy Now) */}
          <div ref={mainCtaRef} className="space-y-2.5">
            <Button
              className="w-full"
              size="lg"
              disabled={
                !isCurrentCombinationAvailable ||
                isAddingToCart ||
                (sizes && sizes.length > 0 && !selectedSize) ||
                (colors && colors.length > 0 && !selectedColor)
              }
              onClick={handleAddToCart}
            >
              <ShoppingCart className="size-5 mr-2" />
              {!isCurrentCombinationAvailable ? t('outOfStock') : isAddingToCart ? t('adding') || 'Adding...' : t('addToCart')}
            </Button>
            <Button
              className="w-full"
              variant="outline"
              size="lg"
              disabled={
                !isCurrentCombinationAvailable ||
                isAddingToCart ||
                (sizes && sizes.length > 0 && !selectedSize) ||
                (colors && colors.length > 0 && !selectedColor)
              }
              onClick={handleBuyNow}
            >
              {t('buyNow')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              asChild
            >
              <Link href={`/${locale}/design/${product.slug}`}>
                <Paintbrush2 className="size-4 mr-1.5" />
                Design
              </Link>
            </Button>
          </div>

          {/* Description — collapsible */}
          {product.description && (
            <details className="group" open>
              <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold hover:text-foreground transition-colors">
                {t('description')}
                <span className="text-xs group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-2 text-muted-foreground leading-relaxed text-sm">{product.description}</p>
            </details>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <Separator className="my-12" />

      <div className="max-w-4xl">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl font-bold">{t('reviews')}</h2>
          <div className="flex items-center gap-4">
            {renderStars(product.rating ?? 0)}
            <span className="text-sm text-muted-foreground">
              {(product.rating ?? 0).toFixed(1)} {t('outOf')} 5
            </span>
          </div>
        </div>

        {(product.reviewCount ?? 0) === 0 || reviews.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-2">{t('noReviews')}</p>
              <p className="text-sm text-muted-foreground">{t('beTheFirst')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              {t('showingReviews', { count: reviews.length, total: product.reviewCount ?? 0 })}
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

      {/* Customers Also Bought Section */}
      {relatedProducts.length > 0 && (
        <>
          <Separator className="my-12" />

          <div>
            <h2 className="text-2xl font-bold mb-6">{t('customersAlsoBought')}</h2>
            <div className="neu-grid">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Recently Viewed Section */}
      {recentlyViewedProducts.length > 0 && (
        <>
          <Separator className="my-12" />

          <div>
            <h2 className="text-2xl font-bold mb-6">{t('recentlyViewed')}</h2>
            <div className="neu-grid">
              {recentlyViewedProducts.slice(0, 4).map((recentProduct) => (
                <ProductCard
                  key={recentProduct.id}
                  product={{
                    id: recentProduct.id,
                    slug: recentProduct.slug,
                    title: recentProduct.title,
                    description: '',
                    price: recentProduct.price,
                    currency: recentProduct.currency,
                    image: recentProduct.image || '',
                    compareAtPrice: recentProduct.compareAtPrice,
                    rating: 0,
                    reviewCount: 0,
                    variants: recentProduct.colorImages ? { colorImages: recentProduct.colorImages } : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Mobile Sticky CTA */}
      <SmartStickyCTA
        targetRef={mainCtaRef}
        formattedPrice={formattedPrice}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        disabled={!isCurrentCombinationAvailable}
        isAdding={isAddingToCart}
        compareAtPrice={product.compareAtPrice}
        price={currentVariantPrice}
        locale={locale}
        currency={product.currency}
        quantity={quantity}
        onQuantityChange={setQuantity}
      />
    </div>
  )
}
