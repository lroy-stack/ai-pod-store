# SKAPARA Mobile UX Audit -- 2026-03-07

## Executive Summary

**Overall Mobile Readiness: 7.5/10 -- Good foundation with targeted gaps**

The SKAPARA storefront has a solid mobile-first architecture. The StorefrontLayout correctly uses `h-dvh` for viewport handling, the sidebar collapses to a `Sheet` drawer on mobile, and a `SmartStickyCTA` appears on product detail pages when the main CTA scrolls out of view. Key gaps: missing viewport meta tag (relies on Next.js default), several undersized touch targets (below 44x44px), no swipe gesture support on image galleries, missing `inputMode`/`type` attributes on several form inputs, and the checkout order summary is not sticky on mobile. The pagination component renders all page numbers without truncation, which can overflow on narrow screens.

**Critical findings: 3 | High: 7 | Medium: 9 | Low: 6**

---

## Findings

### 1. Responsive Layout

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| MUX-01 | `neu-grid` uses CSS `auto-fill` with `minmax(200px, 1fr)` -- adapts well from 1 to N columns without breakpoint classes. Correctly responsive. | OK | `src/app/globals.css:239-243` | -- |
| MUX-02 | Landing hero uses `min-h-dvh` and `px-6` base padding -- good mobile spacing. Typography scales: `text-4xl md:text-5xl lg:text-6xl`. | OK | `src/components/landing/LandingPageClient.tsx:130` | -- |
| MUX-03 | Shop page title is `text-4xl` on all viewports with no mobile override -- 36px is quite large on 375px width, consuming significant vertical space. | MEDIUM | `src/components/shop/ShopPageClient.tsx:196` | Use `text-2xl md:text-4xl` to scale title on mobile. Same issue in `ShopCategoryLanding.tsx:48`. |
| MUX-04 | Checkout grid uses `grid-cols-1 lg:grid-cols-3` -- proper single-column on mobile stacking. | OK | `src/components/checkout/CheckoutView.tsx:357` | -- |
| MUX-05 | Cart grid uses `grid-cols-1 lg:grid-cols-3` -- correct stacking. | OK | `src/components/cart/CartView.tsx:274` | -- |
| MUX-06 | Product detail page uses `grid-cols-1 lg:grid-cols-2` -- images stack above info on mobile. Correct. | OK | `src/components/products/ProductDetailClient.tsx:353` | -- |
| MUX-07 | Pagination renders ALL page numbers without truncation or ellipsis. With 10+ pages, buttons overflow horizontally on mobile (375px). | HIGH | `src/components/shop/ShopPageClient.tsx:350-365` | Implement ellipsis pagination (show first, last, and 2 neighbors of current page). Wrap in `overflow-x-auto` as fallback. |
| MUX-08 | `container mx-auto` used across pages but without explicit `max-w-7xl` on some pages (orders, wishlist use it inconsistently with `container mx-auto px-4` vs `max-w-7xl mx-auto`). | LOW | Multiple files | Standardize to `container mx-auto max-w-7xl px-4`. |
| MUX-09 | Recently viewed section in `ShopCategoryLanding.tsx` uses `grid-cols-2 md:grid-cols-4` -- good mobile grid for 2 columns. | OK | `src/components/shop/ShopCategoryLanding.tsx:90` | -- |

