# 03 — Navigation System Documentation

**Date**: 2026-03-08
**Scope**: All navigation elements across the SKAPARA frontend
**Base path**: `frontend/src/`

---

## 1. Architecture Overview

The navigation system is divided across three route groups, each with its own layout and navigation strategy:

| Route Group | Layout | Navigation Elements |
|---|---|---|
| `(landing)` | Minimal (`<main>` only, no shell) | No header/sidebar. CTA buttons inline in page content. Footer rendered inside page. |
| `(app)` | `StorefrontLayout` (sidebar + header + detail panel) | StorefrontSidebar, StorefrontHeader, BottomNav (mobile), Footer (non-chat pages) |
| `(focused)` | `AuthBackground` + centered content | FocusedFooter only. No header, no sidebar. |

**Key architectural decision**: The `(landing)` page has NO dedicated header or navigation bar. Navigation is handled entirely through CTA buttons within the hero section and the final CTA section. The `Footer` component is rendered at the bottom of the landing page.

---

## 2. StorefrontSidebar

**File**: `components/storefront/StorefrontSidebar.tsx`
**Used in**: `(app)` route group via `StorefrontLayout`

### Structure (top to bottom)

1. **Logo + Store Name** (h-14, border-b)
   - `<BrandMark showName>` wrapped in `<Link href="/{locale}">`
   - Collapse button (`PanelLeftClose` icon) — visible only on `lg:` and only when `onCollapse` prop is provided

2. **Navigation Items** (nav, p-2, gap-1)

| Order | Icon | Label Key | Translation (EN) | Route | Notes |
|---|---|---|---|---|---|
| 1 | `MessageCircle` | `navigation.chat` | "Chat" | `/{locale}/chat` | |
| 2 | `Store` | `storefront.shop` | "Shop" | `/{locale}/shop` | |
| 3 | `Sparkles` | `storefront.newArrivals` | "New Arrivals" | `/{locale}/shop?sort=newest&newArrivals=true` | Query-param route |
| 4 | `Heart` | `storefront.favorites` | "Favorites" | `/{locale}/wishlist` | |
| 5 | `ShoppingBag` | `storefront.orders` | "Orders" | `/{locale}/orders` | |
| 6 | `ShoppingCart` | `storefront.cart` | "Cart" | `/{locale}/cart` | Separate from the array; has badge |

3. **Cart Link with Badge**
   - Rendered separately after the `navigationItems.map()`
   - Shows `<Badge variant="destructive">` with `itemCount` when > 0
   - Badge is rounded-full, 5x5, centered text

4. **Recommended Section** (scrollable, flex-1)
   - "Recommended" heading (`storefront.recommended`)
   - Fetches top 6 by rating from `/api/products?limit=6&sort=topRated`, shuffles, picks 2
   - Re-fetches every 5 minutes via `setInterval`
   - Each product rendered as `ProductCard` (internal component) — clickable, opens detail panel via `setSelectedProduct` + `addArtifact`

5. **Popular Today Section**
   - "Popular Today" heading (`storefront.popularToday`)
   - Fetches top 4 by review count from `/api/products?limit=4&sort=popular`
   - Picks 1 using day-of-year as deterministic seed
   - Same `ProductCard` rendering

6. **PodClaw Status Footer** (border-t, p-4)
   - Green pulsing dot + text "AI Store Manager Active" (`storefront.podclawActive`)

### Active State Logic

```
isActive(href):
  - Chat: exact match only (/{locale}/chat)
  - Query-param routes (e.g. newArrivals): path must match AND all query params must match
  - Plain paths: exact match only (no startsWith)

Active style:   bg-primary/10 text-primary font-medium
Inactive style: text-muted-foreground hover:bg-muted hover:text-foreground
```

### Desktop vs Mobile

- **Desktop (lg:)**: Rendered as `<aside>` with `lg:w-60`. Collapsible via `useSidebarCollapsed` hook (persisted in localStorage key `pod-sidebar-collapsed`, defaults to collapsed=true). When collapsed: `lg:w-0 lg:overflow-hidden lg:border-r-0`.
- **Mobile (<lg)**: Not rendered in aside. Instead rendered inside `<Sheet side="left" className="w-60 p-0">`. Opened by hamburger menu in `StorefrontHeader`. Closed on navigation via `onNavigate` callback.

