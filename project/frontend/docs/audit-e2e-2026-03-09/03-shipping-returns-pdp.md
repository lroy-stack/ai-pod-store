# Audit: Shipping & Returns Display on Product Detail Page (PDP)

**Date:** 2026-03-09
**Scope:** Shipping conditions and return policy visibility on every product page
**Status:** RESEARCH ONLY -- no code changes

---

## 1. Current PDP Anatomy

**File:** `frontend/src/components/products/ProductDetailClient.tsx` (959 lines)

The PDP is a two-column layout (`grid-cols-1 lg:grid-cols-2 gap-8`) with these sections in order:

| # | Section | Lines | Notes |
|---|---------|-------|-------|
| 0 | Breadcrumb | 376-404 | Home > Shop > Category > Product |
| 1 | Image gallery (left col) | 408-516 | Embla carousel + thumbnails, zoom dialog |
| 2 | Title + Rating + Wishlist/Share | 522-554 | SocialProofIndicator below |
| -- | Separator | 556 | |
| 3 | Color selector | 559-598 | Visual image-based swatches |
| 4 | Size selector | 601-634 | Button-based, with SizeGuide link |
| -- | Separator | 636 | |
| 5 | Price + Stock + Shipping one-liner | 639-665 | **Only shipping info on PDP** |
| 6 | Specifications (collapsible) | 669-713 | Materials, care, print technique, made in |
| 7 | GPSR Safety (collapsible) | 717-729 | EU safety information |
| -- | Separator | 731 | |
| 8 | Quantity selector | 734-760 | Select 1-10 |
| 9 | CTAs (Add to Cart / Buy Now / Design) | 763-803 | Stacked full-width buttons |
| 10 | Description (collapsible, open by default) | 806-814 | |
| -- | Separator | 819 | |
| 11 | Reviews | 821-890 | Star ratings, review form |
| -- | Separator | 895 | |
| 12 | Customers Also Bought | 893-906 | Related products grid |
| -- | Separator | 911 | |
| 13 | Recently Viewed | 909-936 | From localStorage |
| 14 | SmartStickyCTA (mobile) | 939-955 | Fixed bottom bar on scroll |

### Current Shipping Display (Section 5, lines 659-664)

```tsx
<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
  <Truck className="h-4 w-4 shrink-0" />
  <span>
    {locale === 'es' ? 'Envio gratuito +50 €' : locale === 'de' ? 'Gratis ab 50 €' : 'Free shipping over €50'}
  </span>
</div>
```

**Problems identified:**
1. **Hardcoded text** -- not using i18n system, inline ternary per locale
2. **Hardcoded threshold** -- `€50` instead of reading `STORE_DEFAULTS.freeShippingThreshold`
3. **No delivery time estimate** -- does not show "3-5 business days" or similar
4. **No shipping cost shown** -- does not show what non-free shipping costs
5. **No link** to full shipping policy page
6. **Not a section** -- just a small badge next to the stock indicator

### Current Return Policy Display

**NONE.** There is zero return policy information on the PDP. No text, no link, no icon.

---

## 2. Shipping Data Availability

### A. Static Configuration -- `store-config.ts`

**File:** `frontend/src/lib/store-config.ts`

```typescript
STORE_DEFAULTS.freeShippingThreshold = 50  // EUR
ALLOWED_SHIPPING_COUNTRIES = ['DE','FR','ES','IT','NL','BE','AT','PT','IE','GB','US','CA']

SHIPPING_RATES = {
  DE: [{ method: 'Standard', price: 3.99, days: '3-5 business days' },
       { method: 'Express', price: 9.99, days: '1-2 business days' }],
  ES: [{ method: 'Standard', price: 4.99, days: '4-6 business days' },
       { method: 'Express', price: 11.99, days: '2-3 business days' }],
  FR: [{ method: 'Standard', price: 4.99, days: '3-5 business days' },
       { method: 'Express', price: 11.99, days: '2-3 business days' }],
  EU: [{ method: 'Standard', price: 5.99, days: '5-8 business days' },
       { method: 'Express', price: 14.99, days: '2-4 business days' }],
  GB: [{ method: 'Standard', price: 6.99, days: '5-7 business days' },
       { method: 'Express', price: 14.99, days: '3-5 business days' }],
  US: [{ method: 'Standard', price: 12.99, days: '10-14 business days' },
       { method: 'Express', price: 24.99, days: '5-7 business days' }],
}
```

This data is available client-side (no API call needed) and can be imported directly.

### B. Database -- `shipping_zones` table

**Migration:** `supabase/migrations/20260214012834_add_shipping_zones.sql`

Schema: `id, country_code, zip_pattern, state_code, base_rate, per_item_rate, free_shipping_threshold, estimated_days_min, estimated_days_max, active`

