# Component Inventory — Frontend Store Experience

**Date**: 2026-03-08
**Base directory**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/`

---

## Table of Contents

1. [Storefront Components](#1-storefront-components)
2. [Products Components](#2-products-components)
3. [Landing Components](#3-landing-components)
4. [Cart Components](#4-cart-components)
5. [Checkout Components](#5-checkout-components)
6. [Profile Components](#6-profile-components)
7. [Orders Components](#7-orders-components)

---

## 1. Storefront Components

Directory: `components/storefront/`

Total files: 12

### 1.1 StorefrontLayout.tsx (CRITICAL)

- **Path**: `storefront/StorefrontLayout.tsx`
- **Props**: `{ children: React.ReactNode }`
- **Visual**: Full-page app shell. Sidebar (240px) left, header top, content center, detail panel (340px) right. Mobile: sidebar in Sheet drawer, detail panel as full-screen overlay, bottom nav bar.
- **shadcn/ui**: `Sheet`, `SheetContent`, `SheetTitle`
- **Hooks**: `useStorefront` (context), `useChatMessage` (context), `useSidebarCollapsed`, `usePathname`, `useParams`, `useTranslations`
- **Responsive**:
  - Mobile: sidebar hidden (Sheet on toggle), ChatArea gets `pb-16` for BottomNav clearance, detail panel is fixed full-screen overlay
  - Desktop (`lg:`): sidebar visible as flex column (w-60 or collapsed w-0), detail panel as inline aside (w-[340px])
- **Children**: Wraps everything in `StorefrontProvider` + `ChatMessageProvider`. Dynamically imports `ChatArea` (ssr: false) and `WelcomePopup`. ChatArea always mounted but collapsed to `h-0` when not on `/chat`.
- **Other integrations**: `OfflineBanner`, `SubscriptionStatusBanner`, `InstallPrompt`, `ErrorBoundary`, `BottomNav`, `Footer`

### 1.2 StorefrontHeader.tsx (CRITICAL)

- **Path**: `storefront/StorefrontHeader.tsx`
- **Props**: `{ onToggleSidebar?: () => void, isSidebarCollapsed?: boolean, onToggleDesktopSidebar?: () => void }`
- **Visual**: Sticky header (h-14) with left nav links (Chat/Shop), center search bar, right actions (search toggle, notifications bell, cart with badge, theme toggle, locale switcher, user avatar/login).
- **shadcn/ui**: `Input`, `Button`, `Badge`, `Avatar`, `AvatarFallback`, `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuTrigger`
- **Hooks**: `useAuth`, `useCart`, `useNotifications`, `useTranslations` (storefront, navigation), `useParams`, `useRouter`, `usePathname`
- **Responsive**:
  - Mobile: hamburger menu button (lg:hidden), mobile search toggle opens full-screen overlay, notification bell hidden below `sm:`, nav links hidden below `md:`
  - Desktop (`lg:`): search bar visible inline (max-w-md), sidebar expand button when collapsed
- **State**: `searchQuery`, `mobileSearchOpen`, `mounted` (hydration safety), `isShopPage`/`isChatPage` (active state highlighting)

### 1.3 StorefrontSidebar.tsx (CRITICAL)

- **Path**: `storefront/StorefrontSidebar.tsx`
- **Props**: `{ onNavigate?: () => void, onCollapse?: () => void }`
- **Visual**: Full-height card panel. Top: BrandMark logo + collapse button. Nav section: Chat, Shop, New Arrivals, Favorites, Orders, Cart (with badge). Below: "Recommended" (2 products, refreshed every 5 min) and "Popular Today" (1 product, rotated daily). Footer: PodClaw status indicator.
- **shadcn/ui**: `Badge`, `Button`
- **Hooks**: `useCart`, `useStorefront`, `useTranslations` (storefront, navigation), `useParams`, `usePathname`, `useSearchParams`
- **Responsive**: No breakpoint-specific styling; used inside both desktop aside and mobile Sheet.
- **Data fetching**: Two useEffect fetches — `/api/products?limit=6&sort=topRated` (recommended) and `/api/products?limit=4&sort=popular` (popular). Recommended refreshes on 5-minute interval.
- **Internal component**: Contains a private `ProductCard` (thumbnail + title + price + rating) used only for sidebar product cards. Different from `products/ProductCard.tsx`.

### 1.4 ChatArea.tsx (CRITICAL)

- **Path**: `storefront/ChatArea.tsx`
- **Props**: none (reads from context)
- **Visual**: Flex column filling available space. Scrollable message area at top, signup banner conditionally shown, input bar pinned at bottom. Empty state shows ChatWelcome; messages show ChatMessages. Auth/upgrade modals as overlays.
- **shadcn/ui**: none directly (delegates to sub-components)
- **Hooks**: `useStorefront`, `useChatMessage`, `useCart`, `useWishlist`, `useChatSession`, `useChatTransport`, `useImageUpload`, `useTranslations`
- **Responsive**: Padding scales: `px-3 py-4 sm:px-4 md:px-6 md:py-6`
- **Composition**: Orchestrates `ChatWelcome`, `ChatMessages`, `ChatInputBar`, `SignupBanner`, `AuthWallModal`, `UpgradeModal`
- **State**: `userData` (fetched from session/orders/wishlist APIs), scroll management refs, pending message from DetailPanel

### 1.5 ChatWelcome.tsx

- **Path**: `storefront/ChatWelcome.tsx`
- **Props**: `{ userName?: string, activeOrders?: Array<{id, status, total}> | null, recentFavorites?: Array<{id, name, price}> | null }`
- **Visual**: Centered welcome screen with BrandMark, personalized greeting, optional compact cards showing active orders (up to 2) and recent favorites (up to 2) for returning users.
- **shadcn/ui**: `Badge`
- **Hooks**: `useTranslations`
- **Responsive**: `min-h-[40vh] md:min-h-[50vh]`, cards stack vertically on mobile (`flex-col`), horizontal on `sm:`

### 1.6 ChatInputBar.tsx

- **Path**: `storefront/ChatInputBar.tsx`
- **Props**: `{ onSubmit, isLoading, isLimitReached, isLoggedIn, locale, selectedImage, fileInputRef, onImageSelect, onAttachClick, onRemoveImage, suggestions?, onSuggestionClick? }`
- **Exported type**: `PromptSuggestion { icon: string, text: string, prompt: string }`
- **Visual**: Sticky bottom input bar. Horizontal scrollable prompt chips when no messages. Card-like container with attach button, text input, voice button (conditional on browser support), send button. Image preview above input when image selected. AI disclaimer text below.
- **shadcn/ui**: `Input`, `Button`
- **Hooks**: `useTranslations`, `useSpeechToText`
- **Responsive**: Sizes scale: `h-9 w-9 sm:h-10 sm:w-10` for buttons, `px-3 pb-2 pt-1 sm:px-4 md:px-6 md:pb-3 md:pt-2` for container, `min-h-[36px] sm:min-h-[40px]` for input.

### 1.7 ChatMessages.tsx

- **Path**: `storefront/ChatMessages.tsx`
- **Props**: `{ messages, isLoading, error, sendMessage, onSelectProduct, onAddToCart, onAddToWishlist, locale, messagesEndRef }`
- **Visual**: Message history with user bubbles (right-aligned, primary background) and assistant bubbles (left-aligned, muted background with avatar). Typing indicator (3 bouncing dots). Error display. Tool artifacts rendered inline via artifact registry.
- **shadcn/ui**: `Avatar`, `AvatarFallback`, `AvatarImage`
- **Hooks**: `useTranslations`
- **Responsive**: `max-w-4xl mx-auto`, user messages capped at `max-w-[80%]`
- **Internal components**: `ToolArtifact` (renders tool UI parts from AI SDK), `CheckoutRedirect` (safe redirect via useEffect)

### 1.8 StorefrontContext.tsx

- **Path**: `storefront/StorefrontContext.tsx`
- **Props**: Provider: `{ children: ReactNode }`
- **Visual**: No visual output (context provider)
- **Exports**: `StorefrontProvider`, `useStorefront`
- **State managed**: `selectedProduct: string | null`, `artifacts: Artifact[]`, `activeArtifactId: string | null`
- **Artifact type**: `{ id, type: 'product' | 'design' | 'comparison' | 'cart' | 'order' | 'other', title, data }`

### 1.9 ChatMessageContext.tsx

- **Path**: `storefront/ChatMessageContext.tsx`
- **Props**: Provider: `{ children: ReactNode }`
- **Visual**: No visual output (context provider)
- **Exports**: `ChatMessageProvider`, `useChatMessage`
- **State managed**: `pendingChatMessage: string` (bridge between DetailPanel "Ask about" and ChatArea)

### 1.10 DesignContext.tsx

- **Path**: `storefront/DesignContext.tsx`
- **Props**: Provider: `{ children: ReactNode }`
- **Visual**: No visual output (context provider)
- **Exports**: `DesignProvider`, `useDesign`
- **State managed**: `activeProductId`, `latestDesignUrl`, `latestGenerationId`

### 1.11 DetailPanel.tsx

- **Path**: `storefront/DetailPanel.tsx`
- **Props**: `{ productId?: string, onClose: () => void, onAskAbout?: (question: string) => void }`
- **Visual**: Right sidebar panel. Tab interface for multiple artifacts (products, designs, other). Product view: image gallery, title, rating, price, description, specifications, variant selectors, quantity selector. Footer: Add to Cart, Design link, Wishlist, "Ask about product" button.
- **shadcn/ui**: `Button`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Badge`
- **Hooks**: `useStorefront`, `useProductDetail`, `useCart`, `useWishlist`, `useTranslations`, `useParams`
- **Responsive**: Used as 340px aside on desktop, full-screen overlay on mobile.
- **Internal components**: `PanelHeader`, `DetailPanelSkeleton`, `ProductView` (memoized), `ArtifactContent` (memoized)