### 2. Navigation

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| MUX-10 | Mobile sidebar uses `Sheet` component with `side="left"` and `w-60`. Correctly hidden on mobile with `lg:hidden` toggle. Has `SheetTitle` with `sr-only` for accessibility. | OK | `src/components/storefront/StorefrontLayout.tsx:95-100` | -- |
| MUX-11 | Mobile search opens a full-screen overlay (`fixed inset-0 z-50`) with backdrop blur. Search input gets `autoFocus`. Good pattern. | OK | `src/components/storefront/StorefrontHeader.tsx:278-311` | -- |
| MUX-12 | **No bottom navigation bar** for key mobile actions (shop, cart, chat). Users must use sidebar hamburger or scroll to header. E-commerce best practice is a persistent bottom tab bar on mobile. | HIGH | `src/components/storefront/StorefrontLayout.tsx` | Add a mobile-only bottom navigation bar (`md:hidden`) with 4-5 key actions (Chat, Shop, Cart, Profile). This is the single highest-impact mobile UX improvement. |
| MUX-13 | Notification bell is hidden on mobile (`hidden sm:inline-flex`). Notifications are inaccessible on screens < 640px. | MEDIUM | `src/components/storefront/StorefrontHeader.tsx:174` | Show notification bell on mobile, or include in bottom nav/sidebar. |
| MUX-14 | Language switcher is hidden on mobile (`hidden sm:inline-flex`). Users on small screens cannot change locale from the header. | MEDIUM | `src/components/storefront/StorefrontHeader.tsx:213` | Move locale switcher to sidebar navigation (already accessible via Sheet) or show in mobile profile dropdown. |
| MUX-15 | Cart icon with badge is always visible -- good. Badge uses `aria-live="polite"` for screen readers. | OK | `src/components/storefront/StorefrontHeader.tsx:190-205` | -- |
| MUX-16 | Breadcrumbs present on shop, product detail, and checkout pages -- good for orientation. | OK | Multiple files | -- |
| MUX-17 | Chat and Shop nav links are `hidden md:flex` in header -- only accessible via sidebar on mobile, which requires opening the hamburger menu. | MEDIUM | `src/components/storefront/StorefrontHeader.tsx:119` | These key nav links should be in a bottom nav bar (see MUX-12). |

### 3. Touch Targets

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| MUX-18 | Color variant swatches on ProductCard are `w-6 h-6` (24x24px) -- significantly below the 44x44px minimum touch target. | CRITICAL | `src/components/products/ProductCard.tsx:144` | Increase to at least `w-8 h-8` (32px) with additional padding to reach 44px effective area. Or use `p-1` wrapper around swatch. |
| MUX-19 | SmartStickyCTA color dots are `size-5` (20x20px) -- far below minimum touch target. | CRITICAL | `src/components/products/SmartStickyCTA.tsx:94` | Increase to `size-8` (32px) minimum. Since this is a sticky mobile bar, touch targets are critical. |
| MUX-20 | SmartStickyCTA quantity buttons are `size-7` (28x28px) -- below 44px minimum. | HIGH | `src/components/products/SmartStickyCTA.tsx:115,126` | Increase to `size-9` or `size-10` for comfortable mobile tapping. |
| MUX-21 | Cart quantity buttons (`size-8` = 32px) are below the 44px minimum but functional with spacing. | MEDIUM | `src/components/cart/CartView.tsx:402,412` | Consider increasing to `size-10` (40px) for better touch UX. |
| MUX-22 | Sidebar navigation links have `px-3 py-2` padding -- effective height ~36px. Slightly below 44px. | LOW | `src/components/storefront/StorefrontSidebar.tsx:173` | Increase to `py-2.5` or `py-3` for 44px minimum tap area. |
| MUX-23 | ProductCard wishlist heart button is `h-8 w-8` (32px). Close but below 44px. | MEDIUM | `src/components/products/ProductCard.tsx:170` | Increase to `h-10 w-10` or add padding. |
| MUX-24 | ProductCard add-to-cart and quick-view buttons are `h-8 w-8` (32px). | MEDIUM | `src/components/products/ProductCard.tsx:247,256` | Increase to `h-10 w-10` for mobile. |
| MUX-25 | Checkout breadcrumb step indicators are `size-10` (40px) -- acceptable. Step connector lines hidden on mobile. | OK | `src/components/checkout/CheckoutBreadcrumb.tsx:32` | -- |
| MUX-26 | Product detail action buttons (Add to Cart, Design, Wishlist, Share) are `size="lg"` -- good large touch targets. | OK | `src/components/products/ProductDetailClient.tsx:605-648` | -- |
| MUX-27 | Wishlist banner dismiss button uses bare `<button>` with `h-3.5 w-3.5` icon -- effectively ~14px touch area. | CRITICAL | `src/app/[locale]/(app)/wishlist/page.tsx:248-250` | Replace with `<Button variant="ghost" size="icon">` at minimum `size-8`. |