---

## 3. StorefrontHeader

**File**: `components/storefront/StorefrontHeader.tsx`
**Used in**: `(app)` route group via `StorefrontLayout`

### Structure (left to right)

**Left section** (`flex items-center gap-4 flex-shrink-0`):

| Element | Visibility | Action |
|---|---|---|
| Hamburger `Menu` icon button | `lg:hidden` | Opens mobile sidebar Sheet (`onToggleSidebar`) |
| `PanelLeftOpen` icon button | `hidden lg:inline-flex`, only when `isSidebarCollapsed` | Expands desktop sidebar (`onToggleDesktopSidebar`) |
| Nav links: "Chat" + "Shop" | `hidden md:flex` | `<Button variant="ghost" asChild>` wrapping `<Link>`. Active state: `text-foreground bg-muted` |

**Center section** (`flex-1 max-w-md hidden lg:block`):

| Element | Visibility | Details |
|---|---|---|
| Search form | `hidden lg:block` | `<Input type="search">` with `Search` icon, `pl-9 rounded-full bg-muted border-0`. Submits to `/{locale}/shop?q={query}` |

**Right section** (`flex items-center gap-2 flex-shrink-0`):

| Order | Element | Visibility | Details |
|---|---|---|---|
| 1 | Mobile search toggle | `lg:hidden` | Opens full-screen search overlay |
| 2 | Notifications bell | `hidden sm:inline-flex`, only when `authenticated` | `<Badge variant="destructive">` with `unreadCount` from `useNotifications` |
| 3 | Cart icon | Always visible | `<Link href="/{locale}/cart">` with badge showing `itemCount` |
| 4 | Theme toggle | Always visible | `<ThemeToggle />` component |
| 5 | Locale switcher | Always visible | `<DropdownMenu>` with Globe icon. Options: English/Espanol/Deutsch with flag emojis. Replaces locale in current pathname. |
| 6 | User avatar / Login | Always visible | Auth-aware (see section 7) |

### Mobile Search Overlay

When `mobileSearchOpen` is true (toggled by the search icon on mobile):
- Full-screen overlay: `fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden`
- Search input with `autoFocus`
- Cancel button using `navigation.cancel` translation
- Backdrop click closes overlay
- Submit navigates to `/{locale}/shop?q={query}` and closes overlay

### Sticky Behavior

- `sticky top-0 z-30`
- Background: `bg-card`
- Height: `h-14`
- Border: `border-b border-border`

---

## 4. BottomNav (Mobile)

**File**: `components/storefront/BottomNav.tsx`
**Used in**: `StorefrontLayout` (always rendered, but `md:hidden`)

### Structure

Fixed bottom bar: `fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border`

| Order | Icon | Label | Route |
|---|---|---|---|
| 1 | `MessageSquare` | "Chat" | `/{locale}/chat` |
| 2 | `Store` | "Shop" | `/{locale}/shop` |
| 3 | `ShoppingCart` | "Cart" | `/{locale}/cart` |
| 4 | `User` | "Profile" | `/{locale}/profile` |

### Active State

- Uses `pathname === fullHref || pathname.startsWith(fullHref + '/')` (startsWith, unlike sidebar which uses exact match)
- Active: `text-primary`
- Inactive: `text-muted-foreground`

### Cart Badge

- Only on Cart item, when `cartCount > 0`
- Positioned: `absolute top-2 right-2 size-4 rounded-full bg-primary text-primary-foreground`
- Shows `9+` when count exceeds 9

### Labels

- Hardcoded strings ("Chat", "Shop", "Cart", "Profile") — NOT using i18n translations

### Touch Targets

- Each item: `p-3 min-h-[56px] min-w-[64px]`

### Content Padding

- When BottomNav is visible, content areas add `pb-16 md:pb-0` to prevent overlap

---

## 5. Landing Page Navigation

**File**: `components/landing/LandingPageClient.tsx`
**Layout**: `(landing)/layout.tsx` — minimal: just `<main>` with skip-to-content link, no header/sidebar

The landing page has NO header navigation bar. Instead, navigation is embedded in the page content:

### Hero Section CTAs