### 1.12 BottomNav.tsx

- **Path**: `storefront/BottomNav.tsx`
- **Props**: none
- **Visual**: Fixed bottom navigation bar (mobile only). 4 items: Chat, Shop, Cart (with badge counter), Profile. Active state highlighted in primary color.
- **shadcn/ui**: none (raw Link + cn)
- **Hooks**: `useCart`, `usePathname`, `useParams`
- **Responsive**: `md:hidden` — only visible on mobile. Min touch targets: `min-h-[56px] min-w-[64px]`.

---

## 2. Products Components

Directory: `components/products/`

Total files: 18

### 2.1 ProductCard.tsx (CRITICAL)

- **Path**: `products/ProductCard.tsx`
- **Props**: `{ product: ProductCardType, priority?: boolean }`
- **Visual**: Card with image (aspect-square), color variant swatches overlay (bottom-left), wishlist heart (top-right), product labels/badges (top-left), category+rating row, title, description (2 lines), price with compare-at/discount badge, Add to Cart button, Quick View button.
- **shadcn/ui**: `Button`, `Badge`
- **Hooks**: `useWishlist`, `useCart`, `useStorefront`, `useTranslations` (product, shop), `useLocale`
- **Responsive**: Image sizes: `(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw`. Color swatches: `w-[36px] h-[36px]`. Action buttons: `h-10 w-10`.
- **CSS classes**: `neu-card`, `neu-image`, `neu-fav`, `neu-btn-accent`, `neu-btn-soft` (neumorphic custom classes)
- **Behavior**: Color swatches change displayed image on click/hover. Add to Cart opens detail panel if product has multiple variants. Quick View opens detail panel via artifact system.