### 4. Forms on Mobile

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| MUX-28 | Login form uses `type="email"` and `autoComplete="email"` / `autoComplete="current-password"` -- correct keyboard and autofill. | OK | `src/components/auth/LoginForm.tsx:201-231` | -- |
| MUX-29 | Register form uses `autoComplete="name"`, `autoComplete="email"`, `autoComplete="new-password"` -- correct. | OK | `src/components/auth/RegisterForm.tsx:191-264` | -- |
| MUX-30 | Login submit button is `w-full` -- correct full-width on mobile. | OK | `src/components/auth/LoginForm.tsx:283` | -- |
| MUX-31 | Address form fields are single column on mobile (`grid-cols-1 md:grid-cols-2`) -- correct. | OK | `src/components/checkout/AddressForm.tsx:193,228` | -- |
| MUX-32 | Address form phone field lacks `type="tel"` attribute -- plain text input instead of phone keyboard on mobile. | HIGH | `src/components/checkout/AddressForm.tsx:267` | Add `type="tel"` to phone input. Note: the profile `AddressForm` (different file) correctly has `type="tel"` at line 196. |
| MUX-33 | Address form postal code input lacks `inputMode="numeric"` -- text keyboard shown instead of numeric. | MEDIUM | `src/components/checkout/AddressForm.tsx:233` | Add `inputMode="numeric"` or `type="text" inputMode="numeric"` for EU postal codes (mix of letters/numbers in UK/NL). |
| MUX-34 | Guest email input in checkout has `type="email"` -- correct. | OK | `src/components/checkout/CheckoutView.tsx:483` | -- |
| MUX-35 | Cart coupon code input uses `type="text"` -- acceptable. Zip code input also `type="text"` -- should be `inputMode="numeric"` for most locales. | LOW | `src/components/cart/CartView.tsx:464,512` | Add `inputMode="numeric"` to zip code input. |
| MUX-36 | Error messages appear inline below fields (`text-sm text-destructive`) -- visible without scrolling in most cases. | OK | Multiple auth/checkout forms | -- |
| MUX-37 | Checkout submit button is `w-full size="lg"` -- correct. | OK | `src/components/checkout/CheckoutView.tsx:705-712` | -- |

### 5. Images & Media

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| MUX-38 | ProductCard images use `next/image` with `sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"` -- correct responsive sizing. | OK | `src/components/products/ProductCard.tsx:114` | -- |
| MUX-39 | Landing carousel images use proper `sizes` and `priority` for first 3 images. | OK | `src/components/landing/LandingPageClient.tsx:233-234` | -- |
| MUX-40 | Product detail main image uses `sizes="(max-width: 1024px) 100vw, 50vw"` with `priority` -- correct. | OK | `src/components/products/ProductDetailClient.tsx:363` | -- |
| MUX-41 | Product detail thumbnails use `grid-cols-4 gap-4` -- no horizontal scroll. With many images (8+), this creates multiple rows which is fine on mobile. | OK | `src/components/products/ProductDetailClient.tsx:375` | -- |
| MUX-42 | **No swipe gesture support** on product detail image gallery. Users must tap thumbnails to change images. | HIGH | `src/components/products/ProductDetailClient.tsx:354-398` | Integrate `embla-carousel` (already a dependency, used in landing) for swipeable image gallery on mobile. This is a standard e-commerce expectation. |
| MUX-43 | Landing product carousel uses `embla-carousel` with `Autoplay` -- supports native swipe on mobile. `CarouselPrevious`/`CarouselNext` correctly hidden on mobile (`hidden md:flex`). | OK | `src/components/landing/LandingPageClient.tsx:212-284` | -- |
| MUX-44 | Checkout cart item images lack `sizes` prop on `next/image`. | LOW | `src/components/checkout/CheckoutView.tsx:593` | Add `sizes="80px"` to prevent oversized image downloads on mobile. |
| MUX-45 | Cart item images lack `sizes` prop. | LOW | `src/components/cart/CartView.tsx:290` | Add `sizes="(max-width: 768px) 96px, 128px"` matching the `size-24 md:size-32`. |

