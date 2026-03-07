# Mobile UX Audit V2 -- 2026-03-07

Post Amazon-style PDP redesign audit. Covers navigation, touch targets, checkout, performance, and mobile-specific patterns across the SKAPARA storefront.

---

## Mobile Experience Scorecard

| Area | Score (1-5) | Status | Critical Issues |
|---|---|---|---|
| Navigation & Discovery | 4 | Good | Header not sticky; locale/notification hidden on mobile |
| Touch Targets | 3 | Needs Work | 6 violations found below 44px minimum |
| Thumb Zone & CTAs | 5 | Excellent | SmartStickyCTA + BottomNav in thumb zone |
| Product Grid (Shop) | 4 | Good | Auto-fill grid responsive; category chips scrollable |
| Product Detail (PDP) | 4 | Good | Amazon-style layout, Embla carousel with dots, collapsible specs |
| Checkout | 3 | Needs Work | No Apple/Google Pay; address form missing autocomplete/inputMode |
| Chat | 4 | Good | Sticky input, voice, image upload, suggested prompts |
| Performance / Loading | 4 | Good | Skeletons, priority images, lazy-load via Next Image, service worker |
| Gestures | 3 | Needs Work | No swipe-to-close on sidebar; dot indicators not swipeable |
| Overall Mobile UX | 3.8 | Good | Solid foundation, fix touch targets + checkout form for conversion |

---

## Touch Target Violations

### CRITICAL (< 44px interactive areas)

| Element | Measured Size | File : Line | Fix |
|---|---|---|---|
| PDP dot indicators | `w-2 h-2` (8x8px) | `ProductDetailClient.tsx:453-459` | Wrap in 44px touch area or enlarge dot+padding |
| SmartStickyCTA quantity -/+ buttons | `size-7` (28x28px) | `SmartStickyCTA.tsx:122,131` | Increase to `size-11` (44px) to match other buttons |
| ProductCard wishlist heart | `h-8 w-8` (32x32px) | `ProductCard.tsx:171-173` | Increase to `h-10 w-10` (40px min, ideally 44px) |
| ProductCard Add to Cart icon | `h-8 w-8` (32x32px) | `ProductCard.tsx:249-250` | Increase to `h-10 w-10` |
| ProductCard Quick View icon | `h-8 w-8` (32x32px) | `ProductCard.tsx:258-260` | Increase to `h-10 w-10` |
| ProductCard color swatches | `w-[36px] h-[36px]` (36x36px) | `ProductCard.tsx:145` | Increase to `w-[44px] h-[44px]` |
| ShopPage clear search X | `size-8` (32x32px) | `ShopPageClient.tsx:232` | Increase to `size-10` |
| Sidebar collapse button | `h-7 w-7` (28x28px) | `StorefrontSidebar.tsx:155` | Increase to `h-9 w-9` (desktop-only, lower priority) |

### PASSING (>= 44px)

| Element | Size | File |
|---|---|---|
| PDP Wishlist/Share buttons | `h-10 w-10` (40px -- borderline OK) | `ProductDetailClient.tsx:466,480` |
| PDP Size buttons | `min-w-[2.75rem] min-h-[2.75rem]` (44px) | `ProductDetailClient.tsx:622` |
| PDP Color thumbnail cards | `w-14 h-14` (56px mobile) | `ProductDetailClient.tsx:585` |
| SmartStickyCTA color dots | `min-w-[44px] min-h-[44px]` (44px) | `SmartStickyCTA.tsx:97` |
| BottomNav items | `min-h-[56px] min-w-[64px]` (56px) | `BottomNav.tsx:35` |
| ChatArea input buttons | `h-11 w-11` (44px) | `ChatArea.tsx:861,893,909` |
| Pagination buttons | `size-10` (40px -- borderline) | `ShopPageClient.tsx:377` |

---

## Critical UX Gaps

### 1. Header is NOT sticky on scroll (HIGH impact)

