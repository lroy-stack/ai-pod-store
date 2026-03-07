# Conversion Funnel Audit — SKAPARA Store — 2026-03-07

## Conversion Funnel Scorecard

| Stage | Score (1-5) | Status | Friction Points | Drop-off Risk |
|---|---|---|---|---|
| 1. Landing Page | 3.5 | Functional but mis-targeted CTA | Hero CTA goes to Chat, not Shop | MEDIUM-HIGH |
| 2. Product Discovery | 4.0 | Solid | Category landing + search + filters work | LOW-MEDIUM |
| 3. Product Detail Page | 4.5 | Strong | No image zoom, no "Buy Now" | LOW |
| 4. Add to Cart | 4.0 | Good UX | Toast confirmation, no mini-cart drawer | LOW |
| 5. Cart Page | 4.5 | Very complete | Coupon, shipping estimate, cross-sell, undo | LOW |
| 6. Checkout | 4.0 | Good with gaps | No address autocomplete, guest flow works | LOW-MEDIUM |
| 7. Payment | 3.0 | Card only | No Apple Pay, Google Pay, Klarna, iDEAL | HIGH |
| 8. Post-Purchase | 3.5 | Functional | Order tracking, returns, invoice download | MEDIUM |
| **Overall** | **3.8** | | | |

---

## Phase 1: Landing -> Product Discovery (Top of Funnel)

### Landing Page (`frontend/src/app/[locale]/(landing)/page.tsx` + `LandingPageClient.tsx`)

**What works:**
- Full-viewport hero with animated gradient background (MetaballsBackground) — visually strong
- Brand mark (BrandMark component) above the fold
- Localized hero title and subtitle via next-intl
- Product carousel with autoplay (embla-carousel), showing prices, ratings, images
- "How It Works" 3-step section (Chat -> Design -> Deliver)
- Testimonials section with real reviews from DB
- Newsletter signup section
- Social proof: total orders count, average rating
- JSON-LD structured data (Organization + WebSite with SearchAction)
- SEO metadata with OpenGraph, Twitter cards, hreflang alternates
- Server-side data fetching (products, reviews, stats in parallel Promise.all)

**CRITICAL ISSUE — CTA mis-targeting:**
- Primary hero CTA (`heroCTA`) links to `/${locale}/chat` — the AI chat interface
- Final CTA section also links to `/${locale}/chat`
- For a first-time visitor, "Chat with AI" is NOT the action that leads to purchase
- There is NO direct "Shop Now" or "Browse Products" CTA on the landing page
- The product carousel cards link to individual products (good), but the main CTAs bypass the shop entirely

**Missing:**
- No "Shop Now" button above the fold or alongside the Chat CTA
- No category preview cards on landing (categories only appear on `/shop`)
- No urgency indicators (limited editions, sale badges on carousel)
- No free shipping threshold communication on landing

### Navigation to Products

**What works:**
- Search bar in StorefrontHeader with form submission to `/shop?q=`
- Mobile search toggle
- Cart badge with live item count
- Sidebar navigation (StorefrontSidebar) with Shop link
- Locale switcher (EN/ES/DE)

**What works well:**
- Clicks from landing to first product: 1 click (carousel card) or 2 clicks (nav -> shop -> product)
- Search is prominent in the header

### Product Listing Page (`shop/page.tsx` + `ShopPageClient.tsx`)

**What works:**
- Category landing mode (no search) shows category cards with preview images and product counts
- Search mode shows product grid with filters
- Sorting: featured, price low/high, newest, top rated
- Category filter via URL params
- Pagination (20 products/page, client-side navigation)
- Breadcrumbs (Home > Shop)
- ISR with 5-minute revalidation
- JSON-LD ItemList structured data
- Variant data (sizes, colors, color images) fetched server-side in batch
- Price range display for variant pricing ("from X")
- In-stock indicator derived from variant availability

**Missing:**
- No price range filter (slider)
- No color/size filter on listing page (only on individual products)
- No "New Arrivals" badge on product cards (filter exists but no visual indicator)
- No infinite scroll (pagination only)

---

## Phase 2: Product -> Cart (Intent)

### Product Detail Page (`shop/[id]/page.tsx` + `ProductDetailClient.tsx`)