Seeded with US/CA/GB/DE/FR/ES/IT/AU/JP zones. Free shipping threshold aligned to 50 EUR across all zones (migration `20260301200000`).

### C. Shipping Estimate API

**File:** `frontend/src/app/api/cart/shipping-estimate/route.ts`

`POST /api/cart/shipping-estimate` -- accepts `{ zipCode, countryCode, cartTotal, itemCount }`, returns calculated shipping cost with estimated delivery days. Used in the cart/checkout flow but NOT on the PDP.

### D. Locale-to-Country Mapping

**File:** `store-config.ts` lines 24-28

```typescript
LOCALE_COUNTRY = { en: 'IE', es: 'ES', de: 'DE' }
```

This can be used on the PDP to show locale-appropriate shipping estimates without user input.

---

## 3. Return Policy Data Availability

### A. Dedicated Returns Page

**File:** `frontend/src/app/[locale]/(focused)/returns/page.tsx`

- Route: `/{locale}/returns`
- Fetches content from `legal_pages` table where `slug = 'returns'`
- Supports en/es/de with locale-specific title/content columns
- Content rendered as Markdown via `SafeMarkdown`

### B. FAQ Content

**File:** `messages/en.json` (FAQ section)

Key return policy facts from FAQ answers:
- **q15/a15:** "We accept returns within 30 days of delivery for items that are defective or significantly different from the preview. Since products are custom-made, we cannot accept returns for change of mind."
- **q16/a16:** "Go to your order history, select the order, and click 'Request Return'. Describe the issue and upload photos if applicable."
- **q18/a18:** "Once approved, refunds are processed within 5-10 business days."
- **q7/a7:** "If your order arrives damaged, contact us within 30 days with photos of the damage."

### C. Trust Signal Texts

| Location | Key | EN text |
|----------|-----|---------|
| Landing page TrustBar | `landing.trustReturns` | "14-day returns" |
| Checkout trust badges | `checkout.trustReturns` | "30-day returns" |

**INCONSISTENCY:** Landing page says 14-day returns, checkout and FAQ say 30-day returns. This must be resolved.

### D. Return Request System

Fully implemented in backend:
- `POST /api/orders/[id]/returns` -- submit return request
- `GET/PATCH /api/admin/returns/[id]` -- admin management
- `GET /api/admin/returns` -- admin list
- `GET /api/returns/[id]/tracking` -- return tracking
- OrderDetailView has "Request Return" button

---

## 4. DetailPanel (Chat Interface)

**File:** `frontend/src/components/storefront/DetailPanel.tsx`

The chat-side ProductView (lines 221-487) shows:
- Image gallery
- Title, rating, price
- Description
- Specifications (materials, print technique, made in, care instructions, safety info)
- Variant selectors
- Quantity selector
- Add to Cart / Design / Wishlist buttons

**No shipping info.** No return policy. No trust signals.

### ProductDetailArtifact (Chat Cards)

**File:** `frontend/src/components/artifacts/ProductDetailArtifact/ProductDetailArtifact.tsx`

Has a `shippingInfo?: string` field in its interface (line 45), and renders it at lines 230-239 if present:

```tsx
{product.shippingInfo && (
  <div>
    <h3>...<Package />Shipping</h3>
    <p>{product.shippingInfo}</p>
  </div>
)}
```

But this data is never populated from the product API -- it relies on the AI chat tool explicitly setting it.

---

## 5. Trust Signal Components

### TrustBar (Landing + Shop)

**File:** `frontend/src/components/landing/TrustBar.tsx`

4 items in a horizontal grid:
1. Shield -- "Made in Europe" (`trustMadeInEU`)
2. RefreshCw -- "14-day returns" (`trustReturns`) **<-- inconsistent**
3. Lock -- "Secure checkout" (`trustSecure`)
4. Truck -- "Worldwide shipping" (`trustShipping`)

Used on: Landing page (`LandingPageClient.tsx`), Shop grid page (`ShopPageClient.tsx`)

### Checkout Trust Badges

**File:** `frontend/src/components/checkout/CheckoutView.tsx` lines 527-543

Inline flex row with icon + text: "Worldwide shipping", "30-day returns" (links to `/returns`), "Secure checkout".

### What's Missing on PDP

The PDP has NONE of:
- TrustBar component
- Shipping accordion/section
- Returns accordion/section
- Link to shipping policy page
- Link to returns policy page
- Estimated delivery time
- Country-specific shipping cost

---

## 6. Existing UI Components Available for Implementation