**File:** `StorefrontHeader.tsx:89`
**Issue:** The header uses `h-14` but has no `sticky top-0` class. When users scroll down on PDP or Shop, they lose access to search, cart, and navigation until they scroll back up. On mobile, this means losing the cart badge indicator.
**Impact:** Users must scroll to top to access cart/search -- increases friction and reduces conversion.
**Fix:** Add `sticky top-0 z-30` to the header element.

### 2. Checkout AddressForm missing autocomplete and inputMode attributes (HIGH impact)

**File:** `AddressForm.tsx:135-273`
**Issue:** None of the address fields have `autocomplete` attributes (e.g., `name`, `street-address`, `postal-code`, `tel`) or `inputMode` attributes (e.g., `inputMode="tel"` for phone, `inputMode="numeric"` for postal code). Guest email in CheckoutView also lacks `autocomplete="email"`.
**Impact:** Mobile users cannot autofill addresses from their browser/OS, forcing manual typing of 7+ fields. This is the #1 cause of mobile checkout abandonment.
**Fix:** Add `autocomplete` to every field: `name`, `street-address`, `address-line2`, `address-level2`, `address-level1`, `postal-code`, `country`, `tel`. Add `inputMode="tel"` for phone, `inputMode="numeric"` for postal code.

### 3. No Apple Pay / Google Pay integration (MEDIUM-HIGH impact)

**File:** `CheckoutView.tsx`
**Issue:** Checkout redirects to Stripe Checkout page. No native Apple Pay / Google Pay buttons on the checkout page itself (only card logos displayed as SVGs).
**Impact:** One-tap mobile payments would significantly reduce checkout friction. Stripe supports Payment Request API.
**Fix:** Add Stripe Payment Request Button (supports Apple Pay, Google Pay, Link) as a primary CTA above the standard "Proceed to Payment" button.

### 4. Order summary NOT collapsible on mobile (MEDIUM impact)

**File:** `CheckoutView.tsx:574-718`
**Issue:** The order summary card with item list, price breakdown, gift message, and payment button is a full Card that stacks below the shipping form on mobile (via `grid-cols-1 lg:grid-cols-3`). On a 375px screen with 3+ items, users must scroll past the entire form AND the full order summary to find the payment button.
**Impact:** The "Proceed to Payment" button can be buried below multiple scrolls of content on mobile.
**Fix:** On mobile, make the order summary a collapsible `<details>` showing only total + item count, with the payment button extracted as a sticky footer. Or use a `Sheet` for the summary.

### 5. SmartStickyCTA overlaps BottomNav on mobile (MEDIUM impact)

**File:** `SmartStickyCTA.tsx:71` and `BottomNav.tsx:24`
**Issue:** Both components use `fixed bottom-0`. SmartStickyCTA has `z-40`, BottomNav has `z-50`. When SmartStickyCTA is visible on PDP, it renders at `bottom-0` but BottomNav renders on top of it (higher z-index). The sticky CTA is partially or fully hidden behind the BottomNav.
**Impact:** The most important conversion element (Buy Now / Add to Cart) is obscured.
**Fix:** Add `pb-[56px]` (BottomNav height) to SmartStickyCTA's container, or change SmartStickyCTA to `bottom-[60px]` on mobile to sit above the BottomNav.

---

## Additional Findings

### Navigation & Discovery

- **Hamburger menu:** Present (Sheet drawer via StorefrontLayout). Opens left sidebar. Dismissible via sheet overlay.
- **Logo clickable:** Yes, links to `/${locale}` in sidebar and via BrandMark.
- **Cart icon visible with badge:** Yes, in header. Badge shows count with destructive variant.
- **Search accessible:** Yes, magnifying glass icon in header opens full-screen overlay on mobile. Good implementation.
- **Mobile sidebar menu items:** Navigation links are `px-3 py-2` (approx 36px height). Should be minimum `py-3` for 44px touch targets.
- **Locale switcher hidden on mobile:** `hidden sm:inline-flex` on Globe button (StorefrontHeader.tsx:215). Mobile users cannot change language from header. Only accessible via sidebar if it includes locale switching (it does not).
- **Notifications hidden on mobile:** `hidden sm:inline-flex` on Bell button (StorefrontHeader.tsx:175). Mobile users have no notification indicator.