### 2.2 ProductGrid.tsx (CRITICAL)

- **Path**: `products/ProductGrid.tsx`
- **Props**: `{ products: ProductCardType[], isLoading?: boolean, emptyMessage?: string, skeletonCount?: number }`
- **Visual**: CSS grid of ProductCards with auto-fill columns (min 200px). Loading state: skeleton cards. Empty state: centered text message.
- **shadcn/ui**: none directly
- **Hooks**: none
- **Responsive**: Uses `neu-grid` CSS class (auto-fill with `--grid-card-min` / `--grid-gap` custom properties)

### 2.3 ProductDetailClient.tsx (CRITICAL)

- **Path**: `products/ProductDetailClient.tsx`
- **Props**: `{ product: ProductDetail, relatedProducts: any[], reviews: any[] }`
- **Visual**: Full product detail page. Breadcrumb navigation. 2-column layout (lg): left = Embla carousel with swipeable images, dot indicators (mobile), thumbnail grid (desktop), wishlist+share buttons. Right = title, rating stars, social proof, color selector (visual image swatches), size selector with SizeGuide link, price with StrikethroughPrice, stock/shipping badges, collapsible specifications, GPSR safety info, quantity Select, Add to Cart + Buy Now + Design Studio CTAs. Below: Reviews section (cards with rating, author, verified badge), ReviewForm. "Customers Also Bought" grid. "Recently Viewed" grid. SmartStickyCTA mobile bar.
- **shadcn/ui**: `Button`, `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`, `Separator`, `Badge`, `Dialog`, `DialogContent`, `DialogTrigger`, `DialogTitle`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Breadcrumb` + sub-components
- **Hooks**: `useCart`, `useWishlist`, `useRecentlyViewed`, `useRouter`, `useSearchParams`, `useTranslations` (product, navigation, shop.category), `useLocale`
- **Responsive**:
  - Mobile: single column, Embla carousel with swipe, dot indicators + wishlist/share row, title text-2xl
  - Desktop (`md:`/`lg:`): 2-column grid (gap-8 lg:gap-12), thumbnail grid (grid-cols-4), title text-3xl lg:text-4xl, wishlist/share beside title
- **Embla carousel**: `useEmblaCarousel({ loop: true })` for swipeable image gallery
- **Variant logic**: Cross-filtering (unavailable combinations), auto-reset when selection becomes unavailable, URL param `?color=` pre-selection, variant-reactive pricing

### 2.4 ProductCardSkeleton.tsx

- **Path**: `products/ProductCardSkeleton.tsx`
- **Props**: none
- **Visual**: Skeleton placeholder matching ProductCard shape — animated pulse squares for image, category, title, description, price, action buttons.
- **shadcn/ui**: none
- **CSS classes**: `neu-card`, `neu-image`

### 2.5 ProductImageGallery.tsx

- **Path**: `products/ProductImageGallery.tsx`
- **Props**: `{ images: string[], alt: string, selectedIndex: number, onSelectIndex: (index: number) => void, aspectRatio?: 'square' | '4/3', sizes?: string }`
- **Visual**: Main image with hover zoom effect. Thumbnail strip below (w-14 h-14) for multi-image navigation. Fallback icon when no images.
- **shadcn/ui**: none
- **Hooks**: none
- **Responsive**: Default aspect-ratio `4/3`, thumbnail strip scrolls horizontally.

### 2.6 VariantSelector.tsx

- **Path**: `products/VariantSelector.tsx`
- **Props**: `{ allSizes?, allColors?, availableSizes?: Set<string>, availableColors?: Set<string>, selectedSize, selectedColor, onSizeChange, onColorChange, sizeLabel?, colorLabel? }`
- **Visual**: Horizontal button groups for sizes and colors. Selected state: filled bg. Unavailable: opacity-40 + line-through + disabled.
- **shadcn/ui**: none (uses cn() for conditional classes)
- **Hooks**: none

### 2.7 QuantitySelector.tsx

- **Path**: `products/QuantitySelector.tsx`
- **Props**: `{ quantity: number, onQuantityChange: (qty: number) => void, min?: number, max?: number, label?: string }`
- **Visual**: Minus/Plus buttons with centered quantity number, bordered container.
- **shadcn/ui**: `Button`
- **Hooks**: none

### 2.8 ProductSpecifications.tsx

- **Path**: `products/ProductSpecifications.tsx`
- **Props**: `{ materials?, printTechnique?, manufacturingCountry?, careInstructions?, safetyInformation?, finish?, labels? }`
- **Visual**: Icon-label-value rows for each specification (Shirt, Globe, Printer, Droplets, Sparkles icons). Safety information in collapsible `<details>` with SafeHTML rendering.
- **shadcn/ui**: none
- **Hooks**: none

### 2.9 ProductBadge.tsx

- **Path**: `products/ProductBadge.tsx`
- **Props**: `{ labels: string[], className?: string }`
- **Visual**: Absolute-positioned badge on product image (top-left). Supports: trending, bestseller, new, sale, limited — each with distinct color scheme.
- **shadcn/ui**: `Badge`
- **Hooks**: none

### 2.10 SocialProofIndicator.tsx

- **Path**: `products/SocialProofIndicator.tsx`
- **Props**: `{ productId: string }`
- **Visual**: Horizontal flex row of badges/text: "Selling Fast" (destructive badge with flame icon), "X bought this week", "X viewed today" (eye icon).
- **shadcn/ui**: `Badge`
- **Hooks**: `useTranslations`
- **Data fetching**: `GET /api/products/{productId}/social-proof`

### 2.11 SmartStickyCTA.tsx

- **Path**: `products/SmartStickyCTA.tsx`
- **Props**: `{ targetRef, formattedPrice, onAddToCart, onBuyNow?, disabled, isAdding, compareAtPrice?, price?, locale?, currency?, colors?, selectedColor?, onColorChange?, quantity?, onQuantityChange? }`
- **Visual**: Fixed bottom bar (above BottomNav at `bottom-[60px]`) appearing when main CTA scrolls out of viewport. Shows price, mini color dots, quantity +/-, Buy Now + Add to Cart buttons.
- **shadcn/ui**: `Button`
- **Hooks**: `useTranslations`
- **Responsive**: `md:hidden` — mobile only. Uses IntersectionObserver on targetRef.

### 2.12 StrikethroughPrice.tsx

- **Path**: `products/StrikethroughPrice.tsx`
- **Props**: `{ price: number, compareAtPrice: number, locale: string, currency?: string, compact?: boolean }`
- **Visual**: Original price (line-through) + sale price (bold, destructive color) + discount percentage badge. Compact mode reduces sizes.
- **shadcn/ui**: `Badge`
- **Hooks**: none

### 2.13 SizeGuide.tsx

- **Path**: `products/SizeGuide.tsx`
- **Props**: `{ productType: string }`
- **Visual**: Dialog modal with measurement table. Supports t-shirts, hoodies, zip-hoodies, crewnecks, tanks, sweatpants. Trigger is a link-styled button with ruler icon.
- **shadcn/ui**: `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`, `DialogTrigger`, `Button`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
- **Hooks**: `useTranslations`

### 2.14 QuickViewModal.tsx

- **Path**: `products/QuickViewModal.tsx`
- **Props**: `{ product: ProductCard, open: boolean, onOpenChange: (open: boolean) => void }`
- **Visual**: Dialog modal with 2-column layout (md). Left: product image with category pill. Right: scrollable details — title, rating, price, description, variant selector, quantity selector. Footer: Add to Cart + Wishlist + "View Full Details" link.
- **shadcn/ui**: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `Button`, `Badge`
- **Hooks**: `useCart`, `useWishlist`, `useTranslations`, `useLocale`
- **Responsive**: `max-w-2xl max-h-[90dvh]`. Mobile: stacked layout. Desktop (`md:`): 2-column grid.

### 2.15 ReviewForm.tsx

- **Path**: `products/ReviewForm.tsx`
- **Props**: `{ productId: string, onReviewSubmitted?: () => void }`
- **Visual**: Card with star rating input (clickable + hover), textarea for review text (min 10 chars), photo upload (up to 3 photos, max 5MB each) with drag-and-drop preview grid, submit button.
- **shadcn/ui**: `Button`, `Textarea`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`
- **Hooks**: `useTranslations`