### 6. Mobile Checkout

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| MUX-46 | Checkout uses single-column layout on mobile (`grid-cols-1 lg:grid-cols-3`) -- correct. | OK | `src/components/checkout/CheckoutView.tsx:357` | -- |
| MUX-47 | Order summary card has `sticky top-4` on desktop but this only works inside the `lg:col-span-1` column. On mobile (single column), the summary scrolls off screen -- no sticky CTA. | HIGH | `src/components/checkout/CheckoutView.tsx:572` | Add a mobile-only sticky "Proceed to Payment" bar at the bottom of the viewport (similar to `SmartStickyCTA` pattern). Currently users must scroll past all content to find the payment button. |
| MUX-48 | Checkout breadcrumb progress indicator is properly implemented with `nav aria-label="Checkout progress"`. Connector lines hidden on mobile. | OK | `src/components/checkout/CheckoutBreadcrumb.tsx:19-68` | -- |
| MUX-49 | Payment section clearly states redirect to Stripe -- good expectation setting. Trust badges present. | OK | `src/components/checkout/CheckoutView.tsx:506-567` | -- |
| MUX-50 | Address selection cards have `cursor-pointer` and clear visual state (`border-primary`) for selected. Touch target is the full card -- good. | OK | `src/components/checkout/CheckoutView.tsx:385-432` | -- |
| MUX-51 | Exit intent dialog uses `AlertDialog` which has proper focus trapping. | OK | `src/components/checkout/CheckoutView.tsx:719-730` | -- |

### 7. Performance on Mobile

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| MUX-52 | `next.config.ts` has `output: 'standalone'` and `splitChunks` with `maxSize: 450000` (450KB) -- good chunk splitting for mobile networks. | OK | `next.config.ts:53` | -- |
| MUX-53 | `optimizePackageImports` configured for `lucide-react`, `@ai-sdk/react`, `@supabase/supabase-js`, `react-markdown` -- good tree-shaking. | OK | `next.config.ts:33-38` | -- |
| MUX-54 | `ChatArea` dynamically imported (`next/dynamic`) with `ssr: false` and loading fallback -- correct code splitting for heavy component. | OK | `src/components/storefront/StorefrontLayout.tsx:40-50` | -- |
| MUX-55 | `WelcomePopup` dynamically imported with `ssr: false` -- correct. | OK | `src/components/storefront/StorefrontLayout.tsx:35-38` | -- |
| MUX-56 | `MetaballsBackground` (WebGL) dynamically imported with `ssr: false` -- prevents render-blocking on mobile. CSS gradient fallback renders instantly. | OK | `src/components/landing/LandingPageClient.tsx:35-38,114-119` | -- |
| MUX-57 | Skeleton loaders present in: checkout (line 283-313), orders (line 100-119), wishlist (line 193-200), shop (via `ProductCardSkeleton`). Good perceived performance. | OK | Multiple files | -- |
| MUX-58 | Service worker configured via `@serwist/next` for offline support. `manifest.json` linked. PWA-capable (`apple-mobile-web-app-capable`). | OK | `next.config.ts:12-16`, `src/app/[locale]/layout.tsx:86-91` | -- |
| MUX-59 | React Compiler enabled (`reactCompiler: true`) -- auto-memoization reduces re-renders on mobile. | OK | `next.config.ts:28` | -- |
| MUX-60 | Bundle analyzer available (`ANALYZE=true`) for ongoing monitoring. | OK | `next.config.ts:8-10` | -- |