### Product Grid

- **Column layout:** `neu-grid` uses `auto-fill, minmax(200px, 1fr)` -- on 375px screen with `px-4` (32px padding), the effective width is 343px, which fits 1 column. On 414px phones, still 1 column. This means mobile users see a single-column grid.
- **Recommendation:** Consider `minmax(160px, 1fr)` to allow 2 columns on most phones (optimal for discovery per the skill checklist).
- **Loading skeletons:** Yes, ProductCardSkeleton exists and is used.
- **Add to Cart from grid:** Yes, via icon button on each card.

### Product Detail (PDP) -- Post-Redesign

- **Layout order on mobile:** Image carousel -> Dot indicators + Wishlist/Share -> Title + Rating -> Separator -> Color selector -> Size selector -> Separator -> Price + Stock + Shipping -> Specs (collapsible) -> GPSR (collapsible) -> Separator -> Quantity -> CTAs (Add to Cart + Buy Now + Design) -> Description (collapsible). This follows the optimal mobile order well.
- **Image carousel:** Embla carousel with loop, swipe support. Good.
- **Dot indicators:** Visible on mobile only (md:hidden). Functional but too small for touch (8px).
- **Thumbnails:** Hidden on mobile, grid of 4 on md+. Correct pattern.
- **Color selector:** Thumbnail image cards, horizontally scrollable with `overflow-x-auto`. 56px on mobile. Good.
- **Size selector:** Pill buttons with `min-w-[2.75rem] min-h-[2.75rem]` (44px). Good.
- **Dual CTA:** "Add to Cart" (primary) + "Buy Now" (outline) stacked full-width. Amazon pattern. Good.
- **Description collapsible:** Yes, `<details>` with open by default. Good for mobile.
- **Specs collapsible:** Yes, `<details>` closed by default. Good.
- **Related products:** Uses `neu-grid` below reviews. Good.

### SmartStickyCTA

- **Visibility logic:** IntersectionObserver on main CTA div. Shows when CTAs scroll out of view. Correct.
- **Mobile only:** `md:hidden`. Good.
- **Content:** Price + optional color dots + optional quantity +/- + Buy Now + Add to Cart icon. Compact.
- **Color dots:** 44px touch areas wrapping 24px visual dots. Good.
- **Quantity buttons:** 28px (size-7). Too small. See touch target violations.

### Chat

- **Input bar:** Sticky at bottom with `sticky bottom-0`. Good thumb zone placement.
- **Touch targets:** Attach (44px), mic (44px), send (44px). All passing.
- **Welcome screen:** Suggested prompts are full-width tappable cards with `p-4`. Good.
- **Message bubbles:** User messages right-aligned, assistant left-aligned with avatar. Standard pattern.
- **Voice input:** Supported via Web Speech API with locale awareness.
- **Image upload:** File input + drag-and-drop. Good.
- **Bottom padding:** `pb-16 md:pb-0` when on chat page in StorefrontLayout. Accounts for BottomNav. Good.

### Checkout

- **Scrolls to complete:** On mobile with saved address + 2 items: approximately 4-5 full screen scrolls. Could be reduced.
- **Guest checkout:** Supported with email field. Good.
- **Error messages:** Inline near fields. Good pattern.
- **Exit intent dialog:** Present via AlertDialog. Good for retention.
- **Loading skeleton:** Present for initial load. Good.

### Performance

- **Image optimization:** Next.js `<Image>` with `sizes` prop throughout. Priority flag on first PDP image and first 4 grid cards. Good.
- **No explicit `srcSet`:** Next.js Image handles this automatically via its loader. Acceptable.
- **Service worker:** `ServiceWorkerRegistration.tsx` exists. PWA support with InstallPrompt.
- **Lazy loading:** Next.js Image lazy-loads by default (except priority). ChatArea is dynamically imported. Good.
- **No virtualization:** ProductGrid renders all items without virtualization. With 20 items per page, this is acceptable. Would need attention if page size increases.

