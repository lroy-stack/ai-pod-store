# SKAPARA Conversion Funnel Audit -- 2026-03-07

## Executive Summary

The SKAPARA storefront has a solid end-to-end conversion funnel with guest checkout, Stripe integration, abandoned cart recovery emails, and post-purchase drip sequences already in place. However, several critical gaps exist: the landing page has **no direct link to the Shop** (both CTAs point to `/chat`), there is **no image zoom** on product detail pages, and the address form lacks **address autocomplete**. The funnel is strongest in the cart and checkout stages but weakest in the landing-to-discovery transition and post-purchase review solicitation.

---

## Findings by Stage

### 1. Landing Page

**Files analyzed:**
- `/src/app/[locale]/(landing)/page.tsx` (lines 1-201)
- `/src/components/landing/LandingPageClient.tsx` (lines 1-342)
- `/src/components/landing/Testimonials.tsx` (lines 1-117)
- `/src/components/landing/NewsletterSignup.tsx` (lines 1-127)

| #     | Finding | Severity | Status | Recommendation |
|-------|---------|----------|--------|----------------|
| CF-01 | **Both hero CTAs link to `/chat`, not `/shop`**. The primary CTA says "Start creating" and links to `/{locale}/chat`. The final CTA also links to `/chat`. There is no "Browse Products" or "Shop Now" CTA anywhere on the landing page. Users who want to browse products directly have no clear path. | CRITICAL | GAP | Add a secondary CTA button below the hero CTA: `<Button variant="outline" asChild><Link href="/{locale}/shop">Browse Products</Link></Button>`. Also add a "View All Products" link below the product carousel. |
| CF-02 | **Hero section: clear value proposition present** -- `heroTitle` + `heroSubtitle` rendered in h1/p above the fold inside a glass card. BrandMark logo shown. `heroSubCTA`: "Free to use -- no account required". | -- | OK | -- |
| CF-03 | **Social proof present** -- Testimonials section shows real reviews from `product_reviews` table (locale-filtered, verified purchase badges), total order count (`{totalOrders}+`), and aggregate star rating. Server-fetched from Supabase. | -- | OK | -- |
| CF-04 | **Product showcase** -- Carousel of up to 12 products with autoplay (4.5s), images via Next.js `<Image>` with priority on first 3, price formatting, star ratings, and sale badges. Linked to individual product pages. | -- | OK | -- |
| CF-05 | **No "View All Products" link after carousel** -- After the product carousel, there is no CTA to browse the full shop. Users must find it via navigation. | HIGH | GAP | Add a "View All Products" `<Button asChild variant="outline">` after the Carousel, linking to `/{locale}/shop`. |
| CF-06 | **Newsletter signup present** -- Functional with CSRF protection, i18n (en/es/de), and success feedback via toast. Submits to `/api/newsletter/subscribe`. | -- | OK | -- |
| CF-07 | **Mobile hero works at 375px** -- `min-h-dvh`, `px-6`, responsive text sizes (`text-4xl md:text-5xl lg:text-6xl`), CTA has adequate padding (`px-8 md:px-10 py-3 md:py-3.5`). | -- | OK | -- |
| CF-08 | **Image optimization** -- `next/image` used throughout with `sizes` prop and `priority` for above-fold images. WebGL background is dynamically imported (`ssr: false`) with a CSS gradient fallback. | -- | OK | -- |
| CF-09 | **SEO: JSON-LD structured data** -- Organization + Website schemas with SearchAction. OpenGraph and Twitter meta tags. Alternate hreflang links for en/es/de. | -- | OK | -- |
| CF-10 | **Scroll-reveal animations** -- "How it Works" and "Final CTA" sections use IntersectionObserver-based reveal. Smooth but not performance-critical. | -- | OK | -- |
| CF-11 | **Testimonials section hardcoded "Happy Customers" and "out of 5"** in English (Testimonials.tsx:55-56, line 45). Not using i18n. | MEDIUM | GAP | Move these strings to `next-intl` translation keys. |

---

### 2. Product Discovery