| CTA | Style | Route | Translation Key |
|---|---|---|---|
| Primary: "Explore the collection" | `Button size="lg"` solid, rounded-full, with `ArrowRight` icon | `/{locale}/chat` | `landing.heroCTA` |
| Secondary: "Browse Products" | `Button size="lg" variant="outline"`, rounded-full, with `Store` icon | `/{locale}/shop` | `landing.browseProducts` |

Both wrapped in `MagneticButton` (hover-follow effect) and `motion.div` (entrance animation).

### Product Showcase Section

- "Browse Products" link in section header: `hidden md:flex`, links to `/{locale}/shop` with `ArrowRight` icon
- Mobile "View All" link below carousel: `md:hidden`, same destination
- Each product card in the carousel links to `/{locale}/shop/{product.id}`

### Final CTA Section

Same two buttons as hero (Primary chat CTA + Secondary shop CTA), identical routes.

### Sub-CTA Text

- `landing.heroSubCTA`: "Free to explore -- no account needed"

---

## 6. Footer

**File**: `components/Footer.tsx`
**Used in**: `(app)` route group (non-chat pages) and `(landing)` page

### Structure (4-column grid on lg:, 2-column on mobile)

**Column 1 — Brand & Social** (col-span-2 on mobile, col-span-1 on lg:):
- `<BrandMark showName>`
- Description text (`footer.description`)
- Social icons: Instagram, Twitter, Facebook — linking to `SOCIAL_LINKS` from `store-config`

**Column 2 — Shop Links**:
| Link | Route |
|---|---|
| All Products (`footer.allProducts`) | `/{locale}/shop` |
| Apparel (`footer.apparel`) | `/{locale}/shop/category/apparel` |
| Accessories (`footer.accessories`) | `/{locale}/shop/category/accessories` |
| Home & Living (`footer.home-decor`) | `/{locale}/shop/category/home-decor` |

**Column 3 — Company Links**:
| Link | Route |
|---|---|
| About Us (`footer.about`) | `/{locale}/about` |
| Contact (`footer.contact`) | `/{locale}/contact` |
| FAQ (`footer.faq`) | `/{locale}/faq` |

**Column 4 — Legal & Language**:
| Link | Route |
|---|---|
| Privacy Policy (`footer.privacy`) | `/{locale}/privacy` |
| Terms of Service (`footer.terms`) | `/{locale}/terms` |
| Returns & Refunds (`footer.returns`) | `/{locale}/returns` |
| Shipping Policy (`footer.shipping`) | `/{locale}/shipping` |
| Legal Notice (`footer.legalNotice`) | `/{locale}/legal` |
| Cookie Settings (`footer.cookieSettings`) | Button: calls `clearConsent()` + `window.location.reload()` |

Language selector: `<Select>` dropdown with en/es/de options. Replaces locale in current path.

### Below Grid

- **Newsletter Signup**: `<NewsletterSignup>` component (also appears on landing page)
- **Separator**
- **Payment Methods**: Visa, Mastercard, PayPal, Apple Pay, Google Pay (text badges, not icons)
- **Copyright**: `footer.copyright` with year and store name
- **Theme Toggle**: Light/dark mode pill toggle (Sun/Moon icons)
- **Powered By**: `footer.powered` — "Made in Europe - Designed with care"

---

## 7. FocusedFooter

**File**: `components/FocusedFooter.tsx`
**Used in**: `(focused)` route group (auth pages, checkout, legal pages)

Minimal centered footer:
- "Back to store" link: `<Link href="/{locale}/chat">` with `ArrowLeft` icon, styled as pill button
- Separator
- 4 legal links: Terms, Privacy, Returns, Shipping
- Copyright line with brand name

---

## 8. Auth-Aware UI

### When NOT authenticated

| Component | Behavior |
|---|---|
| `StorefrontHeader` user section | Shows `<Button size="sm">` "Log in" linking to `/{locale}/auth/login` |
| `StorefrontHeader` notifications | Bell icon hidden (only shown when `authenticated`) |
| `StorefrontSidebar` | No change — all nav items visible regardless of auth |
| `BottomNav` | No change — Profile link always visible (profile page itself handles redirect) |
| Landing page | No auth-specific changes |

### When authenticated