### 8. Scroll & Viewport

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| MUX-61 | **No explicit `<meta name="viewport">` tag** in the HTML. Next.js injects one by default (`width=device-width, initial-scale=1`) via the App Router, but `maximum-scale=1` is not set -- users can pinch-zoom past intended layout on some browsers. | LOW | `src/app/[locale]/layout.tsx` | Next.js default viewport is adequate. For accessibility, do NOT add `maximum-scale=1` as it breaks pinch-to-zoom. Current behavior is correct. |
| MUX-62 | `h-dvh` used for main layout (`StorefrontLayout`) -- correctly accounts for mobile browser chrome (address bar). `min-h-dvh` used for landing and focused layouts. | OK | `src/components/storefront/StorefrontLayout.tsx:77`, `src/app/[locale]/(landing)/layout.tsx:17` | -- |
| MUX-63 | Landing page layout has `overflow-x-hidden` -- prevents horizontal scroll from hero animations/gradients. | OK | `src/app/[locale]/(landing)/layout.tsx:17` | -- |
| MUX-64 | Header is sticky via `flex` layout within `h-dvh` parent (always at top of scroll area). Height is `h-14` (56px) -- reasonable for mobile. | OK | `src/components/storefront/StorefrontHeader.tsx:89` | -- |
| MUX-65 | Mobile search overlay uses `fixed inset-0 z-50` -- correctly covers full viewport including safe areas. Backdrop click dismisses. | OK | `src/components/storefront/StorefrontHeader.tsx:279` | -- |
| MUX-66 | Detail panel mobile overlay is `fixed inset-0 z-50` with slide-in animation. However, **no close button** is immediately visible at the top of the panel -- relies on the `PanelHeader` close button which may be scrolled. | MEDIUM | `src/components/storefront/StorefrontLayout.tsx:137-139` | Ensure the close button is in a sticky header within the overlay, or add a swipe-down-to-dismiss gesture. |
| MUX-67 | `apple-mobile-web-app-status-bar-style` set to `black-translucent` -- content extends under status bar in PWA mode. Combined with `h-dvh`, this is properly handled. | OK | `src/app/[locale]/layout.tsx:90` | -- |
| MUX-68 | `theme-color` meta tags set for both light (`#fafafa`) and dark (`#0a0a0b`) modes -- browser chrome matches app theme. | OK | `src/app/[locale]/layout.tsx:87-88` | -- |

### 9. Accessibility on Mobile

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| MUX-69 | Skip-to-content link present in both `StorefrontLayout` (line 79-84) and `LandingLayout` (line 11-16) with proper `sr-only focus:not-sr-only` pattern. | OK | Multiple layout files | -- |
| MUX-70 | `Sheet` sidebar has `SheetTitle` with `sr-only` for screen readers. | OK | `src/components/storefront/StorefrontLayout.tsx:97` | -- |
| MUX-71 | Mobile search overlay backdrop (line 309) uses `onClick` on a `<div>` without keyboard accessibility. Screen reader users cannot dismiss via keyboard. | MEDIUM | `src/components/storefront/StorefrontHeader.tsx:309` | Add `role="button"`, `tabIndex={0}`, and `onKeyDown` handler for Enter/Space. Or better: use a proper `Dialog` component for the overlay. |
| MUX-72 | All icon buttons have `sr-only` spans for screen reader text (sidebar toggle, search, notifications, cart, locale). | OK | `src/components/storefront/StorefrontHeader.tsx:101,170,186,203,215` | -- |
| MUX-73 | Login form uses `aria-invalid` and `aria-describedby` for error states -- good. | OK | `src/components/auth/LoginForm.tsx:216-217` | -- |
| MUX-74 | Address form error messages lack `aria-describedby` linkage -- field errors are visually present but not programmatically associated. | LOW | `src/components/checkout/AddressForm.tsx:130-145` | Add `aria-describedby` to inputs pointing to error message IDs, matching the pattern in `LoginForm.tsx`. |
| MUX-75 | Cart quantity buttons lack meaningful `aria-label` -- screen readers announce only the icon. | LOW | `src/components/cart/CartView.tsx:399-419` | Add `aria-label="Decrease quantity"` and `aria-label="Increase quantity"`. |
| MUX-76 | Color contrast: All text uses semantic tokens (`text-foreground`, `text-muted-foreground`, `text-primary`) which are theme-controlled. The `text-[10px]` and `text-[11px]` category labels on ProductCard may be below WCAG minimum font size (12px) for readability. | MEDIUM | `src/components/products/ProductCard.tsx:188,193` | Increase category label to `text-xs` (12px minimum). The `text-[10px]` and `text-[11px]` sizes are too small for mobile. |