**What works (STRONG):**
- Image gallery with thumbnails, color-filtered images per variant
- Large aspect-square main image with priority loading
- Price clearly visible (3xl font bold), with strikethrough for compare-at prices
- Size selector with cross-filtering (unavailable combos shown as strikethrough + "Out of Stock")
- Color selector with cross-filtering
- SizeGuide component (inline, category-aware)
- Stock status badge (In Stock / Out of Stock)
- Product specifications: materials, care instructions, print technique, manufacturing country
- GPSR safety information (EU compliance) in collapsible details
- Reviews section with star ratings, verified purchase badges
- Review form (write a review)
- Related products ("Customers Also Bought")
- Recently viewed products (localStorage-based tracking)
- Wishlist toggle (heart icon)
- Share button (Web Share API with clipboard fallback)
- Design studio link (Paintbrush2 icon)
- Breadcrumbs (Home > Shop > Category > Product)
- JSON-LD Product structured data with AggregateOffer for variant pricing
- SocialProofIndicator component
- SmartStickyCTA for mobile (appears when main CTA scrolls out of view)
- Per-variant pricing reactively computed
- Localized currency conversion
- ISR with 1-hour revalidation + generateStaticParams for top 50 products x 3 locales

**Missing:**
- NO image zoom / pinch-to-zoom / magnifier on hover — users cannot inspect print quality
- NO "Buy Now" button for impulse purchases (only "Add to Cart")
- NO estimated delivery date on product page
- NO shipping cost preview on product page
- Color selector uses dropdown (Select), not visual color swatches — missed opportunity for visual product switching

### Add to Cart Experience

**What works:**
- `addToCart` via useCart hook -> POST /api/cart
- Toast notification on success (via sonner)
- Cart badge in header updates immediately (useCart context)
- Analytics tracking (trackAddToCart)
- Variant validation before add (size/color required if available)
- Composition ID support (custom designs)

**Missing:**
- No mini-cart drawer / slide-out panel after adding — user sees only a toast
- No "Buy Now" direct-to-checkout path
- No "Added to cart" confirmation with product thumbnail in toast

---

## Phase 3: Cart -> Checkout (Decision)

### Cart Page (`cart/page.tsx` + `CartView.tsx`)

**What works (VERY COMPLETE):**
- Product images, titles, sizes, colors shown with badges
- Quantity controls (+/-) with max limit (STORE_DEFAULTS.maxCartQuantity)
- Remove item with UNDO capability (toast with action button) — excellent UX
- Inline variant editing (change size/color without removing item)
- Subtotal, discount, shipping, total clearly displayed
- Coupon code field with validation (POST /api/coupons/validate), persisted to sessionStorage
- Shipping estimate by zip code (POST /api/cart/shipping-estimate)
- Free shipping progress bar with threshold indicator (50 EUR threshold)
- Order summary card sticky on desktop
- Guest checkout option (prominent, with "or sign in" separator)
- Cross-sell section (CartCrossSell component)
- Crypto payment badge (conditional on env var)
- Unavailable items marked with destructive badge

**Cart persistence:**
- Server-side cart (API /api/cart) — survives page refresh and browser close for authenticated users
- Loads on mount and on user change (useEffect in CartProvider)
- NO localStorage fallback for guests — guest carts are server-side via anonymous session

**Missing:**
- No explicit trust signals in cart (secure checkout badge, return policy link)
- No estimated delivery date in cart
- No "Save for Later" option

### Abandoned Cart Recovery

**EXISTS and is implemented** (`/api/cron/abandoned-cart-recovery/route.ts`):
- Two-stage email: 1h (first), 24h (second)
- Locale-aware (EN/ES/DE) with localized subjects and body
- Cron-triggered (every 30-60 min)
- Only works for authenticated users (guest carts have no email) — significant gap

---

## Phase 4: Checkout -> Payment (Commitment)

### Checkout Flow (`checkout/page.tsx` + `CheckoutView.tsx`)