| Component | Behavior |
|---|---|
| `StorefrontHeader` user section | Shows `<Avatar>` with user initial in `<DropdownMenu>`. Menu contains: user name/email label, Profile link (`/{locale}/profile`), Logout button (destructive variant). |
| `StorefrontHeader` notifications | Bell icon visible (`hidden sm:inline-flex`). Shows badge with `unreadCount` from `useNotifications` hook. |
| `StorefrontSidebar` | No change |
| `BottomNav` | No change |

### Auth Loading State

- While `loading` is true: a `h-8 w-8 rounded-full bg-muted animate-pulse` skeleton is shown in place of the user avatar/login button.

---

## 9. Cart Indicator

The cart badge appears in THREE locations:

| Location | Component | Visibility | Data Source | Badge Style |
|---|---|---|---|---|
| Sidebar | `StorefrontSidebar` | All breakpoints (within sidebar) | `useCart().itemCount` | `Badge variant="destructive"`, `ml-auto h-5 min-w-5 rounded-full` |
| Header | `StorefrontHeader` | All breakpoints | `useCart().itemCount` | `Badge variant="destructive"`, `absolute -top-1 -right-1 h-5 w-5 rounded-full` |
| Bottom Nav | `BottomNav` | `md:hidden` | `useCart().items` (computed via reduce) | `absolute top-2 right-2 size-4 rounded-full bg-primary text-primary-foreground`, shows `9+` for > 9 |

Note: The sidebar and header both use `useCart().itemCount` directly, while BottomNav computes `cartCount` by reducing `items` array. This means the same data source (`CartProvider`) but different access patterns.

---

## 10. Search

### Desktop Search (lg:+)

- Located in `StorefrontHeader`, center section
- `hidden lg:block`, `max-w-md`
- Rounded-full input with search icon
- Placeholder: `storefront.searchPlaceholder` ("Search products...")
- Submit navigates to `/{locale}/shop?q={encoded_query}`

### Mobile Search (<lg)

- Search icon in header right section opens full-screen overlay
- Overlay: `fixed inset-0 z-50 bg-background/80 backdrop-blur-sm`
- Input with `autoFocus`
- Cancel button to close
- Backdrop click to close
- Same navigation target: `/{locale}/shop?q={query}`

### Search NOT present in:

- Landing page (no search bar)
- Sidebar (no search input)
- BottomNav (no search item)
- Footer (no search)

---

## 11. Breadcrumbs

Breadcrumbs exist in the shop/product pages using `@/components/ui/breadcrumb` (shadcn/ui).

### Shop Page (`(app)/shop/page.tsx`)

Two modes (category landing vs product grid), both use:
```
Home > Shop
```

### Category Page (`(app)/shop/category/[slug]/page.tsx`)

```
Home > Shop > [Parent Category (if exists)] > Category Name
```
Parent category is conditional — only shown if the category has a parent.

### Product Detail Page (`components/products/ProductDetailClient.tsx`)

```
Home > Shop > Category > Product Title
```
- Home links to `/{locale}`
- Shop links to `/{locale}/shop`
- Category links to `/{locale}/shop/category/{category_slug}`, with i18n translation via `shop.category.*`
- Product title is the terminal `<BreadcrumbPage>` (not a link)

### Product Detail Page — JSON-LD (`(app)/shop/[id]/page.tsx`)

Server component generates `BreadcrumbList` structured data for SEO with positions matching the visual breadcrumb.

### Checkout Breadcrumb (`components/checkout/CheckoutBreadcrumb.tsx`)

Different from shop breadcrumbs. This is a step indicator (not a navigation breadcrumb):
```
Cart (1) — Shipping (2) — Payment (3) — Confirmation (4)
```
- Steps: `cart`, `shipping`, `payment`, `confirmation`
- Translations: `Checkout.breadcrumb.*`
- Visual: numbered circles with connector lines
- States: completed (primary bg + check icon), active (primary border), future (muted)
- Used in `CheckoutView.tsx` with `currentStep="shipping"`
- NOT clickable — purely visual progress indicator

### Breadcrumbs NOT present in:

- Chat page
- Wishlist page
- Orders page
- Profile page
- Landing page

---

## 12. Page-to-Page Navigation Flows

### Landing to App