### Gestures

- **Carousel swipe:** Embla carousel supports native swipe. Good.
- **Sidebar dismiss:** Sheet component handles tap-outside and X button, but no swipe-to-close gesture on the Sheet (depends on shadcn/ui Sheet implementation -- typically supports it via Radix).
- **Pull-to-refresh:** Not implemented. Low priority for SPA.

---

## Quick Wins

| Priority | Fix | Files | Effort |
|---|---|---|---|
| P0 | Fix SmartStickyCTA bottom offset to clear BottomNav | `SmartStickyCTA.tsx:71` | 5 min |
| P0 | Increase SmartStickyCTA quantity buttons to 44px | `SmartStickyCTA.tsx:122,131` | 5 min |
| P0 | Add `autocomplete` attributes to AddressForm fields | `AddressForm.tsx` | 15 min |
| P0 | Add `autocomplete="email"` to guest email input | `CheckoutView.tsx:483` | 2 min |
| P1 | Enlarge PDP dot indicator touch areas to 44px | `ProductDetailClient.tsx:453` | 10 min |
| P1 | Make header sticky | `StorefrontHeader.tsx:89` | 5 min |
| P1 | Increase ProductCard action buttons to 40-44px | `ProductCard.tsx:171,249,258` | 10 min |
| P1 | Increase ProductCard color swatches to 44px | `ProductCard.tsx:145` | 5 min |
| P2 | Reduce `neu-grid` min to 160px for 2-col mobile | `globals.css:241` | 5 min |
| P2 | Expose locale switcher on mobile (header or BottomNav) | `StorefrontHeader.tsx` | 20 min |
| P2 | Make checkout order summary collapsible on mobile | `CheckoutView.tsx:574` | 30 min |

---

## Recommendations

Prioritized by mobile conversion impact:

### 1. Fix SmartStickyCTA / BottomNav overlap (P0 -- Conversion blocker)
The sticky Buy Now button is the highest-value conversion element on mobile PDP. It must sit above the BottomNav bar. Change `bottom-0` to `bottom-[60px]` in SmartStickyCTA when visible on mobile.

### 2. Add autocomplete attributes to checkout forms (P0 -- Checkout conversion)
Mobile autofill reduces address entry time from 2+ minutes to seconds. Add standard autocomplete values to every field in AddressForm.tsx and the guest email input. This is the single highest-impact change for mobile checkout conversion.

### 3. Fix all 44px touch target violations (P0-P1 -- Usability)
The 6 violations listed above cause accidental taps and frustration. The SmartStickyCTA quantity buttons and PDP dot indicators are the most urgent since they are in high-frequency interaction zones.

### 4. Make header sticky (P1 -- Navigation)
Users should always have access to search, cart, and navigation. A sticky header with `h-14` takes 56px (3.7% of a 375x812 screen) -- acceptable trade-off for the accessibility gain.

### 5. Add Stripe Payment Request Button for Apple Pay / Google Pay (P2 -- Checkout conversion)
One-tap mobile payments dramatically reduce checkout friction. Stripe's Payment Request API can be added as a component above the existing "Proceed to Payment" button.

### 6. Optimize product grid for 2-column mobile (P2 -- Discovery)
Changing the CSS grid min from 200px to 160px would show 2 columns on 375px screens, doubling product visibility and matching the standard e-commerce pattern for mobile product discovery.

### 7. Expose language switcher on mobile (P2 -- Accessibility)
The Globe button is hidden below `sm` breakpoint. For a multilingual EU store (en/es/de), mobile users need language access. Consider adding it to the mobile sidebar or the BottomNav overflow.

---

## Files Audited

- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/products/ProductDetailClient.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/products/ProductCard.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/products/ProductGrid.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/products/SmartStickyCTA.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/storefront/StorefrontHeader.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/storefront/StorefrontSidebar.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/storefront/StorefrontLayout.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/storefront/BottomNav.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/storefront/ChatArea.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/shop/ShopPageClient.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/checkout/CheckoutView.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/checkout/AddressForm.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/globals.css`