| Component | File | Notes |
|-----------|------|-------|
| `Accordion` | `src/components/ui/accordion.tsx` | shadcn/ui, Radix-based, already installed |
| `AccordionItem/Trigger/Content` | Same file | Full set available |
| `FAQAccordion` | `src/components/faq/FAQAccordion.tsx` | Pattern reference |
| `<details>` collapsibles | Already used on PDP | Specifications + GPSR use native `<details>` |
| `Truck` icon | Already imported in PDP | Line 9 |
| `SHIPPING_RATES` | `store-config.ts` | Client-importable |
| `STORE_DEFAULTS.freeShippingThreshold` | `store-config.ts` | Client-importable |
| `LOCALE_COUNTRY` | `store-config.ts` | Maps locale to default country |

---

## 7. i18n Analysis

### Existing Keys Relevant to PDP Shipping/Returns

| Namespace | Key | EN Value |
|-----------|-----|----------|
| `checkout` | `trustShipping` | "Worldwide shipping" |
| `checkout` | `trustReturns` | "30-day returns" |
| `checkout` | `trustSecure` | "Secure checkout" |
| `landing` | `trustMadeInEU` | "Made in Europe" |
| `landing` | `trustReturns` | "14-day returns" **<-- WRONG** |
| `landing` | `trustShipping` | "Worldwide shipping" |
| `landing` | `freeShippingBanner` | "Free shipping on orders over EUR {threshold}" |
| `cart` | `freeShippingOver` | "Free shipping on orders over" |
| `footer` | `shipping` | "Shipping Policy" |
| `footer` | `returns` | "Returns & Refunds" |

### New i18n Keys Needed for PDP

```json
{
  "product": {
    "shippingAndDelivery": "Shipping & Delivery",
    "returnsAndRefunds": "Returns & Refunds",
    "freeShippingOver": "Free shipping on orders over {threshold}",
    "standardShipping": "Standard shipping",
    "expressShipping": "Express shipping",
    "estimatedDelivery": "Estimated delivery: {days}",
    "shippingFrom": "From {price}",
    "viewShippingPolicy": "View full shipping policy",
    "viewReturnsPolicy": "View full returns policy",
    "returnWindow": "{days}-day returns for defective items",
    "customMadeNote": "Custom-made items: no change-of-mind returns",
    "refundProcessing": "Refunds processed within 5-10 business days",
    "madeInEurope": "Made in Europe",
    "secureCheckout": "Secure checkout"
  }
}
```

These need translations for all 3 locales (en, es, de).

---

## 8. Recommended UX Pattern

### Pattern: Accordion Sections Below CTAs

Based on competitive analysis of premium streetwear sites (Stussy, Palace, Fear of God), the recommended pattern is **collapsible accordion sections** placed after the CTA buttons and before the reviews section.

### Proposed PDP Layout (Right Column)

```
[1] Title + Rating + Wishlist/Share
[2] Color selector
[3] Size selector
[---] Separator
[4] Price + Stock badge
[5] Quantity selector
[6] CTAs (Add to Cart / Buy Now / Design)

[===] TRUST BAR (new) ← inline icons row
  🚚 Free shipping over €50  |  🔄 30-day returns  |  🛡 Secure checkout  |  🇪🇺 Made in EU

[7] ACCORDION GROUP (new) ← shadcn Accordion, "multiple" type
  ▼ Description .......... (open by default)
     Product description text

  ▼ Specifications ....... (collapsed)
     Materials, care, print technique, made in, GPSR

  ▼ Shipping & Delivery .. (collapsed)
     🚚 Free shipping on orders over €50
     📦 Standard: €3.99 — 3-5 business days (DE)
     ⚡ Express: €9.99 — 1-2 business days (DE)
     🔗 View full shipping policy →

  ▼ Returns & Refunds .... (collapsed)
     🔄 30-day return window for defective items
     ⚠️ Custom-made: no change-of-mind returns
     💰 Refunds processed within 5-10 business days
     🔗 View full returns policy →

[---] Separator
[8] Reviews section
```

### Trust Bar Mini (Inline Icons)

A compact horizontal row of 4 trust signals placed immediately after the CTA buttons, before the accordion group. Similar to the existing TrustBar but smaller/denser for PDP context:

```tsx
<div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-xs text-muted-foreground">
  <div className="flex items-center gap-1.5">
    <Truck className="size-3.5" />
    <span>Free shipping over €50</span>
  </div>
  <div className="flex items-center gap-1.5">
    <RefreshCw className="size-3.5" />
    <span>30-day returns</span>
  </div>
  <div className="flex items-center gap-1.5">
    <Lock className="size-3.5" />
    <span>Secure checkout</span>
  </div>
  <div className="flex items-center gap-1.5">
    <Shield className="size-3.5" />
    <span>Made in EU</span>
  </div>
</div>
```

---

## 9. Implementation Approach