| From | To | Mechanism |
|---|---|---|
| Landing hero | Chat | Primary CTA button: "Explore the collection" |
| Landing hero | Shop | Secondary CTA button: "Browse Products" |
| Landing product carousel | Product detail | Product card link: `/{locale}/shop/{id}` |
| Landing showcase header | Shop | "Browse Products" text link (desktop only) |
| Landing showcase footer | Shop | "Browse Products" text link (mobile only) |
| Landing final CTA | Chat | Primary CTA button |
| Landing final CTA | Shop | Secondary CTA button |
| Landing footer | Various | Footer links (shop categories, legal, about, contact) |

### Within App (via Sidebar)

| From | To | Route |
|---|---|---|
| Any app page | Chat | `/{locale}/chat` |
| Any app page | Shop | `/{locale}/shop` |
| Any app page | New Arrivals | `/{locale}/shop?sort=newest&newArrivals=true` |
| Any app page | Wishlist | `/{locale}/wishlist` |
| Any app page | Orders | `/{locale}/orders` |
| Any app page | Cart | `/{locale}/cart` |
| Any app page | Home (landing) | Logo click: `/{locale}` |

### Within App (via Header)

| From | To | Mechanism |
|---|---|---|
| Any app page | Chat | Header nav link (md:+) |
| Any app page | Shop | Header nav link (md:+) |
| Any app page | Cart | Cart icon |
| Any app page | Profile | User dropdown > Profile |
| Any app page | Login | Login button (unauthenticated) |
| Any app page | Shop (search) | Search form submission |

### Within App (via BottomNav, mobile only)

| From | To | Route |
|---|---|---|
| Any app page | Chat | `/{locale}/chat` |
| Any app page | Shop | `/{locale}/shop` |
| Any app page | Cart | `/{locale}/cart` |
| Any app page | Profile | `/{locale}/profile` |

### Shop Flow

| From | To | Mechanism |
|---|---|---|
| Shop grid | Product detail | Product card link: `/{locale}/shop/{id}` |
| Shop grid | Category | Category links/breadcrumbs |
| Product detail | Shop | Breadcrumb "Shop" link |
| Product detail | Category | Breadcrumb category link |
| Product detail | Home | Breadcrumb "Home" link |
| Product detail | Cart | "Add to Cart" button (stays on page, adds via `useCart`) |

### Cart to Checkout Flow

| From | To | Mechanism |
|---|---|---|
| Cart page | Checkout | CTA button in cart (navigates to `/{locale}/checkout`) |
| Checkout | (external) Stripe | Redirect to Stripe checkout session |
| Stripe | Confirmation | Redirect back to confirmation page |

### Focused (Auth) Flow

| From | To | Mechanism |
|---|---|---|
| Login page | Chat/Store | `FocusedFooter` "Back to store" links to `/{locale}/chat` |
| Auth pages | Legal pages | `FocusedFooter` links (Terms, Privacy, Returns, Shipping) |
| After login | Previous page / Chat | Router redirect on successful auth |

---

## 13. Detail Panel (Right Side)

**File**: `components/storefront/DetailPanel.tsx`
**Trigger**: Sidebar product click via `setSelectedProduct()` + `addArtifact()`, or AI chat artifact display

- **Desktop (lg:)**: Right sidebar, 340px wide, with slide-in animation
- **Mobile (<lg)**: Full-screen overlay, `fixed inset-0 z-50`, slide-up animation
- Shows when `artifacts.length > 0 || selectedProduct` is truthy
- Closed via `onClose` callback which calls `setSelectedProduct(null)` + `clearArtifacts()`
- Contains "Ask about this product" action that sets a pending chat message

---

## 14. Sidebar Collapse State

**Hook**: `hooks/useSidebarCollapsed.ts`
**Storage**: `localStorage` key `pod-sidebar-collapsed`
**Default**: `true` (collapsed)

- When collapsed: sidebar width transitions from `lg:w-60` to `lg:w-0 lg:overflow-hidden lg:border-r-0`
- Header shows `PanelLeftOpen` button to expand
- Sidebar shows `PanelLeftClose` button to collapse (only on lg:)
- Transition: `transition-all duration-300 ease-in-out`

---

## 15. Translation Keys Summary