**Files analyzed:**
- `/src/app/[locale]/(app)/shop/page.tsx` (lines 1-471)
- `/src/components/shop/ShopPageClient.tsx` (lines 1-382)
- `/src/components/shop/ShopCategoryLanding.tsx` (lines 1-115)
- `/src/components/products/ProductCard.tsx` (lines 1-269)
- `/src/components/products/ProductGrid.tsx`

| #     | Finding | Severity | Status | Recommendation |
|-------|---------|----------|--------|----------------|
| CF-12 | **Search functionality present** -- Text search with 300ms debounce, clear button, placeholder text. Uses `title.ilike` + `description.ilike` filtering server-side. No autocomplete/suggestions. | -- | PARTIAL | Add search suggestions or autocomplete dropdown showing matching product titles as user types. |
| CF-13 | **Category navigation: hierarchical** -- Shop landing shows category grid with preview images and product counts. Clicking a category leads to filtered view with subcategory chips. | -- | OK | -- |
| CF-14 | **Sorting: 5 options** -- Featured, Price Low-to-High, Price High-to-Low, Newest, Top Rated. Implemented via Select dropdown. | -- | OK | -- |
| CF-15 | **Pagination present** -- Page-based (20 per page) with numbered buttons and prev/next. Scrolls to top on page change. All pagination buttons rendered (no ellipsis for large page counts). | -- | PARTIAL | Add ellipsis for large page counts (e.g., when >7 pages, show `1 2 3 ... 18 19 20`). |
| CF-16 | **Empty states handled** -- `noResults`, `noCategoryResults`, and `noProducts` messages shown via `ProductGrid`'s `emptyMessage` prop. | -- | OK | -- |
| CF-17 | **Breadcrumbs present** -- `Home > Shop` on shop page. Uses shadcn `Breadcrumb` component. | -- | OK | -- |
| CF-18 | **ProductCard: rich feature set** -- Image with color swatches (hover to change), wishlist heart, quick view button, add-to-cart button, star rating, category label, price with sale badge, "from" price for variant pricing. Out-of-stock overlay. | -- | OK | -- |
| CF-19 | **Recently viewed products on shop landing** -- Shows up to 4 recently viewed products from localStorage. Good for return visitors. | -- | OK | -- |
| CF-20 | **No price range filter** -- Only category chips and text search. No price slider or range filter. | MEDIUM | GAP | Add a price range filter (slider or min/max inputs) to the shop page filters. |
| CF-21 | **ISR enabled** -- Shop page revalidates every 5 minutes (`revalidate = 300`). Good for performance. | -- | OK | -- |
| CF-22 | **Category counts cached** -- Uses Redis cache for category tree and counts (`getCachedCategoryTree`, `getCachedCategoryCounts`). | -- | OK | -- |

---

### 3. Product Detail Page

**Files analyzed:**
- `/src/app/[locale]/(app)/shop/[id]/page.tsx` (lines 1-190)
- `/src/components/products/ProductDetailClient.tsx` (lines 1-793)
- `/src/components/products/SmartStickyCTA.tsx` (lines 1-150)
- `/src/components/products/SizeGuide.tsx`
- `/src/components/products/ReviewForm.tsx`
- `/src/components/products/StrikethroughPrice.tsx`
- `/src/components/products/SocialProofIndicator.tsx`