### 2.16 DynamicPriceStock.tsx

- **Path**: `products/DynamicPriceStock.tsx`
- **Props**: `{ productId: string, price: number, currency: string, locale: string }`
- **Visual**: Server component (async). Displays formatted price + stock badge (In Stock/Out of Stock). Designed for PPR streaming.
- **shadcn/ui**: `Badge`
- **Hooks**: none (server component)

### 2.17 DynamicPriceStockSkeleton.tsx

- **Path**: `products/DynamicPriceStockSkeleton.tsx`
- **Props**: none
- **Visual**: Animated pulse skeleton for price (h-10 w-32) and stock badge (h-6 w-20).
- **shadcn/ui**: none

### 2.18 DesignHistoryPanel.tsx

- **Path**: `products/DesignHistoryPanel.tsx`
- **Props**: `{ onSelect?: (generationId: string, imageUrl: string) => void, className?: string }`
- **Visual**: Horizontal scrollable strip of 64x64 thumbnail buttons showing past AI design generations. Empty state with sparkles icon. Loading state with skeleton squares.
- **shadcn/ui**: none
- **Hooks**: `useTranslations`
- **Data fetching**: `GET /api/designs/history`

---

## 3. Landing Components

Directory: `components/landing/`

Total files: 5

### 3.1 LandingPageClient.tsx (CRITICAL)