### `navigation` namespace
| Key | EN Value | Used In |
|---|---|---|
| `home` | "Home" | Breadcrumbs |
| `chat` | "Chat" | Sidebar, Header |
| `shop` | "Shop" | Header, Breadcrumbs |
| `cart` | "Cart" | Header sr-only |
| `orders` | "Orders" | (available but sidebar uses `storefront.orders`) |
| `profile` | "Profile" | Header user dropdown |
| `login` | "Log in" | Header login button |
| `logout` | "Log out" | Header user dropdown |
| `cancel` | "Cancel" | Mobile search overlay |

### `storefront` namespace (navigation-relevant keys)
| Key | EN Value | Used In |
|---|---|---|
| `shop` | "Shop" | Sidebar |
| `newArrivals` | "New Arrivals" | Sidebar |
| `favorites` | "Favorites" | Sidebar |
| `orders` | "Orders" | Sidebar |
| `cart` | "Cart" | Sidebar |
| `recommended` | "Recommended" | Sidebar section |
| `popularToday` | "Popular Today" | Sidebar section |
| `podclawActive` | "AI Store Manager Active" | Sidebar footer |
| `searchPlaceholder` | "Search products..." | Header search |
| `collapseSidebar` | (fallback: "Collapse sidebar") | Sidebar collapse button sr-only |

### `landing` namespace (navigation-relevant keys)
| Key | EN Value | Used In |
|---|---|---|
| `heroCTA` | "Explore the collection" | Hero primary button |
| `browseProducts` | "Browse Products" | Hero secondary + showcase + final CTA |
| `finalCTA` | "Start exploring -- it's free" | Final CTA primary button |
| `heroSubCTA` | "Free to explore -- no account needed" | Below hero CTAs |

### `footer` namespace
| Key | EN Value |
|---|---|
| `description` | "Unique fashion & accessories. Designed with you, made in Europe." |
| `shop` | "Shop" |
| `allProducts` | "All Products" |
| `apparel` | "Apparel" |
| `accessories` | "Accessories" |
| `home-decor` | "Home & Living" |
| `company` | "Company" |
| `about` | "About Us" |
| `contact` | "Contact" |
| `faq` | "FAQ" |
| `legal` | "Legal" |
| `privacy` | "Privacy Policy" |
| `terms` | "Terms of Service" |
| `returns` | "Returns & Refunds" |
| `shipping` | "Shipping Policy" |
| `legalNotice` | "Legal Notice" |
| `cookieSettings` | "Cookie Settings" |
| `weAccept` | "We accept" |
| `language` | "Language" |
| `copyright` | "(c) {year} {storeName}. All rights reserved." |
| `powered` | "Made in Europe - Designed with care" |

---

## 16. Notable Observations

1. **BottomNav labels are hardcoded in English** ("Chat", "Shop", "Cart", "Profile") instead of using i18n translations, unlike all other navigation components.

2. **Active state logic differs between components**:
   - Sidebar: exact match only (no startsWith)
   - Header: uses `pathname.includes('/shop')` for Shop, exact match for Chat
   - BottomNav: uses `pathname.startsWith(fullHref + '/')` (prefix match)

3. **Sidebar defaults to collapsed** on desktop (`isCollapsed` initial value is `true`), meaning first-time visitors see no sidebar until they click the expand button.

4. **Three different cart badge implementations** across sidebar (inline), header (absolute positioned), and BottomNav (absolute positioned with 9+ cap).

5. **Landing page has no header navigation** — transitioning from landing to app creates a jarring layout shift (no nav -> full sidebar+header).

6. **Navigation item overlap**: "Chat" and "Shop" appear in sidebar AND header nav AND bottom nav (three places simultaneously on mobile when sidebar is open).

7. **Footer appears twice on landing**: the `Footer` component is rendered inside `(landing)/page.tsx`, and `LandingPageClient` also contains a `NewsletterSignup` section. When viewing in `(app)` pages, Footer is rendered conditionally (only when NOT on chat page).

8. **No "Designs" link in primary navigation**: The designs gallery (`/{locale}/designs`) exists as a page but has no sidebar/header/bottom-nav entry.

9. **No "Profile" link in sidebar**: Profile is accessible via header dropdown and BottomNav, but not via sidebar navigation.

10. **Checkout uses `(focused)` layout**: Checkout flow strips all storefront navigation (no sidebar, no header, no bottom nav) and uses only `FocusedFooter`.