| #     | Finding | Severity | Status | Recommendation |
|-------|---------|----------|--------|----------------|
| CF-23 | **Image gallery present** -- Main image + thumbnail grid (4 columns). Images filter by selected color/size variant. Uses Next.js `<Image>` with priority. | -- | OK | -- |
| CF-24 | **No image zoom** -- Clicking the main image does nothing. No pinch-to-zoom, lightbox, or magnifier. On a product-focused e-commerce site, this is a significant gap. | HIGH | GAP | Add a zoom-on-hover (desktop) or lightbox/pinch-zoom (mobile) to the main product image. Libraries: `react-medium-image-zoom` or similar. |
| CF-25 | **Size/color selection: well implemented** -- Uses shadcn `Select` components. Cross-filters: unavailable combinations are disabled with strikethrough + "Out of Stock" label. Auto-resets invalid selections. Color changes filter images. | -- | OK | -- |
| CF-26 | **Size guide present** -- Shown for apparel categories (t-shirts, hoodies, etc.) via `<SizeGuide>` component next to size selector. | -- | OK | -- |
| CF-27 | **Per-variant pricing** -- `getVariantPrice()` computes price from variant matrix. Price updates reactively when size/color changes. Localized formatting. | -- | OK | -- |
| CF-28 | **Add to cart: prominent and validated** -- Large button with cart icon. Disabled when out of stock or missing required selections. Loading state shown during add. | -- | OK | -- |
| CF-29 | **Mobile sticky CTA** -- `SmartStickyCTA` component shows fixed bottom bar on mobile when main CTA scrolls out of view. Includes price, mini color dots, quantity +/-, and add-to-cart button. | -- | OK | -- |
| CF-30 | **Product description present** -- Plain text description rendered. Specifications section shows materials, care instructions, print technique, manufacturing country with icons. GPSR safety information in collapsible `<details>`. | -- | OK | -- |
| CF-31 | **Related products ("Customers Also Bought")** -- Fetched server-side via `getRelatedProducts()`. Rendered as ProductCard grid below reviews. | -- | OK | -- |
| CF-32 | **Recently viewed products** -- Tracked in localStorage via `useRecentlyViewed()`. Shown below related products, up to 4 items. | -- | OK | -- |
| CF-33 | **Reviews section present** -- Displays existing reviews with author, rating stars, verified badge, date. "Write Review" button opens `ReviewForm`. Empty state message: "Be the first to review". | -- | OK | -- |
| CF-34 | **Stock/availability indicator** -- Badge shows "In Stock" (green) or "Out of Stock" (red). Per-variant availability via cross-filtering. | -- | OK | -- |
| CF-35 | **Wishlist button present** -- Heart icon toggles wishlist state. Visual feedback (filled red heart). | -- | OK | -- |
| CF-36 | **Share button present** -- Uses Web Share API when available, falls back to clipboard copy with toast. | -- | OK | -- |
| CF-37 | **Breadcrumbs: 4 levels** -- `Home > Shop > Category > Product title`. Uses localized category names. | -- | OK | -- |
| CF-38 | **ISR with 1-hour revalidation** -- Pre-renders top 50 products x 3 locales. Good for SEO and performance. | -- | OK | -- |
| CF-39 | **Product JSON-LD** -- Includes `Product` schema with `AggregateOffer` or `Offer`, `AggregateRating`, and `BreadcrumbList` schema. | -- | OK | -- |
| CF-40 | **No shipping info preview on PDP** -- No estimated delivery time or shipping cost shown. User must reach cart to see shipping estimates. | MEDIUM | GAP | Add a "Free shipping over X" badge or estimated delivery info on the PDP. |
| CF-41 | **SocialProofIndicator present** -- Shows live engagement signals (e.g., "X people viewing") via `<SocialProofIndicator productId={product.id} />`. | -- | OK | -- |
| CF-42 | **Add to cart does not show "added" confirmation visually** -- The button changes text to "Adding..." but does not provide a clear "Added!" state or mini-cart flyout. Toast notification comes from useCart hook, but the button itself reverts immediately. | LOW | PARTIAL | Add a brief "Added!" state to the button (1.5s) or show a mini-cart sidebar/flyout on add. |

---

### 4. Cart

**Files analyzed:**
- `/src/app/[locale]/(app)/cart/page.tsx` (lines 1-23)
- `/src/components/cart/CartView.tsx` (lines 1-673)
- `/src/components/cart/CartCrossSell.tsx` (lines 1-50)
- `/src/hooks/useCart.tsx` (lines 1-80+)