- **Path**: `landing/LandingPageClient.tsx`
- **Props**: `{ locale: string, initialProducts: Product[], reviews: Review[], totalOrders: number, averageRating: number }`
- **Visual**: Full landing page with sections:
  1. **Hero**: Full-viewport height. MetaballsBackground (WebGL shader), BrandMark with float animation, TextReveal animated title, subtitle, 2 MagneticButton CTAs (Start Designing + Browse Products), scroll-down chevron.
  2. **How It Works**: 3-step card grid (Chat, Design, Deliver) with staggered animation and step numbers.
  3. **Product Showcase**: Embla Carousel (autoplay 4.5s) of product cards with image, title, price, rating, discount badge. "View All" link.
  4. **Testimonials**: Delegated to `<Testimonials>`.
  5. **Newsletter Signup**: Delegated to `<NewsletterSignup>`.
  6. **Final CTA**: Parallax section with title, subtitle, 2 MagneticButton CTAs.
- **shadcn/ui**: `Button`, `Card`, `CardContent`, `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselNext`, `CarouselPrevious`, `Skeleton`, `Badge`
- **Hooks**: `useTranslations`, `useReducedMotion`
- **Motion**: `motion/react` — `useScroll`, `useTransform`, `useSpring`, `useReducedMotion` for parallax and magnetic buttons. `FADE_UP`, `STAGGER_CONTAINER`, `STAGGER_ITEM`, `SCALE_IN` from `useMotionConfig`.
- **Responsive**: Hero buttons `flex-col sm:flex-row`. Carousel items `basis-[80%] md:basis-1/2 lg:basis-1/3`. Step cards `grid-cols-1 md:grid-cols-3`. Navigation arrows `hidden md:flex`.
- **Internal component**: `MagneticButton` — spring-animated wrapper that follows cursor.

### 3.2 Testimonials.tsx