---

## Mobile Screenshot Checklist

The following pages should be visually tested at 375px (iPhone SE), 390px (iPhone 14), and 430px (iPhone 14 Pro Max) viewports:

| Page | Route | Key checkpoints |
|------|-------|-----------------|
| Landing | `/en` | Hero text readability, carousel swipe, CTA button size |
| Shop (categories) | `/en/shop` | Category grid layout, search bar usability |
| Shop (search) | `/en/shop?q=hoodie` | Category chips overflow, pagination overflow, product grid |
| Product Detail | `/en/shop/[id]` | Image gallery, variant selectors, sticky CTA bar |
| Cart | `/en/cart` | Item layout, quantity controls, coupon input |
| Checkout | `/en/checkout` | Address form, order summary position, payment CTA |
| Login | `/en/auth/login` | Form layout, social buttons, keyboard handling |
| Register | `/en/auth/register` | Password strength meter, terms checkbox |
| Orders | `/en/orders` | Order card layout, empty state |
| Wishlist | `/en/wishlist` | Product grid, share dialog |
| Profile | `/en/profile` | Form sections, address list |
| Pricing | `/en/pricing` | Tier cards, credit pack grid |

---

## Priority Action Items

1. **[P0] Add bottom navigation bar for mobile** (MUX-12) -- Single highest-impact improvement. Users currently must open a hamburger menu to navigate between Chat, Shop, Cart. A persistent bottom tab bar is standard for e-commerce apps and would dramatically improve mobile navigation.

2. **[P0] Fix critically undersized touch targets** (MUX-18, MUX-19, MUX-27) -- Color swatches at 24px and 20px are far below the 44px minimum. The wishlist dismiss button at ~14px is essentially untappable. These violate WCAG 2.5.8 (Target Size minimum).

3. **[P1] Add swipe gesture to product image gallery** (MUX-42) -- `embla-carousel` is already in the project dependencies (used on landing page). Wrapping the product detail image gallery in a carousel is a standard e-commerce expectation.

4. **[P1] Add sticky checkout CTA on mobile** (MUX-47) -- The "Proceed to Payment" button is buried at the bottom of a long scrollable page on mobile. A sticky bottom bar (like `SmartStickyCTA`) with the total and payment button would reduce checkout abandonment.

5. **[P1] Fix pagination overflow on mobile** (MUX-07) -- Implement truncated pagination with ellipsis for pages > 5.

6. **[P2] Add `type="tel"` to checkout phone input** (MUX-32) -- Quick fix that triggers the phone keyboard on mobile.

7. **[P2] Show notifications and locale switcher on mobile** (MUX-13, MUX-14) -- Either add to sidebar or include in a mobile-accessible location.

8. **[P2] Fix SmartStickyCTA touch targets** (MUX-20) -- Quantity buttons at 28px need to be larger for comfortable mobile tapping.

9. **[P2] Increase ProductCard button sizes** (MUX-23, MUX-24) -- Wishlist heart and cart/quick-view buttons at 32px should be 40px minimum.

10. **[P3] Scale shop page title for mobile** (MUX-03) -- Use `text-2xl md:text-4xl` instead of fixed `text-4xl`.

11. **[P3] Increase minimum font sizes** (MUX-76) -- Category labels at 10-11px are below readable threshold on mobile.

12. **[P3] Add `aria-describedby` to address form errors** (MUX-74) -- Accessibility improvement for screen reader users.