| #     | Finding | Severity | Status | Recommendation |
|-------|---------|----------|--------|----------------|
| CF-43 | **Cart summary: complete** -- Shows item image, title, variant badges (size/color), per-item price, quantity controls (+/-/remove), item total. Order summary card with subtotal/shipping/total. | -- | OK | -- |
| CF-44 | **Edit quantities: full controls** -- Plus/minus buttons with max quantity enforcement. Remove button with undo toast (re-adds item on undo click). | -- | OK | -- |
| CF-45 | **Variant editing in cart** -- Pencil icon allows changing size/color inline without removing item. Uses `updateVariant()` from cart API. | -- | OK | -- |
| CF-46 | **Continue shopping: implicit** -- Product images/titles link back to product pages. No explicit "Continue Shopping" button above the cart items (only in empty state). | LOW | PARTIAL | Add a "Continue Shopping" link/button at the top of the non-empty cart view. |
| CF-47 | **Checkout CTA: well differentiated** -- Authenticated users see "Proceed to Checkout". Guest users see "Guest Checkout" (primary) + separator + "Sign In to Checkout" (outline). | -- | OK | -- |
| CF-48 | **Shipping estimate: present** -- Zip code input triggers `/api/cart/shipping-estimate`. Shows cost, delivery range (min/max days), and free shipping threshold messaging. | -- | OK | -- |
| CF-49 | **Coupon/discount field: present** -- Input with "Apply" button. Validates via `/api/coupons/validate`. Shows applied coupon with discount amount and remove button. Persisted to `sessionStorage` for use in checkout. | -- | OK | -- |
| CF-50 | **Free shipping progress bar** -- Shows progress toward free shipping threshold with `<Progress>` component. Unlocked state shows green checkmark. | -- | OK | -- |
| CF-51 | **Cart persistence: server-side** -- Cart stored in database (fetched via `/api/cart` endpoint). Refreshes on mount and user change. Guest carts handled via session/cookie. | -- | OK | -- |
| CF-52 | **Empty cart: handled** -- Shows message + "Continue Shopping" button linking to `/shop`. | -- | OK | -- |
| CF-53 | **Cross-sell: present** -- `CartCrossSell` component fetches related products via `/api/products/{id}/cross-sell` and renders up to 4 ProductCards. | -- | OK | -- |
| CF-54 | **Unavailable items: handled** -- Items with `unavailable: true` show destructive badge. Only available items counted in subtotal (line 68). | -- | OK | -- |

---

### 5. Checkout

**Files analyzed:**
- `/src/app/[locale]/(focused)/checkout/page.tsx` (lines 1-23)
- `/src/components/checkout/CheckoutView.tsx` (lines 1-733)
- `/src/components/checkout/AddressForm.tsx` (lines 1-60+)
- `/src/components/checkout/CheckoutBreadcrumb.tsx`
- `/src/app/[locale]/(focused)/checkout/success/page.tsx` (lines 1-152)
- `/src/app/[locale]/(focused)/checkout/cancel/page.tsx` (lines 1-61)

| #     | Finding | Severity | Status | Recommendation |
|-------|---------|----------|--------|----------------|
| CF-55 | **Guest checkout supported** -- Non-authenticated users see email field with validation. Redirected to Stripe Checkout which collects the shipping address. | -- | OK | -- |
| CF-56 | **Saved addresses for authenticated users** -- Fetches from `/api/shipping-addresses`. Shows selectable address cards with default badge. "Add New Address" form inline. | -- | OK | -- |
| CF-57 | **No address autocomplete** -- `AddressForm` uses plain `<Input>` fields. No Google Places, Mapbox, or similar autocomplete integration. Manual entry of all fields. | HIGH | GAP | Integrate address autocomplete (e.g., Google Places API, Mapbox Geocoding) to reduce friction and input errors. |
| CF-58 | **Stripe Checkout redirect** -- Payment is handled by Stripe's hosted checkout page (not embedded). Reduces PCI burden but adds a redirect step. | -- | OK | -- |
| CF-59 | **Order summary sidebar: complete** -- Shows cart items with images, variant details, quantities, subtotal, coupon discount, shipping (calculated at next step), tax (auto-calculated for selected address), and total. Sticky sidebar on desktop. | -- | OK | -- |
| CF-60 | **Tax calculation** -- Auto-calculates via `/api/checkout/calculate-tax` when a shipping address is selected. Shows "Calculating..." state. | -- | OK | -- |
| CF-61 | **Gift message option** -- Switch toggle enables textarea (max 200 chars). Included in checkout session metadata. | -- | OK | -- |
| CF-62 | **Trust badges present** -- "Fast Shipping", "Easy Returns", "Secure Payment" badges with icons below the payment section. | -- | OK | -- |
| CF-63 | **Payment method logos** -- Visa, Mastercard, Amex, PayPal SVG icons shown. | -- | OK | -- |
| CF-64 | **Security indicators** -- Lock icon on payment section title. Shield icon with "Secure payment" text. "Powered by Stripe" implied. | -- | OK | -- |
| CF-65 | **Error handling: present** -- Email validation errors shown inline. Stripe session creation errors show toast. 409 (unavailable items) shows specific item names. | -- | OK | -- |
| CF-66 | **Exit intent dialog** -- `useExitIntent()` hook detects mouse leaving viewport. Shows AlertDialog: "Are you sure you want to leave?" with Stay/Leave buttons. | -- | OK | -- |
| CF-67 | **Checkout breadcrumb** -- `CheckoutBreadcrumb` component shows progress step (currently always "shipping"). | -- | PARTIAL | Expand breadcrumb to show multi-step progress: Shipping > Payment > Confirmation. Currently static. |
| CF-68 | **Back to cart link** -- Ghost button with arrow at top of checkout. | -- | OK | -- |
| CF-69 | **Loading state: full skeleton** -- Checkout shows skeleton cards while loading. Empty cart state redirects to "Continue Shopping". | -- | OK | -- |
| CF-70 | **Coupon carried from cart** -- Applied coupon restored from `sessionStorage` on checkout mount. Code sent to Stripe session creation endpoint. | -- | OK | -- |