- **Path**: `landing/Testimonials.tsx`
- **Props**: `{ reviews: Review[], totalOrders: number, averageRating: number }`
- **Visual**: Trust signals bar (animated star rating + animated order count). Grid of review cards with star rating, verified purchase badge, title, body, author name.
- **shadcn/ui**: `Card`, `CardContent`
- **Hooks**: `useTranslations`
- **Motion**: `AnimatedNumber` (spring-animated counter), stagger container for cards, alternating slide-in directions (left/right).
- **Responsive**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`. Trust signals `flex-col md:flex-row`.
- **Internal component**: `AnimatedNumber` — uses `useSpring` + `useTransform` + `useInView` for counting animation.

### 3.3 NewsletterSignup.tsx

- **Path**: `landing/NewsletterSignup.tsx`
- **Props**: `{ locale: 'en' | 'es' | 'de' }`
- **Visual**: Centered form with decorative pulsing gradient background. Title, subtitle, email input + subscribe button. Inline translations (not using next-intl message files).
- **shadcn/ui**: `Button`, `Input`
- **Hooks**: none (uses inline translation object)
- **Motion**: Decorative pulsing blob, `FADE_UP` animation on form.
- **Responsive**: Form `flex-col sm:flex-row`.
- **Data fetching**: `POST /api/newsletter/subscribe`

### 3.4 MetaballsBackground.tsx

- **Path**: `landing/MetaballsBackground.tsx`
- **Props**: none
- **Visual**: Full-viewport WebGL shader animation using `@paper-design/shaders-react` Metaballs component. Reads CSS custom properties (`--background`, `--primary`, `--chart-2`, `--chart-5`) to determine colors. Theme-aware (updates on dark/light toggle).
- **shadcn/ui**: none
- **Hooks**: `useTheme` (next-themes)
- **Responsive**: Respects `prefers-reduced-motion` (speed: 0). Falls back to nothing if WebGL not supported.

### 3.5 TextReveal.tsx

- **Path**: `landing/TextReveal.tsx`
- **Props**: `{ text: string, className?: string, as?: 'h1' | 'h2' | 'p', delay?: number }`
- **Visual**: Word-by-word reveal animation. Splits text by sentences (". ") into block spans, then animates each word with staggered delay (0.08s per word).
- **shadcn/ui**: none
- **Motion**: `motion.span` with `WORD_REVEAL` variants. Falls back to static text when `prefers-reduced-motion`.

---

## 4. Cart Components

Directory: `components/cart/`

Total files: 2

### 4.1 CartView.tsx (CRITICAL)

- **Path**: `cart/CartView.tsx`
- **Props**: `{ locale: string }` (default export)
- **Visual**: 2-column layout (lg: 2/3 + 1/3). Left: cart items list — each with product image (Link), title, variant badges (editable via inline Select dropdowns), per-unit price, quantity controls (+/-/remove with undo toast), item total. CartCrossSell below. Right: sticky order summary card — coupon code input, shipping estimate (zip code based), free shipping progress bar, subtotal/discount/shipping/total breakdown, crypto badge (conditional), proceed to checkout / guest checkout / sign in buttons.
- **shadcn/ui**: `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Separator`, `Badge`, `Input`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Progress`
- **Hooks**: `useAuth`, `useCart`, `useTranslations`
- **Responsive**: Single column on mobile, `grid-cols-1 lg:grid-cols-3` on desktop. Product images `size-24 md:size-32`. Summary card `sticky top-4`.

### 4.2 CartCrossSell.tsx

- **Path**: `cart/CartCrossSell.tsx`
- **Props**: `{ productId: string }`
- **Visual**: "You Might Also Like" section. Grid of up to 4 ProductCards.
- **shadcn/ui**: none directly (uses ProductCard)
- **Hooks**: `useTranslations`
- **Responsive**: `grid-cols-2 md:grid-cols-4`
- **Data fetching**: `GET /api/products/{productId}/cross-sell`

---

## 5. Checkout Components

Directory: `components/checkout/`

Total files: 3

### 5.1 CheckoutView.tsx (CRITICAL)

- **Path**: `checkout/CheckoutView.tsx`
- **Props**: `{ locale: string }` (default export)
- **Visual**: 2-column layout (lg: 2/3 + 1/3). Left column:
  - Back to cart link
  - CheckoutBreadcrumb (shipping step)
  - Shipping address section: for authenticated users, shows saved addresses as selectable cards with default badge, option to add new via AddressForm. For guests: email input.
  - Payment section: info card explaining Stripe redirect. Trust badges (shipping, returns, secure).
  - Payment method logos (Visa, Mastercard, Amex, PayPal as SVGs).
  Right column: sticky order summary — item thumbnails with variant details, price breakdown (subtotal, discount, shipping, tax), gift message toggle (Switch + Textarea), proceed to payment button.
  Exit intent dialog (AlertDialog) on page leave attempt.
- **shadcn/ui**: `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Separator`, `Badge`, `Input`, `Label`, `Switch`, `Textarea`, `AlertDialog` + sub-components
- **Hooks**: `useAuth`, `useCart`, `useTranslations` (Checkout, Cart), `useExitIntent`
- **Responsive**: `grid-cols-1 lg:grid-cols-3`. Item images `size-16 md:size-20`. Title `text-2xl md:text-3xl lg:text-4xl`.

### 5.2 CheckoutBreadcrumb.tsx

- **Path**: `checkout/CheckoutBreadcrumb.tsx`
- **Props**: `{ currentStep: 'cart' | 'shipping' | 'payment' | 'confirmation' }` (default export)
- **Visual**: Step progress indicator. 4 numbered circles (size-10) with connecting lines. Completed steps: primary filled with checkmark. Active step: primary border. Future steps: muted.
- **shadcn/ui**: none (uses cn())
- **Hooks**: `useTranslations`
- **Responsive**: Connector lines `hidden md:block`. Step labels `text-xs md:text-sm`.