**What works:**
- CheckoutBreadcrumb component (progress indicator at "shipping" step)
- Shipping address selection for authenticated users (saved addresses)
- Add new address form (AddressForm component)
- Guest checkout with email input and validation
- Tax calculation via /api/checkout/calculate-tax (based on selected address)
- Order summary sidebar with cart items, quantities, subtotal, discount, tax
- Gift message option (Switch toggle + Textarea, max 200 chars)
- Coupon code persistence from cart (sessionStorage)
- Trust badges: shipping, returns, secure payment icons
- Payment method logos (Visa, Mastercard, Amex, PayPal icons displayed)
- Exit intent dialog (AlertDialog when user tries to leave) — reduces abandonment
- Back to cart link
- "Redirected to secure payment" message with Shield icon

**Checkout steps:** Effectively 2 steps: (1) Shipping address + review, (2) Stripe hosted checkout
- This is good — minimal steps

**Guest checkout:** YES, supported — does not force registration

**Missing:**
- NO address autocomplete (Google Places API not integrated)
- PayPal logo shown in accepted payments but NOT actually available as payment method (only `card` in payment_method_types)
- Form fields are reasonable but no input type optimization visible (tel, numeric zip)
- No order review step before redirect to Stripe (items shown in sidebar but no explicit "Review Order" confirmation)

### Payment Options (`/api/checkout/create-session/route.ts`)

**CRITICAL GAP:**
```typescript
const paymentMethodTypes: string[] = ['card'];
if (process.env.STRIPE_CRYPTO_ENABLED === 'true') {
  paymentMethodTypes.push('crypto');
}
```

- **Only `card` payment method** configured
- NO Apple Pay / Google Pay (Stripe supports these with zero extra code via `payment_method_types: ['card']` + Stripe Elements, but hosted checkout needs explicit config or automatic_payment_methods)
- NO Klarna / Afterpay (buy now, pay later) — critical for EU market
- NO iDEAL (Netherlands), Bancontact (Belgium), SEPA Direct Debit — important for EU
- NO PayPal — despite showing PayPal logo in checkout UI (misleading)
- Crypto is conditional on env var (likely disabled in production)

**Shipping:**
- Stripe shipping_address_collection used when no pre-filled address
- ALLOWED_SHIPPING_COUNTRIES configured
- Free shipping threshold: 50 EUR (from store-config.ts)
- Free shipping status calculated at session creation

---

## Phase 5: Post-Purchase (Retention)

### Order Confirmation (`checkout/success/page.tsx`)

**What works:**
- CartClearer component (clears cart after payment)
- Success icon with green checkmark
- Stripe session details fetched (customer email, line items, amounts, payment status)
- Order total displayed with currency formatting
- Payment status shown
- Action buttons: "Continue Shopping" + "View Orders"
- Localized via next-intl

**Missing:**
- No order number displayed on success page (only Stripe session details)
- No estimated delivery date
- No "Share your purchase" social buttons

### Checkout Cancel (`checkout/cancel/page.tsx`)

**Works well:**
- Clear cancel message
- "Return to Cart" + "Continue Shopping" buttons
- Cart NOT cleared on cancel (correct behavior)

### Order Confirmation Email