---

### 6. Post-Purchase

**Files analyzed:**
- `/src/app/[locale]/(focused)/checkout/success/page.tsx` (lines 1-152)
- `/src/app/[locale]/(focused)/checkout/success/CartClearer.tsx`
- `/src/app/api/webhooks/stripe/route.ts` (lines 1-180+)
- `/src/lib/resend.ts` (lines 1-60+)
- `/src/components/orders/OrdersView.tsx` (lines 1-272)
- `/src/components/orders/OrderDetailView.tsx` (lines 1-687)
- `/src/app/api/cron/abandoned-cart-recovery/route.ts` (lines 1-50+)
- `/src/app/api/newsletter/drip-sequence-docs/route.ts` (lines 1-50+)

| #     | Finding | Severity | Status | Recommendation |
|-------|---------|----------|--------|----------------|
| CF-71 | **Order confirmation page: complete** -- Shows success icon, order details card (email, line items, quantities, total paid, payment status). Action buttons: "Continue Shopping" + "View Orders". | -- | OK | -- |
| CF-72 | **Cart cleared after success** -- `CartClearer` client component runs on mount to clear the cart context. | -- | OK | -- |
| CF-73 | **Confirmation email: implemented** -- `sendOrderConfirmationEmail()` called from Stripe webhook on `checkout.session.completed`. Uses Resend API with branded HTML template. | -- | OK | -- |
| CF-74 | **Order tracking: present** -- `OrderDetailView` shows tracking number, carrier, and "Track Package" button linking to external tracking URL (when available). | -- | OK | -- |
| CF-75 | **Order history: present** -- Authenticated users see list of all orders with status badges, dates, totals, and "View Details" links. Empty state with "Start Shopping" CTA. Login required state handled. | -- | OK | -- |
| CF-76 | **Return request flow: present** -- Dialog with reason textarea (min 10 chars). Return requests shown on order detail with status badges and refund amounts. | -- | OK | -- |
| CF-77 | **Invoice download: present** -- Generates HTML invoice and triggers download. Shows order number, items, quantities, totals. | -- | PARTIAL | Consider generating PDF invoices instead of HTML for a more professional experience. |
| CF-78 | **Post-purchase drip sequence: present** -- Day 7 satisfaction survey + Day 14 follow-up configured in `newsletter_campaigns` table. Triggered by `drip/route.ts` cron checking `orders.delivered_at`. | -- | OK | -- |
| CF-79 | **Abandoned cart recovery: present** -- Cron-triggered (`/api/cron/abandoned-cart-recovery`). Sends 2 emails (1h and 24h after abandonment). Only works for authenticated users (guest carts have no email). | -- | PARTIAL | Consider capturing guest email earlier (e.g., exit-intent popup with email input) to enable guest cart recovery. |
| CF-80 | **No dedicated review request email** -- The drip sequence has satisfaction surveys but no explicit "Leave a review" email linking directly to the product review form. | MEDIUM | GAP | Add a "Review your purchase" email at Day 10 with direct links to each purchased product's review form (e.g., `/{locale}/shop/{id}#reviews`). |
| CF-81 | **Cancel page: present** -- Shows cancel icon, message, "Return to Cart" + "Continue Shopping" buttons. Cart is preserved (not cleared). | -- | OK | -- |
| CF-82 | **Webhook-based order email lifecycle** -- Order shipped (`order-shipped.ts`), delivered (`order-delivered.ts`), cancelled (`order-cancelled.ts`), failed (`order-failed.ts`) handlers exist in `/src/lib/pod/webhooks/handlers/`. | -- | OK | -- |