### Phase 1: Fix Existing Issues (Quick Wins)

1. **Fix hardcoded shipping text** (line 662) -- replace inline ternary with i18n key and `STORE_DEFAULTS.freeShippingThreshold`
2. **Fix trust signal inconsistency** -- change `landing.trustReturns` from "14-day returns" to "30-day returns" in all 3 locale files
3. **Add i18n keys** for shipping/returns sections to `messages/{en,es,de}.json`

### Phase 2: Add PDP Trust Bar + Accordion Sections

**Files to modify:**
- `frontend/src/components/products/ProductDetailClient.tsx` -- restructure right column
- `frontend/messages/en.json`, `es.json`, `de.json` -- new keys

**Steps:**

1. Create `ShippingReturnsAccordion` component (or inline in PDP):
   - Import `Accordion, AccordionItem, AccordionTrigger, AccordionContent` from `@/components/ui/accordion`
   - Import `SHIPPING_RATES, STORE_DEFAULTS, LOCALE_COUNTRY` from `@/lib/store-config`
   - Determine user's locale country from `useLocale()` + `LOCALE_COUNTRY` mapping
   - Look up shipping rates for that country (fallback to `EU` zone)
   - Render shipping rates with estimated delivery days
   - Render return policy summary with link to full policy
   - Both sections as `AccordionItem` entries

2. Move existing Description and Specifications into the same Accordion group:
   - Convert from `<details>` to `<AccordionItem>`
   - Description default open
   - Specifications collapsed

3. Add inline trust bar between CTAs and accordion group

4. Remove the old hardcoded shipping one-liner from section 5

### Phase 3: Enhance DetailPanel (Chat)

**File to modify:** `frontend/src/components/storefront/DetailPanel.tsx`

Add a compact shipping/returns summary below the specifications in the `ProductView` component. Simpler version (no accordion, just icon + text rows) since panel is narrower.

### Phase 4: SmartStickyCTA Enhancement (Optional)

Consider adding a small "Free shipping" badge to the mobile sticky CTA bar when cart total is approaching the threshold.

---

## 10. Key Data Inconsistencies to Fix

| Issue | Location | Current | Should Be |
|-------|----------|---------|-----------|
| Return window | `messages/en.json` landing.trustReturns | "14-day returns" | "30-day returns" |
| Return window | `messages/es.json` landing.trustReturns | "Devoluciones en 30 dias" | OK (correct) |
| Return window | `messages/de.json` landing.trustReturns | "30 Tage Ruckgabe" | OK (correct) |
| Shipping text | PDP line 662 | Hardcoded per locale | Use i18n + STORE_DEFAULTS |
| DB shipping threshold | Some zones | Was 75, migrated to 50 | Aligned (OK after migration) |
| Shipping rates in DB | shipping_zones | US rates differ from SHIPPING_RATES | Dual source of truth -- DB used for cart estimate, SHIPPING_RATES for display. Should consolidate |

---

## 11. File Reference Summary

| File | Role | Lines of Interest |
|------|------|-------------------|
| `src/components/products/ProductDetailClient.tsx` | Main PDP | 659-664 (shipping one-liner) |
| `src/components/storefront/DetailPanel.tsx` | Chat product panel | 316-487 (no shipping/returns) |
| `src/components/products/SmartStickyCTA.tsx` | Mobile sticky bar | No shipping info |
| `src/components/products/ProductSpecifications.tsx` | Spec display | Reusable sub-component |
| `src/components/landing/TrustBar.tsx` | Trust signals | Landing/shop only |
| `src/components/checkout/CheckoutView.tsx` | Checkout trust | Lines 527-543 |
| `src/components/ui/accordion.tsx` | shadcn accordion | Ready to use |
| `src/components/faq/FAQAccordion.tsx` | Accordion pattern ref | Wrapped Accordion usage |
| `src/lib/store-config.ts` | Shipping config | Lines 67-92 (SHIPPING_RATES) |
| `src/app/api/cart/shipping-estimate/route.ts` | Shipping API | DB-based estimation |
| `src/app/[locale]/(focused)/returns/page.tsx` | Returns policy page | Fetches from legal_pages |
| `src/app/[locale]/(focused)/shipping/page.tsx` | Shipping policy page | Fetches from legal_pages |
| `messages/en.json` | i18n EN | Missing PDP shipping/returns keys |
| `messages/es.json` | i18n ES | Missing PDP shipping/returns keys |
| `messages/de.json` | i18n DE | Missing PDP shipping/returns keys |
| `supabase/migrations/20260214012834_add_shipping_zones.sql` | DB schema | shipping_zones table |
| `supabase/migrations/20260301200000_align_shipping_threshold.sql` | Threshold fix | Aligned to 50 EUR |