### 5.3 AddressForm.tsx

- **Path**: `checkout/AddressForm.tsx`
- **Props**: `{ onSubmit: (address: AddressFormData) => Promise<void>, onCancel: () => void }` (default export)
- **Exported type**: `AddressFormData { label, full_name, street_address, street_address_2?, city, state, postal_code, country_code, phone?, is_default }`
- **Visual**: Form with labeled inputs for address fields. Country code auto-detected from locale.
- **shadcn/ui**: `Button`, `Input`, `Label`
- **Hooks**: `useTranslations`, `useParams`

---

## 6. Profile Components

Directory: `components/profile/`

Total files: 11

### 6.1 ProfilePageClient.tsx

- **Path**: `profile/ProfilePageClient.tsx`
- **Props**: `{ locale: string }`
- **Visual**: Tabbed profile page (3 tabs: Account, Orders, Settings). Account tab: ProfileForm + ChangePasswordForm. Orders tab: RecentOrdersPreview + PlanCard + PaymentMethodsList. Settings tab: ShippingAddressList + DataExportSection + DeleteAccountSection.
- **shadcn/ui**: `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`, `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- **Hooks**: `useTranslations`, `useSearchParams`
- **Responsive**: `max-w-2xl` centered container, `py-8 md:py-12`.

### 6.2 ProfileForm.tsx

- **Path**: `profile/ProfileForm.tsx`
- **Props**: `{ locale: string }`
- **Visual**: Avatar with edit overlay, name/email/phone inputs, locale/currency select dropdowns, notification preference switches (email, push, SMS), save button.
- **shadcn/ui**: `Avatar`, `AvatarImage`, `AvatarFallback`, `Button`, `Input`, `Label`, `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, `Switch`, `Separator`
- **Hooks**: `useTranslations`, `useRouter`

### 6.3 ChangePasswordForm.tsx

- **Path**: `profile/ChangePasswordForm.tsx`
- **Props**: none
- **Visual**: Card with current/new/confirm password inputs, each with show/hide toggle. Submit button.
- **shadcn/ui**: `Button`, `Input`, `Label`, `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- **Hooks**: `useTranslations`

### 6.4 PlanCard.tsx

- **Path**: `profile/PlanCard.tsx`
- **Props**: none
- **Visual**: Card showing current subscription plan (free/premium), usage meters, credit balance, upgrade button.
- **shadcn/ui**: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Button`, `Badge`, `Separator`
- **Hooks**: `useTranslations`, `useParams`
- **Data fetching**: `/api/user/usage`

### 6.5 RecentOrdersPreview.tsx

- **Path**: `profile/RecentOrdersPreview.tsx`
- **Props**: none
- **Visual**: Preview list of recent orders with status badges.
- **shadcn/ui**: Card components, Badge
- **Hooks**: `useTranslations`

### 6.6 PaymentMethodsList.tsx

- **Path**: `profile/PaymentMethodsList.tsx`
- **Props**: none
- **Visual**: List of saved payment methods (card type, last 4 digits, expiry). Delete button with AlertDialog confirmation.
- **shadcn/ui**: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Button`, `AlertDialog` + sub-components
- **Hooks**: `useTranslations`
- **Data fetching**: `/api/billing/payment-methods`

### 6.7 ShippingAddressList.tsx

- **Path**: `profile/ShippingAddressList.tsx`
- **Props**: none
- **Visual**: List of saved shipping addresses with default badge. Delete with AlertDialog. Add new via AddressForm.
- **shadcn/ui**: `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Button`, `Badge`, `AlertDialog` + sub-components
- **Hooks**: `useTranslations`

### 6.8 AddressForm.tsx

- **Path**: `profile/AddressForm.tsx`
- **Props**: (separate from checkout/AddressForm — reusable form for profile address management)
- **Visual**: Form with labeled inputs for address fields.
- **shadcn/ui**: `Button`, `Input`, `Label`

### 6.9 DeleteAccountSection.tsx

- **Path**: `profile/DeleteAccountSection.tsx`
- **Props**: none
- **Visual**: Delete account button + confirmation Dialog. Shows DeletionCountdownBanner if account has pending deletion. 30-day grace period.
- **shadcn/ui**: `Button`, `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
- **Hooks**: `useTranslations`

### 6.10 DeletionCountdownBanner.tsx

- **Path**: `profile/DeletionCountdownBanner.tsx`
- **Props**: Accepts deletion date, cancel callback
- **Visual**: Warning banner showing countdown to account deletion with cancel button.
- **shadcn/ui**: `Button`

### 6.11 DataExportSection.tsx