---

## Funnel Drop-off Risk Map

```
Stage                   Risk Level    Key Drop-off Points
----------------------------------------------------------------------
Landing Page            HIGH          - No "Shop" CTA (CF-01)
  |                                   - No "View All" after carousel (CF-05)
  v
Product Discovery       LOW           - No price range filter (CF-20)
  |                                   - No search autocomplete (CF-12)
  v
Product Detail          MEDIUM        - No image zoom (CF-24)
  |                                   - No shipping info preview (CF-40)
  v
Cart                    LOW           - Minor: no explicit "Continue Shopping"
  |                                     link when cart has items (CF-46)
  v
Checkout                MEDIUM        - No address autocomplete (CF-57)
  |                                   - Redirect to external Stripe page
  v
Post-Purchase           LOW           - No review request email (CF-80)
                                      - Guest abandoned cart not recoverable (CF-79)
```

### Estimated Impact by Drop-off Point

| Drop-off Point | Est. Users Lost | Fix Difficulty |
|---|---|---|
| CF-01: No Shop CTA on landing | 15-30% of landing visitors never reach the shop | Trivial (add 1 button) |
| CF-05: No "View All" after carousel | 5-10% miss full catalog | Trivial (add 1 link) |
| CF-24: No image zoom on PDP | 3-8% hesitate on purchase | Low (add library) |
| CF-57: No address autocomplete | 5-15% abandon at checkout due to address friction | Medium (API integration) |
| CF-40: No shipping info on PDP | 3-5% leave to check shipping separately | Low (add badge) |

---

## Priority Action Items

1. **[P0] CF-01 -- Add "Browse Products" CTA to landing page hero.** Both CTAs point to `/chat`. Add a secondary button to `/{locale}/shop`. This is the single highest-impact fix in the entire funnel.

2. **[P0] CF-05 -- Add "View All Products" link after product carousel.** One-line addition below the Carousel component: `<Button asChild variant="outline"><Link href="/{locale}/shop">View All Products</Link></Button>`.

3. **[P1] CF-24 -- Add image zoom to product detail page.** Install `react-medium-image-zoom` or implement a custom lightbox. Critical for product confidence, especially apparel.

4. **[P1] CF-57 -- Add address autocomplete to checkout.** Integrate Google Places API or similar. Reduces checkout abandonment significantly for international customers.

5. **[P1] CF-40 -- Show shipping info on product detail page.** Add a "Free shipping over EUR X" badge and/or "Estimated delivery: 5-8 business days" below the add-to-cart section.

6. **[P2] CF-20 -- Add price range filter to shop page.** Slider or min/max inputs alongside existing category/sort filters.

7. **[P2] CF-80 -- Add review request email.** Dedicated "Review your purchase" email at Day 10 post-delivery with product-specific links.

8. **[P2] CF-11 -- i18n for Testimonials component.** Move hardcoded "Happy Customers" and "out of 5" strings to translation keys.

9. **[P2] CF-12 -- Add search autocomplete/suggestions.** Show matching product titles as user types in the search bar.

10. **[P3] CF-15 -- Add ellipsis to pagination.** For catalogs with many pages, show `1 2 3 ... N-1 N` instead of all page buttons.

11. **[P3] CF-46 -- Add "Continue Shopping" link to non-empty cart.** Small UX improvement for users who want to add more items.

12. **[P3] CF-67 -- Expand checkout breadcrumb.** Show multi-step progress (Shipping > Payment > Confirmation) instead of static single step.

13. **[P3] CF-77 -- PDF invoices instead of HTML.** Use a library like `@react-pdf/renderer` for professional invoice generation.