**EXISTS** (`/api/webhooks/stripe/route.ts` -> `sendOrderConfirmationEmail`):
- Sent via Resend after successful payment webhook
- Error handling for email send failure (logged but doesn't block order)

### Order Tracking (`orders/page.tsx` + `OrdersView.tsx`)

**What works:**
- Order list with status badges (paid, submitted, in_production, shipped, delivered, cancelled, refunded)
- Order total, date, tracking number
- "View Details" link to individual order

**Missing:**
- Requires authentication — guest orders NOT trackable (no order lookup by email/order number)
- No email notifications for status changes (shipped, delivered) — webhook handlers exist but email integration unclear

### Order Detail (`orders/[id]/page.tsx` + `OrderDetailView.tsx`)

**What works (COMPREHENSIVE):**
- Order items with quantities and prices
- Shipping address display
- Payment method display (card vs crypto)
- Tracking number + carrier + "Track Package" link (tracking_url)
- Return request system: Dialog form with reason, minimum 10 chars
- Return status tracking (pending, approved, processing, completed, rejected)
- Invoice download (HTML format)
- Back to orders navigation

**Missing:**
- No product images in order detail items (shows Package icon placeholder)
- Invoice is HTML, not PDF — unprofessional for EU B2C
- No reorder button ("Buy again")

### Returns & Support

**What works:**
- Return request from order detail page
- Return status tracking with badges
- Refund amount display
- Returns policy page exists (`/returns`)

**Missing:**
- No live chat / contact form for order issues (AI chat is product-focused)
- No FAQ page linked from order issues

---

## Critical Gaps (WILL Lose Sales)

### 1. Landing Page CTA Points to Chat, Not Shop (Impact: HIGH)
The primary CTA on the landing page sends users to the AI chat interface. First-time visitors want to browse products, not chat with an AI. This is the single biggest conversion killer — the entire top of funnel is misdirected.

**Evidence:** `LandingPageClient.tsx:143` — `<Link href={/${locale}/chat}>` and line 333 (final CTA) — same destination.

### 2. Only Card Payment Method (Impact: HIGH)
In the EU market, card-only checkout loses 15-30% of potential conversions. Missing: Apple Pay, Google Pay, Klarna, SEPA, iDEAL, Bancontact. The checkout UI shows PayPal and Amex logos but these are NOT actually available payment methods — this is actively misleading.

**Evidence:** `/api/checkout/create-session/route.ts:269` — `const paymentMethodTypes: string[] = ['card']`

### 3. No Image Zoom on Product Detail (Impact: MEDIUM-HIGH)
Print-on-demand products live or die by design quality. Users cannot inspect print details, text readability, or color accuracy without zoom. This is especially critical for custom/meme designs where text legibility matters.

**Evidence:** No zoom/magnifier component found in `frontend/src/components/products/`. Images are `object-cover` in a fixed aspect-square container with no interaction.

### 4. No "Buy Now" / Express Checkout (Impact: MEDIUM)
No way to skip the cart for impulse purchases. Every purchase requires: Add to Cart -> Go to Cart -> Proceed to Checkout. For single-item impulse buys (especially from landing page carousel), this adds 2 unnecessary steps.

### 5. Guest Order Tracking Impossible (Impact: MEDIUM)
Guest checkout users cannot track their orders. OrdersView requires authentication. No order lookup by email + order number. This generates support tickets and erodes trust.

---

## Quick Wins (Easy Fixes, High Impact)

### 1. Add "Shop Now" CTA to Landing Page (Effort: 30 min, Impact: HIGH)
Add a secondary Button linking to `/${locale}/shop` alongside or below the Chat CTA on the hero section. Consider making "Shop Now" the PRIMARY CTA and "Design with AI" the secondary.

### 2. Enable `automatic_payment_methods` in Stripe (Effort: 15 min, Impact: HIGH)
Replace `payment_method_types: ['card']` with `automatic_payment_methods: { enabled: true }` in the checkout session config. This instantly enables Apple Pay, Google Pay, and Link (Stripe's one-click) with zero UI changes — Stripe hosted checkout handles everything.

### 3. Remove Misleading PayPal Logo (Effort: 5 min, Impact: LOW but trust-building)
Remove the PayPal and Amex SVG logos from `CheckoutView.tsx:562-565` unless these payment methods are actually configured. Showing logos for unavailable methods damages trust.

### 4. Add Image Zoom (Effort: 2-4 hours, Impact: MEDIUM-HIGH)
Integrate a lightweight zoom library (e.g., `react-medium-image-zoom` or CSS-only `transform: scale()` on hover) for the product detail main image. Mobile: pinch-to-zoom. Desktop: hover lens or click-to-expand lightbox.

### 5. Free Shipping Banner on Landing (Effort: 30 min, Impact: MEDIUM)
Add a persistent banner or badge: "Free shipping on orders over 50 EUR" — the threshold exists in config but is only visible deep in the cart page.

---

## Recommendations (By Funnel Stage, Prioritized by Impact)

### P0 — Revenue-Critical (Do This Week)

| # | Recommendation | Stage | Effort | Expected Impact |
|---|---|---|---|---|
| 1 | Add "Shop Now" CTA to landing hero (primary) + keep "Design with AI" (secondary) | Landing | 30 min | +15-25% click-through to shop |
| 2 | Enable `automatic_payment_methods: { enabled: true }` in Stripe session | Payment | 15 min | +10-20% checkout completion |
| 3 | Remove misleading PayPal/Amex logos OR actually enable those methods | Checkout | 5 min | Trust signal correction |
| 4 | Add Klarna/Afterpay (BNPL) to payment methods | Payment | 2h (Stripe dashboard + config) | +8-15% conversion for high-AOV items |

### P1 — High Impact (Do This Sprint)

| # | Recommendation | Stage | Effort | Expected Impact |
|---|---|---|---|---|
| 5 | Image zoom/magnifier on product detail | Product | 3h | Reduces returns, increases confidence |
| 6 | "Buy Now" button on product detail (skip cart, direct to checkout) | Product | 4h | +5-10% impulse conversions |
| 7 | Guest order lookup by email + order number | Post-Purchase | 4h | Reduces support load, builds trust |
| 8 | Free shipping threshold banner (landing + header) | Landing/Nav | 1h | Increases AOV toward 50 EUR |
| 9 | Mini-cart drawer (Sheet component) after add-to-cart | Cart | 3h | Reduces friction, shows cart state |
| 10 | Color swatches (visual circles) instead of dropdown Select | Product | 3h | Faster variant selection, more visual |

### P2 — Medium Impact (Next Sprint)

| # | Recommendation | Stage | Effort | Expected Impact |
|---|---|---|---|---|
| 11 | Address autocomplete (Google Places API) | Checkout | 4h | Reduces form friction, fewer errors |
| 12 | Estimated delivery date on product page and cart | Product/Cart | 4h | Sets expectations, reduces uncertainty |
| 13 | Price range filter on shop page | Discovery | 3h | Better product discovery for price-sensitive users |
| 14 | PDF invoice generation (replace HTML) | Post-Purchase | 3h | Professional appearance for EU B2C |
| 15 | Product images in order detail (not Package icon) | Post-Purchase | 2h | Better order review experience |
| 16 | "Buy Again" / reorder button on order detail | Post-Purchase | 3h | Repeat purchase facilitation |
| 17 | Abandoned cart recovery for guest users (collect email earlier) | Cart | 6h | Recovers guest abandonment |

### P3 — Nice to Have (Backlog)

| # | Recommendation | Stage | Effort | Expected Impact |
|---|---|---|---|---|
| 18 | Infinite scroll on shop page (replace pagination) | Discovery | 4h | More products viewed per session |
| 19 | "Save for Later" in cart | Cart | 4h | Preserves intent without cart clutter |
| 20 | Social share buttons on order success | Post-Purchase | 1h | Organic acquisition |
| 21 | Email notifications for order status changes | Post-Purchase | 4h | Proactive communication |
| 22 | Live chat / contact widget for order issues | Post-Purchase | 6h | Reduces support friction |

---

## Architecture Strengths (What NOT to Change)

- **Server-side cart** via API — robust persistence, no localStorage fragility
- **Guest checkout** — does not force registration, correct for conversion
- **Exit intent dialog** on checkout — proven abandonment reducer
- **Abandoned cart email recovery** — 2-stage with localized content
- **Cross-sell in cart** (CartCrossSell) — increases AOV
- **Free shipping progress bar** — motivates threshold completion
- **Undo on item removal** — prevents accidental cart clearing
- **Smart sticky CTA** on mobile product page — keeps action always accessible
- **ISR + generateStaticParams** — fast page loads for SEO and UX
- **JSON-LD structured data** on all commerce pages — rich search results
- **Variant cross-filtering** — unavailable combos shown but disabled, not hidden

---

## Summary

The SKAPARA store has a solid mid-funnel (product detail, cart, checkout flow) but suffers from two critical top-of-funnel and bottom-of-funnel gaps:

1. **The landing page funnels users to Chat instead of Shop** — the most impactful single fix
2. **Payment is card-only in the EU market** — enabling Stripe's automatic_payment_methods is a 15-minute fix with outsized impact

The cart and checkout experience is above average for a POD store (coupon codes, shipping estimate, guest checkout, exit intent, cross-sell, abandoned cart recovery). The product detail page is comprehensive with variant cross-filtering, specifications, reviews, and social proof. The main UX gaps are image zoom, express checkout ("Buy Now"), and visual color swatches.

Post-purchase has the foundations (order tracking, returns, invoice) but needs guest order access and product images in order details to be complete.

**Estimated conversion lift from P0 fixes alone: +20-40%** (CTA redirect + payment methods).