- **Path**: `profile/DataExportSection.tsx`
- **Props**: none
- **Visual**: GDPR data export button. Downloads JSON blob of user data.
- **shadcn/ui**: `Button`
- **Hooks**: `useTranslations`
- **Data fetching**: `GET /api/profile/export`

---

## 7. Orders Components

Directory: `components/orders/`

Total files: 2

### 7.1 OrdersView.tsx

- **Path**: `orders/OrdersView.tsx`
- **Props**: `{ locale: string }` (default export)
- **Visual**: List of user orders. Each order shows: order ID, status badge (color-coded), total price, date, tracking number (if available). Empty state for unauthenticated users (redirect to login) and for users with no orders.
- **shadcn/ui**: `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Badge`, `Separator`
- **Hooks**: `useAuth`, `useTranslations`
- **Data fetching**: `GET /api/orders`

### 7.2 OrderDetailView.tsx

- **Path**: `orders/OrderDetailView.tsx`
- **Props**: `{ locale: string }` (default export)
- **Visual**: Detailed single order view. Order timeline (via OrderTimelineArtifact), item list with product title/variant/quantity/price, shipping address, payment method, tracking info with link, return request dialog (Dialog with Textarea + confirmation), invoice download.
- **shadcn/ui**: `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Badge`, `Separator`, `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`, `DialogTrigger`, `Textarea`, `Label`
- **Hooks**: `useAuth`, `useTranslations`
- **Data fetching**: `GET /api/orders/{id}`

---

## Summary Statistics

| Directory | Component Count | Context Providers | Critical Components |
|---|---|---|---|
| `storefront/` | 12 | 3 (StorefrontContext, ChatMessageContext, DesignContext) | StorefrontLayout, StorefrontHeader, StorefrontSidebar, ChatArea |
| `products/` | 18 | 0 | ProductCard, ProductGrid, ProductDetailClient |
| `landing/` | 5 | 0 | LandingPageClient |
| `cart/` | 2 | 0 | CartView |
| `checkout/` | 3 | 0 | CheckoutView |
| `profile/` | 11 | 0 | ProfilePageClient |
| `orders/` | 2 | 0 | OrdersView, OrderDetailView |
| **Total** | **53** | **3** | **10** |

### Hook Usage Summary

| Hook | Used by |
|---|---|
| `useAuth` | StorefrontHeader, CartView, CheckoutView, OrdersView, OrderDetailView |
| `useCart` | StorefrontHeader, StorefrontSidebar, ChatArea, ProductCard, ProductDetailClient, DetailPanel, CartView, CheckoutView, QuickViewModal, BottomNav |
| `useWishlist` | ChatArea, ProductCard, ProductDetailClient, DetailPanel, QuickViewModal |
| `useStorefront` | StorefrontSidebar, ChatArea, ProductCard, DetailPanel |
| `useChatMessage` | ChatArea, StorefrontLayout (Shell) |
| `useTranslations` | Nearly all components |
| `useNotifications` | StorefrontHeader |
| `useRecentlyViewed` | ProductDetailClient |
| `useSpeechToText` | ChatInputBar |
| `useExitIntent` | CheckoutView |
| `useSidebarCollapsed` | StorefrontLayout |

### shadcn/ui Component Usage Frequency

| Component | Usage Count (approx) |
|---|---|
| `Button` | 30+ components |
| `Badge` | 20+ components |
| `Card` / `CardContent` / `CardHeader` / `CardTitle` | 15+ components |
| `Separator` | 10+ components |
| `Input` | 8+ components |
| `Dialog` / `DialogContent` / `DialogTrigger` | 7+ components |
| `Select` / `SelectContent` / `SelectItem` / `SelectTrigger` | 6+ components |
| `Avatar` / `AvatarFallback` / `AvatarImage` | 4 components |
| `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` | 2 components (DetailPanel, ProfilePageClient) |
| `Sheet` / `SheetContent` | 1 component (StorefrontLayout) |
| `Switch` | 2 components (ProfileForm, CheckoutView) |
| `Label` | 5+ components |
| `Textarea` | 3 components |
| `AlertDialog` | 3 components |
| `Progress` | 1 component (CartView) |
| `DropdownMenu` | 1 component (StorefrontHeader) |
| `Carousel` | 1 component (LandingPageClient) |
| `Breadcrumb` | 1 component (ProductDetailClient) |
| `Table` | 1 component (SizeGuide) |
| `Skeleton` | 1 component (LandingPageClient) |

### Custom CSS Classes (neumorphic theme)

Used in `ProductCard.tsx`, `ProductCardSkeleton.tsx`, `ProductGrid.tsx`:
- `neu-card` — card container with neumorphic shadow
- `neu-image` — image container with inset shadow
- `neu-fav` — raised circle for wishlist button
- `neu-btn-accent` — accent add-to-cart button
- `neu-btn-soft` — soft outline button
- `neu-grid` — auto-fill grid with custom properties `--grid-card-min` / `--grid-gap`
