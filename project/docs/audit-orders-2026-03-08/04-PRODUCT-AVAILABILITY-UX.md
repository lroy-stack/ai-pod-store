# Product Availability & Variant Selection UX Audit

**Date**: 2026-03-08
**Scope**: Product display, variant selection, stock validation, and availability edge cases across the frontend
**Status**: COMPREHENSIVE REVIEW

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Product Display Components](#2-product-display-components)
3. [Product API Layer](#3-product-api-layer)
4. [Variant Selection UX](#4-variant-selection-ux)
5. [Product Variants Schema](#5-product-variants-schema)
6. [Availability Validation Chain](#6-availability-validation-chain)
7. [Edge Cases & Gaps](#7-edge-cases--gaps)
8. [Product Status Lifecycle](#8-product-status-lifecycle)
9. [Scorecard](#9-scorecard)
10. [Recommendations](#10-recommendations)

---

## 1. Architecture Overview

### Data Flow: Provider -> DB -> API -> Frontend

```
Printful/Printify webhooks
        |
  stock-updated.ts handler    <-- Updates is_available in product_variants
        |
  sync-product.ts             <-- Syncs variants (is_enabled, is_available, price_cents)
        |
  Supabase product_variants   <-- Source of truth
        |
  /api/products (list)        <-- Filters: is_enabled=true AND is_available=true
  /api/products/[id] (detail) <-- Returns available + all-enabled variants
        |
  ProductCard / ProductDetailClient  <-- Renders variant selectors, stock badges
        |
  /api/cart POST               <-- Validates product active + variant enabled+available
        |
  /api/checkout/create-session <-- Re-validates product active + variant is_available
```

### Key Files

| File | Role |
|------|------|
| `frontend/src/types/product.ts` | Type definitions: ProductBase, ProductCard, ProductDetail |
| `frontend/src/components/products/ProductCard.tsx` | Grid card with color swatches, out-of-stock overlay |
| `frontend/src/components/products/ProductDetailClient.tsx` | Full PDP with cross-filtered variant selectors |
| `frontend/src/components/products/VariantSelector.tsx` | Reusable size/color chip selector |
| `frontend/src/components/products/QuickViewModal.tsx` | Modal quick-view with variant selection |
| `frontend/src/components/products/SmartStickyCTA.tsx` | Mobile sticky bar (Buy Now + Add to Cart) |
| `frontend/src/components/cart/CartView.tsx` | Cart with variant editing, unavailable badge |
| `frontend/src/components/checkout/CheckoutView.tsx` | Checkout with 409 handling for unavailable items |
| `frontend/src/app/api/products/route.ts` | Product listing API |
| `frontend/src/app/api/products/[id]/route.ts` | Product detail API |
| `frontend/src/app/api/cart/route.ts` | Cart CRUD with variant validation |
| `frontend/src/app/api/checkout/create-session/route.ts` | Stripe session creation with stock check |
| `frontend/src/lib/pod/webhooks/handlers/stock-updated.ts` | Webhook handler for stock changes |
| `frontend/src/lib/pod/sync/sync-product.ts` | Provider-agnostic product sync |
| `frontend/src/lib/product-detail-cache.ts` | Server-side product cache (Redis + React.cache) |

---

## 2. Product Display Components

### 2.1 ProductCard (Grid/List View)

**File**: `frontend/src/components/products/ProductCard.tsx`

**What it displays**:
- Product image with color variant swatches overlaid at bottom-left
- Category label, star rating, review count
- Price with "from" prefix when `hasVariantPricing` is true
- Compare-at price with strikethrough and percentage badge
- Wishlist heart button, quick-view eye button, add-to-cart button

**Availability handling**:
- **Out-of-stock overlay**: When `product.inStock === false`, renders a semi-transparent overlay with an "Out of Stock" badge centered on the image.
- **Disabled cart button**: The add-to-cart button is `disabled` when `product.inStock === false`.
- **No low-stock warning**: No "Only X left" or urgency indicator at the card level.

**Color swatches**:
- Displays thumbnail images for each color variant from `product.variants.colorImages`
- Click/hover changes the displayed product image
- Swatches do NOT indicate which colors are unavailable -- all swatches appear equally available

**Add-to-cart behavior**:
- If product has multiple variants (sizes > 1 or sizes >= 1 with colors > 1), clicking cart opens the product detail panel via `addArtifact` + `setSelectedProduct` -- does NOT blindly add.
- If product has a single variant, calls `addToCart(product.id, 1, undefined, ...)` letting the server auto-select.

### 2.2 ProductDetailClient (Full PDP)

**File**: `frontend/src/components/products/ProductDetailClient.tsx`

**Variant Selection UX**:

1. **Color selector** (rendered when `allColors.length > 0`):
   - Shows ALL enabled colors (`allColors` from API), not just available ones
   - Visual thumbnail for each color (from `colorImageIndices`) or a fallback swatch
   - **Unavailable colors are visually dimmed** (`opacity-40 cursor-not-allowed`) and disabled
   - Cross-filtered by selected size: `availableColorsForSize` computed from `unavailableCombinations`
   - Clicking selects color and resets image carousel to index 0

2. **Size selector** (rendered when `allSizes.length > 0`):
   - Shows ALL enabled sizes (`allSizes` from API)
   - Uses shadcn Button components with `variant="default"` for selected, `variant="outline"` for unselected
   - **Unavailable sizes are dimmed** (`opacity-40 line-through`) and disabled
   - Cross-filtered by selected color: `availableSizesForColor` computed from `unavailableCombinations`
   - Size guide link shown for clothing categories

3. **Cross-filter logic** (bidirectional):
   - When user selects Black, sizes not available in Black get disabled
   - When user selects XL, colors not available in XL get disabled
   - Auto-reset: if a selected size/color becomes unavailable due to the other dimension's change, it auto-selects the first available option

4. **Price display**:
   - Per-variant pricing: `getVariantPrice(selectedSize, selectedColor)` looks up exact price from `variants.prices` array
   - Fallback chain: exact match -> size-only -> color-only -> base product price
   - Compare-at price with strikethrough

5. **Stock badge**:
   - Shows "In Stock" (green) or "Out of Stock" (red) badge
   - Based on `product.inStock` (boolean, derived from `variants.length > 0`)

6. **CTA buttons**:
   - Add to Cart and Buy Now are **disabled** when:
     - `!isCurrentCombinationAvailable` (product not in stock or selected combo is in `unavailableCombinations`)
     - Size required but not selected
     - Color required but not selected
   - Button text changes to "Out of Stock" when disabled due to availability

7. **Auto-selection logic**:
   - Single option: auto-selects the only size/color
   - Image mapping: auto-selects first option when variant-to-image mapping exists
   - URL parameter: respects `?color=` from card navigation

### 2.3 QuickViewModal

**File**: `frontend/src/components/products/QuickViewModal.tsx`

**Issues found**:
- Uses `VariantSelector` component but does NOT pass `availableSizes` or `availableColors` props -- all variants appear equally available
- Stock badge only shows when `product.stock !== undefined && product.stock > 0`, but the `stock` field is never populated by the list API (it returns `inStock: boolean`, not `stock: number`)
- **GAP**: QuickViewModal does NOT check `inStock` to disable the add-to-cart button -- a user can attempt to add an out-of-stock product from QuickView
- **GAP**: No cross-filtering of unavailable combinations (only has list-level data, not detail-level `unavailableCombinations`)

### 2.4 SmartStickyCTA (Mobile)

**File**: `frontend/src/components/products/SmartStickyCTA.tsx`

- Appears on mobile when main CTA scrolls out of viewport
- Shows price, mini color dots, quantity +/-, Buy Now, Add to Cart
- Buttons disabled when `disabled` prop is true (passed from `isCurrentCombinationAvailable`)
- Text shows "Out of Stock" when disabled

### 2.5 DynamicPriceStock (PPR Stub)

**File**: `frontend/src/components/products/DynamicPriceStock.tsx`

- **NOT USED IN PRODUCTION**: This is a PPR (Partial Pre-Rendering) stub with hardcoded `inStock = true`
- Contains `// In production: check actual inventory` comment
- Currently not imported by any active component

---

## 3. Product API Layer

### 3.1 Product List API (`/api/products`)

**File**: `frontend/src/app/api/products/route.ts`

**Filtering**:
- Products: `status = 'active'` AND `deleted_at IS NULL`
- Variants: `is_enabled = true` AND `is_available = true`

**`inStock` derivation**:
```typescript
inStock: variantsMap.has(p.id)
```
A product is "in stock" if it has **at least one** variant that is both enabled AND available. If ALL variants are disabled or unavailable, `variantsMap` won't contain the product ID and `inStock = false`.

**Variant data returned**:
- `sizes`: unique sorted sizes from available variants
- `colors`: unique colors from available variants
- `colorImages`: first image URL per color (for card swatches)
- `hasVariantPricing`: true if variant prices differ
- `minPrice` / `maxPrice`: price range across variants

**Note**: The list API only returns AVAILABLE variants -- it does NOT return all-enabled variants or unavailable combinations. This means the card view cannot show which specific colors/sizes are unavailable.

### 3.2 Product Detail API (`/api/products/[id]`)

**File**: `frontend/src/app/api/products/[id]/route.ts`

**Three parallel queries**:
1. Product record (status='active', deleted_at IS NULL)
2. Available variants (is_enabled=true AND is_available=true) -- for sizes/colors/prices
3. All enabled variants (is_enabled=true only) -- for building unavailableCombinations

**Key data returned**:
- `sizes`: from available variants only
- `colors`: from available variants only
- `allSizes`: from ALL enabled variants (includes unavailable)
- `allColors`: from ALL enabled variants (includes unavailable)
- `unavailableCombinations`: array of {color, size} where is_enabled=true but is_available=false
- `colorImageIndices`: variant-to-image mapping for gallery filtering
- `prices`: per-variant prices when variant pricing differs
- `inStock`: `variants.length > 0` (has at least one available variant)

**This is well-designed**: The detail API provides the full picture needed for cross-filtering UX.

### 3.3 Server-Side Cache

**File**: `frontend/src/lib/product-detail-cache.ts`

- Uses `React.cache()` for same-request deduplication
- Redis caching via `getCachedProductDetail` / `setCachedProductDetail`
- Cache key per product ID
- **GAP**: No TTL visible in the cache code itself -- if a variant goes out of stock, the cached detail may serve stale `inStock` and `unavailableCombinations` data until cache expires or is invalidated

### 3.4 ISR / Revalidation

- Shop page: `revalidate = 300` (5 minutes)
- Product detail page: `revalidate = 3600` (1 hour)
- **GAP**: A product variant going out of stock won't be reflected for up to 1 hour on the PDP, or 5 minutes on the shop page. No on-demand revalidation triggered by stock webhooks.

---

## 4. Variant Selection UX

### 4.1 Full PDP Experience (ProductDetailClient)

**UX Flow**:

1. User lands on PDP. Colors and sizes are shown from `allColors` / `allSizes`.
2. Available options have normal styling; unavailable ones are dimmed + disabled + line-through.
3. Selecting a color cross-filters sizes (and vice versa).
4. Price updates reactively based on selected size+color combo.
5. Image gallery filters to show only images matching the selected variant.
6. If selected combo becomes unavailable, auto-resets to first available.
7. Add to Cart / Buy Now disabled until valid available combination is selected.

**This is GOOD**: The PDP implements a proper Amazon-style cross-filter variant selector.

### 4.2 QuickView Experience

**UX Flow**:

1. User clicks eye icon on ProductCard.
2. QuickViewModal opens with VariantSelector showing sizes/colors.
3. ALL variants appear equally selectable (no availability filtering).
4. User picks size + color and clicks Add to Cart.
5. Cart API validates and may reject if variant is unavailable.

**This is MEDIOCRE**: Users get no visual cue about unavailability until the server rejects their add-to-cart.

### 4.3 Cart Variant Editing

**UX Flow**:

1. Cart shows each item with variant badges (Size: M, Color: Black).
2. Pencil icon opens inline variant editor with Select dropdowns.
3. Available variants are fetched via cart API's `available_variants` field.
4. Only available sizes/colors shown in the dropdown (is_enabled=true, is_available=true).
5. PATCH `/api/cart` validates the new variant combination server-side.

**This is GOOD**: Cart editing properly validates and shows only available options.

---

## 5. Product Variants Schema

### Database Schema

```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  printify_variant_id VARCHAR(255),  -- renamed to external_variant_id in later migrations
  title VARCHAR(255) NOT NULL,
  size VARCHAR(50),
  color VARCHAR(50),
  price_cents INTEGER NOT NULL,
  sku VARCHAR(100),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE
);
```

### Field Semantics

| Field | Meaning |
|-------|---------|
| `is_enabled` | Whether the store owner has enabled this variant for sale. Synced from provider. Disabled variants are never shown to customers. |
| `is_available` | Whether the variant is currently in stock / available from the provider. Updated by `stock-updated.ts` webhook handler. |
| `price_cents` | Variant-specific price in cents. Used for per-variant pricing. |
| `image_url` | Provider mockup image URL for this variant. Used for color swatches. |
| `external_variant_id` | Provider's variant ID (Printful sync_variant_id or Printify variant_id). Used for stock webhook matching. |

### No `stock_quantity` Column

The schema does NOT have a `stock_quantity` or `inventory_count` column. This is appropriate for print-on-demand (POD) where products are made-to-order and "stock" is really provider availability, not a counted inventory.

---

## 6. Availability Validation Chain

### 6.1 Add to Cart (`POST /api/cart`)

**Validations performed**:
1. Product exists: `products.id = product_id AND status = 'active' AND deleted_at IS NULL`
2. Variant resolution: finds `product_variants` where `product_id` matches, `is_enabled = true`, `is_available = true`, and size/color match
3. Auto-select: if no variant specified and only 1 available, auto-selects it
4. Variant required: if multiple available variants and none specified, returns `VARIANT_REQUIRED` (400)
5. No variants: if zero available variants, returns `NO_VARIANTS` (400)

**GOOD**: Proper server-side validation. Client cannot add unavailable variants.

### 6.2 Update Cart Variant (`PATCH /api/cart`)

**Validations performed**:
1. Ownership check (user_id or session_id)
2. New variant must be `is_enabled = true` AND `is_available = true`
3. Returns `VARIANT_UNAVAILABLE` if no match

**GOOD**: Prevents switching to an unavailable variant.

### 6.3 Checkout Session Creation (`POST /api/checkout/create-session`)

**Validations performed**:
1. All items must have `variant_id` (MISSING_VARIANTS check)
2. All products must be `status = 'active'` AND `deleted_at IS NULL` (PRODUCTS_UNAVAILABLE, 409)
3. **Stock validation**: For each cart item, finds matching variant (product_id + color + size) where `is_enabled = true`. If variant not found or `is_available = false`, adds to `unavailableItems` list. Returns 409 with item details.
4. Server-side price authority: overrides client prices with DB variant prices

**GOOD**: Three-layer validation at checkout prevents purchasing unavailable items. The frontend handles 409 by showing a toast with item names.

### 6.4 Stock Webhook Handler

**File**: `frontend/src/lib/pod/webhooks/handlers/stock-updated.ts`

- Receives stock.updated events from Printful
- Extracts variant-level stock changes (in_stock flag or quantity)
- Updates `is_available` in `product_variants` by `external_variant_id`
- Logs to `audit_log` table

**GOOD**: Real-time stock updates from the provider.

### 6.5 Product Sync

**File**: `frontend/src/lib/pod/sync/sync-product.ts`

- Syncs `is_enabled` and `is_available` from provider canonical model
- Filters out disabled variants (`v.isEnabled !== false`)
- Uses upsert on `(product_id, external_variant_id)` conflict

---

## 7. Edge Cases & Gaps

### CRITICAL Gaps

#### GAP-1: QuickViewModal Does Not Check Availability (MEDIUM)
**File**: `frontend/src/components/products/QuickViewModal.tsx`
- The QuickView modal does NOT pass `availableSizes` / `availableColors` to `VariantSelector`
- All sizes and colors appear equally selectable regardless of availability
- The add-to-cart button is NOT disabled when `product.inStock === false`
- **Impact**: User selects an unavailable variant, gets a server error after clicking Add to Cart
- **Fix**: Pass `inStock` check on the CTA button; pass availability sets to VariantSelector. Or better: fetch detail-level data with `unavailableCombinations`.

#### GAP-2: Stale ISR Cache After Stock Change (MEDIUM)
**File**: `frontend/src/app/[locale]/(app)/shop/[id]/page.tsx`
- ISR revalidation is 1 hour (`revalidate = 3600`)
- When a stock webhook marks a variant unavailable, the PDP continues serving cached data for up to 1 hour
- Shop page has 5-minute revalidation but the same staleness issue applies
- Redis product detail cache has no explicit invalidation triggered by stock webhooks
- **Impact**: Users see "In Stock" and can select variants that are actually unavailable, getting rejected only at cart/checkout
- **Fix**: Trigger on-demand ISR revalidation (`revalidatePath`/`revalidateTag`) from the stock webhook handler. Also invalidate Redis cache when stock.updated fires.

#### GAP-3: No "Notify When Back in Stock" Feature (LOW-MEDIUM)
- There is NO back-in-stock notification system
- No email subscription for out-of-stock products
- No waitlist functionality
- `grep` for "notify", "back.in.stock", "waitlist", "restock" found zero relevant results
- **Impact**: Lost sales when popular items go temporarily unavailable. Customer has no way to be alerted when stock returns.

### MODERATE Gaps

#### GAP-4: ProductCard Color Swatches Don't Show Unavailability (LOW)
- The list API (`/api/products`) only returns available colors (filters `is_available=true`)
- Color swatches on ProductCard only show available colors, which is technically correct
- However, if a color has SOME sizes available and SOME not, the swatch still shows as fully available
- This is acceptable at the card level -- detail-level cross-filtering handles it

#### GAP-5: Cart Does Not Re-validate On Load (LOW-MEDIUM)
**File**: `frontend/src/hooks/useCart.tsx`
- Cart refreshes on mount and when user changes
- The cart GET API checks product `status !== 'active'` and marks items as `unavailable: true`
- **However**: the cart GET does NOT check `is_available` on the variant level -- it only checks product status
- A product that is active but whose specific variant became unavailable will still appear "available" in the cart
- The `unavailable` flag on cart items is ONLY set when the product itself is deleted/archived, not when the variant goes OOS
- **Impact**: User sees a valid-looking cart item, proceeds to checkout, and gets a 409 error
- **Fix**: In `GET /api/cart`, also check `product_variants.is_available` for each cart item's `variant_id`

#### GAP-6: Cart Unavailable Items Not Auto-Removed or Clearly Warned (LOW)
**File**: `frontend/src/components/cart/CartView.tsx`
- Cart shows a red "Unavailable" badge on items where `item.unavailable === true`
- But: the checkout button is NOT disabled when unavailable items exist
- The `cartTotal` calculation filters unavailable items (`availableItems` filter), but the user can still click "Proceed to Checkout" with unavailable items in the cart
- Checkout create-session will reject with 409, which is handled with a toast
- **Impact**: Confusing UX -- user sees unavailable badge but can still attempt checkout, only to be rejected

#### GAP-7: DynamicPriceStock is a Dead Stub (INFORMATIONAL)
**File**: `frontend/src/components/products/DynamicPriceStock.tsx`
- Contains `inStock = true` hardcoded
- Not imported anywhere
- Appears to be a PPR experiment that was never completed
- No impact since it's unused

#### GAP-8: No Real-Time Stock Check Before Add-to-Cart on PDP (LOW)
- The PDP loads variant availability data at page render time (ISR cached)
- Between page load and the user clicking "Add to Cart", stock could change
- The cart API validates server-side, so the worst case is an error toast
- No pre-flight availability check (e.g., SWR polling or fetch before submit)
- **Impact**: Acceptable for POD (stock changes are rare), but could cause confusion during high-demand periods

---

## 8. Product Status Lifecycle

### Status Values

```sql
CHECK (status IN ('draft', 'active', 'archived'))
```

| Status | Visibility | Cart Behavior | Checkout Behavior |
|--------|-----------|---------------|-------------------|
| `draft` | NOT shown in shop (filtered by `status='active'`) | Cannot add (product not found) | Cannot purchase |
| `active` | Shown in shop | Can add if has available variants | Can purchase if variants available |
| `archived` | NOT shown in shop | Cannot add (product not found) | Cannot purchase |

### Soft Delete

Products have a `deleted_at` column. All queries filter `deleted_at IS NULL`. A soft-deleted product is effectively invisible everywhere.

### Status Transitions

- Provider sync sets status to `'active'` if product is visible at provider, `'draft'` otherwise
- No admin UI for status transitions found in frontend code (admin panel is separate)
- Products already in cart when archived: marked as `unavailable: true` by cart GET API (checks `status !== 'active'`)

### What Happens to Products with 0 Available Variants?

- List API: `inStock: variantsMap.has(p.id)` returns `false` -- product shows with out-of-stock overlay
- Detail API: `inStock: variants.length > 0` returns `false` -- shows "Out of Stock" badge, CTAs disabled
- The product still appears in the shop (it's `status='active'`), just marked as out-of-stock
- **This is correct behavior** -- the product remains discoverable but unpurchasable

---

## 9. Scorecard

| Area | Rating | Notes |
|------|--------|-------|
| **Product List Display** | GOOD | Proper inStock flag, out-of-stock overlay, disabled button |
| **PDP Variant Selector** | EXCELLENT | Cross-filtering, unavailable dimming, auto-reset, per-variant pricing |
| **QuickView Modal** | POOR | No availability filtering, no inStock check on CTA |
| **Cart Variant Editing** | GOOD | Shows only available options, server validation |
| **Add-to-Cart Validation** | EXCELLENT | Three checks: product active, variant enabled+available, auto-select |
| **Checkout Validation** | EXCELLENT | Re-validates all products and variants, 409 with item details |
| **Stock Webhook Handling** | GOOD | Updates is_available per variant via external_variant_id |
| **Cache Invalidation** | POOR | ISR up to 1 hour stale, Redis not invalidated on stock change |
| **Back-in-Stock Notifications** | MISSING | No feature exists |
| **Cart Staleness Detection** | MEDIOCRE | Checks product status but not variant availability |

**Overall**: 7/10 -- The core availability chain (PDP -> Cart -> Checkout) is solid with proper server-side validation at every step. The main gaps are in peripheral surfaces (QuickView, cache staleness) and missing engagement features (back-in-stock notifications).

---

## 10. Recommendations

### Quick Wins (High Impact, Low Effort)

1. **Fix QuickViewModal availability** -- Add `disabled={product.inStock === false}` to the Add to Cart button. Pass `inStock` check. This is a one-line fix.

2. **Cart variant-level availability check** -- In `GET /api/cart`, join `product_variants` on `variant_id` and check `is_available`. Set `unavailable: true` on cart items where the specific variant is no longer available, not just the product.

3. **Disable checkout when unavailable items exist** -- In CheckoutView, disable the "Proceed to Payment" button when any cart item has `unavailable === true`, with a message prompting removal.

### Medium-Term Improvements

4. **On-demand ISR revalidation on stock change** -- In `stock-updated.ts` handler, call `revalidatePath` / `revalidateTag` for the affected product's PDP and shop pages. Also invalidate Redis product detail cache.

5. **Pre-flight availability check on PDP** -- Before addToCart, make a lightweight fetch to `/api/products/[id]/availability` (new endpoint) to verify the selected variant is still available. Show inline error instead of toast.

6. **QuickView unavailable combinations** -- Fetch detail-level data (including `unavailableCombinations`) when QuickView opens, or at minimum pass the card's available sizes/colors as `availableSizes`/`availableColors` to the VariantSelector.

### Strategic Features

7. **Back-in-stock notification** -- Add an email subscription form on the PDP when a product/variant is out of stock. Store in a `stock_notifications` table. Trigger email from `stock-updated.ts` when variant becomes available again.

8. **Low-stock urgency indicator** -- For high-demand products, show "Only X sizes left" or "Limited availability" on the PDP and card. This requires tracking which sizes/colors are close to going unavailable (would need stock level data from provider).

9. **Cart staleness auto-refresh** -- When the cart page or checkout page loads, automatically re-validate all items against current stock and remove/flag stale items before the user interacts. Currently, staleness is only caught at checkout session creation.

---

## Appendix: Component Interaction Diagram

```
                    Shop Page (SSR, ISR 5min)
                           |
                    ShopPageClient
                           |
                    ProductGrid
                           |
                    ProductCard
                    /         \
           Color Swatches    Add to Cart
           (colorImages)     (opens detail if multi-variant)
                    |              |
                    v              v
            ProductDetailClient   QuickViewModal
            (ISR 1hr + Redis)     (card-level data only)
                    |                     |
            Cross-filter selectors   VariantSelector (no avail filter!)
            (allColors, allSizes,         |
             unavailableCombinations)      |
                    |                     |
                    v                     v
              addToCart()  ------->  POST /api/cart
                                       |
                                  Validates:
                                  - product active
                                  - variant enabled+available
                                  - auto-select single variant
                                       |
                                       v
                                  GET /api/cart
                                  (marks unavailable if product archived)
                                       |
                                       v
                                  CartView
                                  (variant editing, unavailable badge)
                                       |
                                       v
                                  CheckoutView
                                       |
                                  POST /api/checkout/create-session
                                       |
                                  Re-validates:
                                  - all products active
                                  - all variants is_available
                                  - server-side price authority
                                       |
                                  409 if unavailable -> toast
                                  200 -> Stripe redirect
```
