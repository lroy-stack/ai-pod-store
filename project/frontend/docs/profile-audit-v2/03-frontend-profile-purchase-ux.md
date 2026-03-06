# Frontend Profile & Purchase UX Architecture Audit

**Date**: 2026-03-04
**Scope**: Profile, Orders, Cart, Checkout, Wishlist, Hooks, Storefront Integration, Engagement Components
**Codebase Root**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend`

---

## Table of Contents

1. [High-Level Component Tree](#1-high-level-component-tree)
2. [Profile Pages & Components](#2-profile-pages--components)
3. [Orders Pages & Components](#3-orders-pages--components)
4. [Cart Components](#4-cart-components)
5. [Checkout Flow](#5-checkout-flow)
6. [Wishlist Pages](#6-wishlist-pages)
7. [Hooks & State Management](#7-hooks--state-management)
8. [Storefront Integration](#8-storefront-integration)
9. [Engagement & Conversion Components](#9-engagement--conversion-components)
10. [Cross-Cutting Concerns](#10-cross-cutting-concerns)
11. [Gaps & Missing Features](#11-gaps--missing-features)

---

## 1. High-Level Component Tree

```
RootLayout
  [locale]/layout.tsx (Providers: CartProvider, WishlistProvider, Toaster)
  |
  +-- (landing)/page.tsx .............. Landing page (no StorefrontLayout)
  |
  +-- (app)/layout.tsx ................ StorefrontLayout wrapper
  |   |
  |   +-- StorefrontProvider
  |   |     +-- ChatMessageProvider
  |   |           +-- StorefrontShell
  |   |                 +-- StorefrontSidebar (desktop aside / mobile Sheet)
  |   |                 +-- StorefrontHeader
  |   |                 +-- OfflineBanner
  |   |                 +-- SubscriptionStatusBanner
  |   |                 +-- ChatArea (always mounted, h-0 when not /chat)
  |   |                 +-- {children} + Footer  (when not /chat)
  |   |                 +-- DetailPanel (right sidebar, conditional)
  |   |                 +-- InstallPrompt
  |   |                 +-- WelcomePopup (only on /chat)
  |   |
  |   +-- profile/page.tsx (Server) --> ProfileForm, ShippingAddressList,
  |   |                                 PaymentMethodsList, ChangePasswordForm,
  |   |                                 DeleteAccountSection
  |   +-- profile/loading.tsx (Server)
  |   |
  |   +-- orders/page.tsx (Server) --> OrdersView (Client)
  |   +-- orders/[id]/page.tsx (Server) --> OrderDetailView (Client)
  |   |
  |   +-- cart/page.tsx (Server) --> CartView (Client)
  |   |
  |   +-- wishlist/page.tsx (Client)
  |   +-- wishlist/loading.tsx (Server)
  |   +-- wishlist/shared/[token]/page.tsx (Client)
  |   |
  |   +-- shop/ ...
  |   +-- designs/ ...
  |
  +-- (focused)/layout.tsx ............ Minimal layout (no sidebar)
      +-- checkout/page.tsx (Server) --> CheckoutView (Client)
      +-- checkout/success/page.tsx (Server) --> CartClearer (Client)
      +-- checkout/cancel/page.tsx (Server)
      +-- auth/ ...
```

---

## 2. Profile Pages & Components

### 2.1 Profile Page (Server Component)

**File**: `src/app/[locale]/(app)/profile/page.tsx`
**Type**: Server Component (async)
**Route**: `/{locale}/profile`

**Props**: `{ params: Promise<{ locale: string }> }`

**Structure**:
```
<div py-8 md:py-12>
  <div container max-w-2xl>
    <Card>
      <CardHeader> title + subtitle </CardHeader>
      <CardContent>
        <ProfileForm locale={locale} />
      </CardContent>
    </Card>
    <Card> <ShippingAddressList /> </Card>
    <PaymentMethodsList />
    <ChangePasswordForm />
    <DeleteAccountSection />
  </div>
</div>
```

**Component Imports**: ProfileForm, ShippingAddressList, DeleteAccountSection, ChangePasswordForm, PaymentMethodsList

**Metadata**: Generates title/description from `Profile` i18n namespace.

**Responsive**: `py-8 md:py-12`, container with `px-4 md:px-0 max-w-2xl`.

---

### 2.2 Profile Loading State

**File**: `src/app/[locale]/(app)/profile/loading.tsx`
**Type**: Server Component

Uses `Skeleton` from `@/components/ui/skeleton` inside `Card` containers. Renders 3 skeleton cards matching the profile layout. Good loading UX.

---

### 2.3 ProfileForm

**File**: `src/components/profile/ProfileForm.tsx`
**Type**: Client Component (`'use client'`)

**Props Interface**:
```ts
interface ProfileFormProps {
  locale: string
}
```

**Internal State**:
```ts
interface UserProfile {
  id: string
  email: string
  name: string
  avatar_url?: string
  locale: string
  currency: string
  phone?: string
  email_verified: boolean
  notification_preferences: { email: boolean; push: boolean; sms: boolean }
}
```

**Key State Variables**:
- `profile: UserProfile | null` -- fetched user profile
- `loading / saving` -- loading states
- `error / success` -- feedback messages
- `avatarUploading` -- avatar upload in progress
- `emailEditing / newEmail / emailPassword / emailChanging / emailSent` -- email change flow
- `formData` -- editable form fields (name, phone, locale, currency, notification_preferences)

**API Calls**:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/user/profile` | Fetch profile on mount |
| PATCH | `/api/user/profile` | Save profile changes |
| POST | `/api/profile/avatar` | Upload avatar (multipart/form-data) |
| POST | `/api/profile/change-email` | Initiate email change |

**User Flows**:
1. **View profile** -- Fetches on mount, shows skeleton during load, redirects to login if 401.
2. **Edit avatar** -- Click "Upload Avatar" -> file input, validates type + size (2MB max), POST FormData.
3. **Edit name/phone/language/currency** -- Form fields, PATCH on submit.
4. **Change email** -- Click pencil icon -> expand inline form -> enter new email + current password -> POST -> confirmation email sent.
5. **Toggle notifications** -- Switch toggles for email/push/sms.
6. **Locale change** -- After saving, if locale changed, auto-redirects to `/{newLocale}/profile`.

**shadcn/ui Components Used**: Avatar, AvatarImage, AvatarFallback, Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Switch, Separator

**Accessibility**:
- Labels with `htmlFor` on inputs
- Icon labels with descriptive text
- Form with `onSubmit` handler
- Password visibility toggles: missing `aria-label`

**Responsive**: 2-column grid on `md:` for name+phone and language+currency fields.

---

### 2.4 ShippingAddressList

**File**: `src/components/profile/ShippingAddressList.tsx`
**Type**: Client Component

**State**: `addresses: ShippingAddress[]`, `loading`, `showAddForm`, `editingAddress`

**API Calls**:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/shipping-addresses` | List addresses |
| DELETE | `/api/shipping-addresses/{id}` | Delete address |
| PUT | `/api/shipping-addresses/{id}` | Set default (full PUT with is_default=true) |

**User Flows**:
1. View all addresses in Card list
2. Add new address (opens AddressForm)
3. Edit address (opens AddressForm with pre-filled data)
4. Delete address (window.confirm dialog -- GAP: should use AlertDialog)
5. Set as default

**Sub-component**: `AddressForm` (from `./AddressForm`)

---

### 2.5 AddressForm (Profile variant)

**File**: `src/components/profile/AddressForm.tsx`
**Type**: Client Component

**Props**:
```ts
interface AddressFormProps {
  address?: ShippingAddress  // pre-fill for editing
  onSuccess: () => void
  onCancel: () => void
}
```

**Fields**: label, full_name, street_line1, street_line2, city, state, postal_code, country_code, phone, is_default (Checkbox)

**API**: POST `/api/shipping-addresses` (create) or PUT `/api/shipping-addresses/{id}` (update)

**shadcn/ui**: Input, Label, Button, Checkbox

**Responsive**: 2-column grid on `md:` for label+name and country+phone.

---

### 2.6 PaymentMethodsList

**File**: `src/components/profile/PaymentMethodsList.tsx`
**Type**: Client Component

**State**: `paymentMethods: PaymentMethod[]`, `loading`, `error`, `removingId`

**Interface**:
```ts
interface PaymentMethod {
  id: string
  type: string
  card: { brand: string; last4: string; exp_month: number; exp_year: number; funding: string } | null
  created: number
}
```

**API Calls**:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/profile/payment-methods` | List payment methods |
| DELETE | `/api/profile/payment-methods/{pmId}` | Remove payment method |

**User Flows**: View saved cards, remove via AlertDialog confirmation.

**GAP**: "Add Payment Method" button exists but is disabled -- no add-card flow implemented. Users can only save cards through checkout.

---

### 2.7 ChangePasswordForm

**File**: `src/components/profile/ChangePasswordForm.tsx`
**Type**: Client Component

**State**: `formData` (currentPassword, newPassword, confirmPassword), show/hide toggles for each field, loading, error, success.

**Validation**:
- All fields required
- New password min 8 chars
- Confirm must match new

**API**: POST `/api/profile/change-password` with `{ currentPassword, newPassword }`

**shadcn/ui**: Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Label, Button

**Accessibility**: `autoComplete` attributes on password fields, toggle visibility buttons with `tabIndex={-1}`.

---

### 2.8 DeleteAccountSection

**File**: `src/components/profile/DeleteAccountSection.tsx`
**Type**: Client Component

**State**: `isOpen` (dialog), `isDeleting`, `pendingDeletion` (timestamp)

**Two modes**:
1. **Normal**: Shows destructive zone with "Delete Account" button -> opens Dialog with warnings -> POST `/api/profile/delete` -> redirects to `/en` after 1.5s.
2. **Pending deletion**: Shows `DeletionCountdownBanner` with 30-day countdown and cancel option.

**API**:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/user/profile` | Check `deletion_requested_at` |
| POST | `/api/profile/delete` | Request deletion |

---

### 2.9 DeletionCountdownBanner

**File**: `src/components/profile/DeletionCountdownBanner.tsx`
**Type**: Client Component

**Props**: `{ deletionRequestedAt: string, onCancelled: () => void }`

Calculates days remaining (30-day grace period). Shows formatted deletion date. Cancel button calls POST `/api/profile/cancel-deletion`.

---

### 2.10 Profile Component Tree (ASCII)

```
ProfilePage (Server)
|
+-- Card: Profile Info
|   +-- ProfileForm (Client)
|       +-- Avatar + AvatarImage + AvatarFallback
|       +-- Input (name, phone, email)
|       +-- Select (language, currency)
|       +-- Switch x3 (email/push/sms notifications)
|       +-- [Email Change Inline Form]
|           +-- Input (new email)
|           +-- Input (current password)
|
+-- Card: Shipping Addresses
|   +-- ShippingAddressList (Client)
|       +-- Card per address (label, default badge, full address, edit/delete/set-default buttons)
|       +-- AddressForm (Client) [conditional: add/edit mode]
|           +-- Input x8 (label, name, street1, street2, city, state, zip, country)
|           +-- Input (phone)
|           +-- Checkbox (is_default)
|
+-- PaymentMethodsList (Client)
|   +-- Card per payment method (brand icon, last4, expiry)
|   +-- AlertDialog (remove confirmation)
|
+-- ChangePasswordForm (Client)
|   +-- Input x3 (current, new, confirm) with eye toggles
|
+-- DeleteAccountSection (Client)
    +-- Dialog (confirmation with warnings)
    +-- DeletionCountdownBanner (conditional: pending state)
```

---

## 3. Orders Pages & Components

### 3.1 Orders List Page

**File**: `src/app/[locale]/(app)/orders/page.tsx`
**Type**: Server Component
**Route**: `/{locale}/orders`

Thin wrapper that renders `<OrdersView locale={locale} />`.

---

### 3.2 OrdersView

**File**: `src/components/orders/OrdersView.tsx`
**Type**: Client Component

**Props**: `{ locale: string }`

**State**: `orders: Order[]`, `loading`, `error`

**Interface**:
```ts
interface Order {
  id: string
  status: string
  total_cents: number
  currency: string
  created_at: string
  paid_at: string | null
  shipped_at: string | null
  tracking_number: string | null
  customer_email: string | null
}
```

**API**: GET `/api/orders` -- fetches on mount when authenticated.

**Status Badge Mapping**:
| Status | Badge Variant |
|--------|---------------|
| paid, submitted | default (primary) |
| in_production, shipped, delivered | secondary |
| cancelled, refunded | destructive |

**States rendered**:
1. Loading skeleton (3 Card placeholders)
2. Not authenticated (login required CTA)
3. Unauthorized (error state)
4. Fetch failed (retry button)
5. Empty orders (start shopping CTA)
6. Orders list (Card per order with icon, number, date, status badge, total, tracking, "View Details" link)

**User Flow**: List -> Click "View Details" -> navigates to `/{locale}/orders/{id}`

**Responsive**: `flex-col md:flex-row` for order header, `sm:flex-row` for footer with total/tracking/button.

---

### 3.3 Order Detail Page

**File**: `src/app/[locale]/(app)/orders/[id]/page.tsx`
**Type**: Server Component
**Route**: `/{locale}/orders/{id}`

Thin wrapper rendering `<OrderDetailView locale={locale} orderId={id} />`.

---

### 3.4 OrderDetailView

**File**: `src/components/orders/OrderDetailView.tsx`
**Type**: Client Component

**Props**: `{ locale: string; orderId: string }`

**State**:
- `order: Order | null`, `orderItems: OrderItem[]`, `returnRequests: ReturnRequest[]`
- `loading`, `error`
- `returnDialogOpen`, `returnReason`, `submittingReturn`
- `downloadingInvoice`

**Interfaces**:
```ts
interface OrderItem {
  id: string; product_id: string; variant_id: string; quantity: number;
  price_cents: number; product_title: string; variant_title: string;
}

interface ReturnRequest {
  id: string; reason: string; status: string; created_at: string;
  refund_amount_cents: number; refund_currency: string;
}
```

**API Calls**:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/orders/{orderId}` | Fetch order + items |
| GET | `/api/orders/{orderId}/returns` | Fetch return requests |
| POST | `/api/orders/{orderId}/returns` | Submit return request |
| GET | `/api/orders/{orderId}/invoice` | Download invoice |

**User Flows**:
1. **View order**: Back button to orders list, header with order number + date + status badge.
2. **Download invoice**: Generates HTML invoice from API data, triggers browser download as `.html` file.
3. **Request return**: Opens Dialog with Textarea for reason (min 10 chars). Available when status is paid/submitted/in_production/shipped/delivered AND no existing return request.
4. **View return requests**: Shows Badge with return status (pending/approved/processing/completed/rejected), reason, date, refund amount.
5. **Tracking**: Shows tracking number, carrier, "Track Package" external link.
6. **Payment method**: Card or crypto display with appropriate icons.

**Layout**: 3-column grid on `lg:` -- 2 cols for items/returns, 1 col for shipping/payment/tracking sidebar.

**GAP**: Invoice downloads as HTML, not PDF. No product images in order items (only Package icon placeholder).

---

### 3.5 Orders Component Tree

```
OrdersPage (Server)
+-- OrdersView (Client)
    +-- Card per order
        +-- Package icon + order number + date
        +-- Badge (status)
        +-- Total + tracking + "View Details" link

OrderDetailPage (Server)
+-- OrderDetailView (Client)
    +-- Back button (Link to /orders)
    +-- Header: order number, date, status Badge, Download Invoice Button
    +-- Return Request Dialog (conditional)
    |   +-- Textarea (reason)
    +-- Grid (lg:3-col)
        +-- Col 1-2: Order Items Card
        |   +-- Per item: placeholder icon, title, variant, qty, price
        |   +-- Total
        +-- Col 1-2: Return Requests Card (conditional)
        |   +-- Per return: status Badge, date, reason, refund amount
        +-- Col 3: Shipping Address Card
        +-- Col 3: Payment Method Card
        +-- Col 3: Tracking Card (conditional)
```

---

## 4. Cart Components

### 4.1 Cart Page

**File**: `src/app/[locale]/(app)/cart/page.tsx`
**Type**: Server Component
**Route**: `/{locale}/cart`

Thin wrapper rendering `<CartView locale={locale} />`.

---

### 4.2 CartView

**File**: `src/components/cart/CartView.tsx`
**Type**: Client Component

**Props**: `{ locale: string }`

**State**:
- `editingItemId`, `editSize`, `editColor`, `savingVariant` -- variant editing
- `updatingItems: Set<string>` -- items currently being updated (for disabling buttons)
- `expandedItems: Set<string>` -- personalization detail expansion
- `couponCode`, `appliedCoupon`, `applyingCoupon` -- coupon system
- `zipCode`, `shippingEstimate`, `calculatingShipping` -- shipping calculator

**API Calls**:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| PATCH | `/api/cart` | Update quantity (body: { item_id, quantity }) |
| POST | `/api/cart` | Re-add item (undo remove) |
| POST | `/api/coupons/validate` | Validate coupon code |
| POST | `/api/cart/shipping-estimate` | Calculate shipping |

**Key Features**:
1. **Product image** with link to product page
2. **Variant editing**: Click pencil icon to switch size/color via Select dropdowns (uses `availableVariants` from cart context)
3. **Personalization display**: Expandable section showing text, font, color swatch, size, position, surcharge
4. **Quantity controls**: +/- buttons with max cap (`STORE_DEFAULTS.maxCartQuantity`), Trash icon for remove
5. **Undo remove**: Toast with undo action that re-adds the item via POST
6. **Coupon system**: Input + apply button, persists to sessionStorage, shows discount
7. **Shipping estimate**: Zip code input, uses locale-based country code
8. **Free shipping progress bar**: Progress component with threshold from `STORE_DEFAULTS.freeShippingThreshold`
9. **Order summary sidebar**: Subtotal, discount, shipping, total
10. **Crypto acceptance badge**: Conditional on env var
11. **Checkout CTAs**: Authenticated -> "Proceed to Checkout"; Guest -> "Guest Checkout" + "Sign In" buttons

**Layout**: 3-column grid on `lg:` -- 2 cols items, 1 col sticky summary sidebar.

**Responsive**: `size-24 md:size-32` for product images, full-width on mobile.

---

### 4.3 CartCrossSell

**File**: `src/components/cart/CartCrossSell.tsx`
**Type**: Client Component

**Props**: `{ productId: string }`

**API**: GET `/api/products/{productId}/cross-sell`

Renders a "You might also like" grid with up to 4 `ProductCard` components. Shown below the cart items list. Silently fails if API errors (non-critical feature).

**Layout**: `grid-cols-2 md:grid-cols-4`

---

### 4.4 useCart Hook (Context Provider)

**File**: `src/hooks/useCart.tsx`
**Type**: React Context + Provider

**Interface**:
```ts
interface CartContextType {
  items: CartItem[]
  itemCount: number
  loading: boolean
  availableVariants: AvailableVariants
  addToCart: (productId, quantity, variant?, title?, price?, personalizationId?, compositionId?) => Promise<void>
  removeFromCart: (itemId) => Promise<void>
  updateQuantity: (itemId, quantity) => Promise<void>
  updateVariant: (itemId, variant) => Promise<void>
  clearCart: () => Promise<void>
  refreshCart: () => Promise<void>
}

interface CartItem {
  id: string; product_id: string; variant_id?: string; quantity: number;
  product_title: string; product_price: number; product_image?: string;
  product_currency?: string; unavailable?: boolean;
  variant_details?: { size?: string; color?: string };
  personalization_id?: string;
  personalization?: { text?: string; font?: string; fontColor?: string;
                      fontSize?: string; position?: string; preview?: string | null;
                      surcharge?: number | null; };
}
```

**State Management Pattern**:
- Context provided at `[locale]/providers.tsx` level
- Fetches cart on mount and when `user` changes (from useAuth)
- **Optimistic updates** for `removeFromCart` and `updateQuantity` with rollback on error
- `addToCart` and `updateVariant` are non-optimistic (wait for server, then refreshCart)
- `clearCart` calls DELETE `/api/cart`
- Error handling via `toast()` from sonner

**API Calls**:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cart` | Fetch cart items + available variants |
| POST | `/api/cart` | Add item |
| PATCH | `/api/cart` | Update quantity or variant |
| DELETE | `/api/cart` | Clear all items |

**Cross-Tab Sync**: NOT implemented for cart (unlike auth which uses localStorage events). Cart state is per-tab only.

---

### 4.5 Cart Component Tree

```
CartPage (Server)
+-- CartView (Client)
    +-- Loading: Loader2 spinner
    +-- Empty: Card with CTA to shop
    +-- Populated: Grid (lg:3-col)
        +-- Col 1-2: Card
        |   +-- Per item:
        |   |   +-- Image (Link to product)
        |   |   +-- Title (Link to product)
        |   |   +-- [Variant Editing Mode] Select x2 (size, color) + Save/Cancel
        |   |   +-- [Display Mode] Badge (size) + Badge (color) + Edit pencil
        |   |   +-- Badge (unavailable) -- if item no longer available
        |   |   +-- Badge (personalized) + expandable details
        |   |   +-- Price per unit
        |   |   +-- Quantity: - / count / + buttons
        |   |   +-- Remove button (Trash2)
        |   |   +-- Item total
        |   |   +-- Separator
        |   +-- CartCrossSell (productId of first item)
        |
        +-- Col 3: Sticky Card (Order Summary)
            +-- Coupon Input + Apply
            +-- [Applied Coupon] success banner + Remove
            +-- Shipping Estimate (zip code input + Calculate)
            +-- [Shipping Result] cost + delivery estimate + free threshold hint
            +-- Free Shipping Progress Bar
            +-- Subtotal / Discount / Shipping / Total
            +-- [Crypto Badge] (conditional)
            +-- [Authenticated] "Proceed to Checkout" button
            +-- [Guest] "Guest Checkout" + divider + "Sign In" button
```

---

## 5. Checkout Flow

### 5.1 Checkout Page

**File**: `src/app/[locale]/(focused)/checkout/page.tsx`
**Type**: Server Component (in `(focused)` route group -- no StorefrontLayout)
**Route**: `/{locale}/checkout`

Renders `<CheckoutView locale={locale} />`.

---

### 5.2 CheckoutView

**File**: `src/components/checkout/CheckoutView.tsx`
**Type**: Client Component

**Props**: `{ locale: string }`

**State**:
- `addresses: ShippingAddress[]`, `loadingAddresses`, `selectedAddressId`, `showNewAddressForm`
- `calculatedTax`, `calculatingTax`
- `creatingSession`
- `guestEmail`, `guestEmailError`
- `giftMessageEnabled`, `giftMessageText`
- `appliedCoupon` -- restored from sessionStorage
- `exitIntentTriggered` -- from `useExitIntent` hook

**API Calls**:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/shipping-addresses` | Fetch saved addresses (authenticated) |
| POST | `/api/shipping-addresses` | Save new address |
| POST | `/api/checkout/calculate-tax` | Calculate tax based on address |
| POST | `/api/checkout/create-session` | Create Stripe Checkout session |

**Stripe Integration**:
- Calls `/api/checkout/create-session` with cart items, locale, currency, optional customerEmail (guest), gift_message, couponCode.
- On success, redirects to `data.url` (Stripe hosted checkout page).
- On 409, shows toast with unavailable item names (variant check).

**User Flows**:

1. **Authenticated user**:
   - Sees saved addresses as selectable cards (primary border when selected, Check icon)
   - Can add new address inline via AddressForm
   - Auto-selects default address
   - Tax calculated automatically when address selected

2. **Guest user**:
   - Email input field with validation
   - No saved addresses (shipping entered at Stripe)

3. **Gift message**: Toggle Switch to enable, Textarea (200 char max).

4. **Exit intent**: AlertDialog appears when mouse leaves viewport (desktop only, once per session).

5. **Payment**: "Proceed to Payment" button -> creates Stripe session -> redirect.

**Layout**: 3-column grid on `lg:` -- 2 cols for addresses/payment/trust badges, 1 col for sticky order summary.

**Trust Elements**: Trust badges (shipping, returns, secure), payment method logos (Visa, MC, Amex, PayPal as SVGs).

---

### 5.3 CheckoutBreadcrumb

**File**: `src/components/checkout/CheckoutBreadcrumb.tsx`
**Type**: Client Component

**Props**: `{ currentStep: 'cart' | 'shipping' | 'payment' | 'confirmation' }`

Visual progress indicator with 4 steps. Completed steps show Check icon, active step shows number with primary border, future steps are muted. Connector lines between steps on `md:`.

**Accessibility**: `<nav aria-label="Checkout progress">`, `<ol>` semantic list.

---

### 5.4 AddressForm (Checkout variant)

**File**: `src/components/checkout/AddressForm.tsx`
**Type**: Client Component

**Props**: `{ onSubmit: (address: AddressFormData) => Promise<void>; onCancel: () => void }`

**Differences from Profile AddressForm**:
- Standalone form with its own validation (all required fields marked with *)
- Uses `LOCALE_COUNTRY` for default country code
- Different visual treatment (border-2 border-primary, bg-primary/5)
- Does not handle edit mode (create-only)
- Profile version uses Checkbox for is_default; checkout version does not expose is_default

**GAP**: Two separate AddressForm components with different interfaces. Should be unified.

---

### 5.5 Checkout Success Page

**File**: `src/app/[locale]/(focused)/checkout/success/page.tsx`
**Type**: Server Component
**Route**: `/{locale}/checkout/success?session_id=...`

Fetches Stripe checkout session details server-side via `getCheckoutSession(session_id)`.

**Renders**:
- CartClearer (client side-effect component)
- Success icon (CheckCircle in success/10 circle)
- Success title + description
- Order details card (if session paid): customer email, line items, total, payment status
- CTA buttons: "Continue Shopping" + "View Orders"

---

### 5.6 CartClearer

**File**: `src/app/[locale]/(focused)/checkout/success/CartClearer.tsx`
**Type**: Client Component (side-effect only, renders null)

On mount, if cart has items and hasn't already cleared, calls DELETE `/api/cart` then `refreshCart()`. Uses `useRef` to prevent double-clear.

**Design Decision**: Clears silently (no toast) to avoid confusing users after successful payment.

---

### 5.7 Checkout Cancel Page

**File**: `src/app/[locale]/(focused)/checkout/cancel/page.tsx`
**Type**: Server Component
**Route**: `/{locale}/checkout/cancel`

Static page with XCircle icon, "Payment Cancelled" message, "Return to Cart" and "Continue Shopping" buttons.

**GAP**: Text is hardcoded in English, not using i18n translations.

---

### 5.8 Checkout Component Tree

```
CheckoutPage (Server, focused layout)
+-- CheckoutView (Client)
    +-- Loading: skeleton grid
    +-- Empty cart: ShoppingCart icon + CTA
    +-- Populated:
        +-- Back to Cart button (ArrowLeft)
        +-- CheckoutBreadcrumb (currentStep="shipping")
        +-- Grid (lg:3-col)
            +-- Col 1-2: Shipping Card
            |   +-- [Authenticated] Address list (selectable cards)
            |   |   +-- Per address: label, name, street, city, country, phone
            |   |   +-- Default Badge, Check icon on selected
            |   |   +-- "Add New Address" button -> AddressForm
            |   +-- [Guest] Email input + validation
            +-- Col 1-2: Payment Card (info only)
            |   +-- Lock icon + redirect message
            |   +-- Shield icon + secure badge
            +-- Col 1-2: Trust Badges row
            +-- Col 1-2: Payment method logos
            +-- Col 3: Sticky Order Summary Card
                +-- Items count
                +-- Scrollable item list (image/title/variant/personalization/qty/price)
                +-- Subtotal / Discount / Shipping / Tax / Total
                +-- Gift Message toggle + Textarea
                +-- "Proceed to Payment" button
    +-- Exit Intent AlertDialog

CheckoutSuccessPage (Server, focused layout)
+-- CartClearer (Client, renders null)
+-- Success icon + message
+-- Order details Card (if session data available)
+-- Action buttons

CheckoutCancelPage (Server, focused layout)
+-- Cancel icon + message
+-- Action buttons
```

---

## 6. Wishlist Pages

### 6.1 Wishlist Page

**File**: `src/app/[locale]/(app)/wishlist/page.tsx`
**Type**: Client Component (`'use client'`)
**Route**: `/{locale}/wishlist`

**Two distinct modes**:

#### Guest Mode
- Reads wishlist items from `useWishlist()` hook (backed by localStorage)
- Fetches product details for IDs via GET `/api/products?ids=...`
- Shows promo banner to sign up (dismissible with X button)
- Renders `ProductGrid` with fetched products
- Empty state: Heart icon + "Browse Products" CTA

#### Authenticated Mode
- Fetches wishlists from GET `/api/wishlist` (supports multiple named wishlists)
- Each wishlist is a Card with name, public badge, share/add-all-to-cart buttons
- Products rendered via `ProductCard` components in `.neu-grid` CSS class
- Can create new wishlists via Dialog (Input + Create button)
- Can share wishlists via Dialog (shows URL + Copy button)

**API Calls**:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/wishlist` | Fetch wishlists (auth mode) |
| POST | `/api/wishlist` | Create new wishlist |
| POST | `/api/wishlist/share` | Generate share URL |
| GET | `/api/products?ids=...` | Fetch products for guest wishlist |
| POST | `/api/cart` | Add all items to cart |

**Dialogs**: Create Wishlist Dialog, Share Wishlist Dialog (both use shadcn Dialog).

---

### 6.2 Shared Wishlist Page

**File**: `src/app/[locale]/(app)/wishlist/shared/[token]/page.tsx`
**Type**: Client Component
**Route**: `/{locale}/wishlist/shared/{token}`

Fetches shared wishlist via GET `/api/wishlist/shared/{token}`. Shows wishlist name with "Shared Wishlist" badge, item count, product grid with Add to Cart buttons.

**Error states**: 404 (not found/no longer public), generic error.

**GAP**: Links to `/shop/{id}` without locale prefix. Product images use `Image` with fill but hard-coded placeholder path `/placeholder.png`.

---

### 6.3 Wishlist Loading

**File**: `src/app/[locale]/(app)/wishlist/loading.tsx`
**Type**: Server Component

Full skeleton layout matching the wishlist page: header, banner, action buttons, 8 product card skeletons in grid.

---

### 6.4 useWishlist Hook

**File**: `src/hooks/useWishlist.tsx`
**Type**: React Context + Provider

**Interface**:
```ts
interface WishlistContextType {
  wishlistItems: string[]            // product_ids
  loading: boolean
  isWishlisted: (productId: string) => boolean
  toggleWishlist: (productId: string) => Promise<void>
  refreshWishlist: () => Promise<void>
  guestItemCount: number
}
```

**Dual-mode architecture**:

1. **Guest mode**: localStorage (`pod-guest-wishlist`), max 50 items.
   - `toggleWishlist` adds/removes from local state + localStorage
   - Immediate (no API calls)

2. **Authenticated mode**: Server-backed via API.
   - `toggleWishlist` checks if item exists -> DELETE or POST
   - Optimistic remove (rollback on error) for deletions
   - Creates default wishlist on first add if none exists

3. **Guest-to-server sync**: On login, calls POST `/api/wishlist/sync` with local items, then clears localStorage.

**API Calls**:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/wishlist` | Fetch wishlists |
| POST | `/api/wishlist` | Create wishlist |
| POST | `/api/wishlist/items` | Add item |
| DELETE | `/api/wishlist/items?item_id=...` | Remove item |
| POST | `/api/wishlist/sync` | Sync guest -> server |

---

## 7. Hooks & State Management

### 7.1 useAuth

**File**: `src/hooks/useAuth.ts`
**Type**: Client hook (NOT a context -- direct useState per usage)

**Interface**:
```ts
interface AuthState {
  user: { id: string; email: string; name?: string; locale?: string; currency?: string } | null
  authenticated: boolean
  loading: boolean
  error: string | null
}
```

**Features**:
- **Session check**: GET `/api/auth/session` on mount, every 5 minutes.
- **Cross-tab sync**: Uses `localStorage` `storage` events with key `pod-auth-sync`. Broadcasts login/logout/session-check events. Other tabs re-check session or clear state.
- **Logout**: POST `/api/auth/logout`, broadcasts to other tabs.

**IMPORTANT**: This is NOT a context provider. Each component using `useAuth()` maintains independent state. The cross-tab sync mechanism keeps them in sync. This means there is NO single source of truth for auth state -- each hook instance fetches independently.

---

### 7.2 useProductCache

**File**: `src/hooks/useProductCache.ts`
**Type**: Client hook

Uses IndexedDB (via `@/lib/idb-cache`) for offline product caching. On mount:
1. Load from IndexedDB cache
2. Fetch fresh from API (`/api/products?limit=100&locale=...`)
3. Update IndexedDB with fresh data

Returns `{ cachedProducts, isLoadingCache }`.

---

### 7.3 useRecentlyViewed

**File**: `src/hooks/useRecentlyViewed.ts`
**Type**: Client hook

**Storage**: localStorage key `pod_recently_viewed`, max 8 items.

**Interface**:
```ts
interface RecentlyViewedProduct {
  id: string; title: string; price: number; currency: string;
  image: string | null; compareAtPrice?: number;
  colorImages?: Record<string, string>; viewedAt: number;
}
```

**Functions**: `trackView(product)` -- adds to front, deduplicates. `getRecentlyViewed(excludeId?)` -- filter by exclusion.

---

### 7.4 useEngagement

**File**: `src/hooks/useEngagement.ts`
**Type**: Client hook

**State**: `showAuthWall`, `showUpgrade`, reasons for each, `usage: UsageStatus`.

**Interface**:
```ts
interface UsageStatus {
  tier: 'anonymous' | 'free' | 'premium'
  usage: Record<string, { used: number; limit: number; remaining: number }>
  credits?: { balance: number; canBuyMore: boolean }
  subscription?: { status: string; periodEnd: string | null }
}
```

**API**: GET `/api/usage/status` -- fetched on mount and when user changes.

**`checkAction(action)`**: Returns boolean. Shows AuthWallModal if anonymous tries non-chat action. Shows upgrade modal if free user exceeds limits. Fails open if API check fails.

---

### 7.5 useProductDetail

**File**: `src/hooks/useProductDetail.ts`
**Type**: Client hook

**Caching**: Uses `product-client-cache` (in-memory, 5-min TTL). Deduplicates -- won't re-fetch same productId.

**API**: GET `/api/products/{productId}?locale=...`

Returns `{ product: ProductDetail | null, loading, error }`.

---

### 7.6 useExitIntent

**File**: `src/hooks/useExitIntent.ts`
**Type**: Client hook

Detects mouse leaving viewport (clientY < 10) on desktop only. Shows once per session via sessionStorage flag `pod_exit_intent_shown`. Returns `{ triggered, dismiss }`.

---

### 7.7 Hook Dependency Graph

```
useAuth (independent per instance, cross-tab sync via localStorage)
  |
  +-- useCart (CartProvider context)
  |     +-- depends on useAuth.user for cart refresh trigger
  |
  +-- useWishlist (WishlistProvider context)
  |     +-- depends on useAuth.user for mode switching (guest vs server)
  |     +-- syncs guest wishlist to server on login
  |
  +-- useEngagement (independent hook)
  |     +-- depends on useAuth.user for tier detection
  |     +-- gates actions based on usage limits
  |
  +-- useProductDetail (independent hook)
  |     +-- no auth dependency
  |     +-- uses product-client-cache (in-memory)
  |
  +-- useProductCache (independent hook)
  |     +-- no auth dependency
  |     +-- uses IndexedDB via idb-cache
  |
  +-- useRecentlyViewed (independent hook)
  |     +-- no auth dependency
  |     +-- localStorage only
  |
  +-- useExitIntent (independent hook)
        +-- no auth dependency
        +-- sessionStorage flag
```

---

## 8. Storefront Integration

### 8.1 StorefrontLayout

**File**: `src/components/storefront/StorefrontLayout.tsx`
**Type**: Client Component

**Architecture**: App shell for all `(app)` route group pages. Inspired by claude.ai layout.

**Provider Stack**:
```
StorefrontProvider
  ChatMessageProvider
    StorefrontShell
```

**Regions**:
| Region | Desktop | Mobile |
|--------|---------|--------|
| Left Sidebar (240px) | `<aside>` visible, collapsible | `<Sheet>` drawer |
| Header (56px) | Fixed top bar | Same + hamburger menu |
| Content (flex-1) | Children + Footer | Same |
| Detail Panel (340px) | `<aside>` right | Full-screen overlay |

**Chat handling**: ChatArea always mounted (preserves SSE/state), toggled between `flex-1` and `h-0 overflow-hidden pointer-events-none` based on route.

**Accessibility**: Skip navigation link (`#main-content`), `<main>` with id, Sheet with `sr-only` SheetTitle.

---

### 8.2 StorefrontSidebar

**File**: `src/components/storefront/StorefrontSidebar.tsx`
**Type**: Client Component

**Props**: `{ onNavigate?: () => void; onCollapse?: () => void }`

**Sections**:
1. Logo (BrandMark) + collapse button
2. Navigation links: Chat, Shop, New Arrivals, Favorites (wishlist), Orders
3. Cart link with item count Badge
4. UsageMeter component
5. Recommended products (top 6 by rating, shuffled, pick 2 -- refreshes every 5 min)
6. Popular Today (top 4 by review_count, pick 1 using day-of-year as seed)
7. PodClaw status footer (green dot + "AI Store Manager Active")

**Active state**: Exact path match for most links; for URLs with query params, checks all specified params match.

**Product click**: Sets `selectedProduct` in StorefrontContext AND adds to artifact system (opens DetailPanel).

---

### 8.3 StorefrontHeader

**File**: `src/components/storefront/StorefrontHeader.tsx`
**Type**: Client Component

**Props**: `{ onToggleSidebar?: () => void; isSidebarCollapsed?: boolean; onToggleDesktopSidebar?: () => void }`

**Sections**:
1. **Left**: Mobile sidebar toggle, expand sidebar button (when collapsed), Chat/Shop nav links (hidden on mobile)
2. **Center**: Search input (rounded-full, hidden below lg:)
3. **Right**: Mobile search toggle, Notifications (bell + unread badge), Cart (link + badge), Theme toggle, Locale switcher dropdown (EN/ES/DE with flags), User avatar dropdown or Login button

**User dropdown menu**: Shows name + email, Profile link, Logout.

**Mobile search**: Full-screen overlay with input + cancel button + backdrop dismiss.

**Search**: Navigates to `/{locale}/shop?q=...`

---

### 8.4 DetailPanel

**File**: `src/components/storefront/DetailPanel.tsx`
**Type**: Client Component

**Props**: `{ productId?: string; onClose: () => void; onAskAbout?: (question: string) => void }`

**Two render modes**:

1. **Artifact system** (primary): Renders tabs for multiple artifacts (product, design, comparison, cart, order, other). Each tab is closable with X. Uses `Tabs` from shadcn/ui.

2. **Backward-compat** (fallback): Fetches single product by `productId` prop.

**ProductView** (inner component, memoized):
- `ProductImageGallery` with variant-filtered images
- Title, star rating, price (supports compare-at-price with discount badge)
- Description
- `ProductSpecifications` (materials, print technique, country, care, safety)
- `VariantSelector` (size + color)
- `QuantitySelector`
- Footer actions: Add to Cart, Personalize (icon), Wishlist heart, "Ask about product" (chat integration)

**ArtifactContent** (inner component, memoized):
- Product artifacts: fetches product detail, renders ProductView
- Design artifacts: shows image + prompt
- Other artifacts: JSON dump

---

### 8.5 StorefrontContext

**File**: `src/components/storefront/StorefrontContext.tsx`
**Type**: React Context + Provider

**Interface**:
```ts
interface Artifact {
  id: string
  type: 'product' | 'design' | 'comparison' | 'cart' | 'order' | 'other'
  title: string
  data: any
}

interface StorefrontContextType {
  selectedProduct: string | null
  setSelectedProduct: (id: string | null) => void
  artifacts: Artifact[]
  addArtifact: (artifact: Artifact) => void
  removeArtifact: (id: string) => void
  clearArtifacts: () => void
  activeArtifactId: string | null
  setActiveArtifactId: (id: string | null) => void
}
```

**Behavior**: `addArtifact` upserts (updates if exists, appends if new), sets as active. `removeArtifact` removes and clears activeArtifactId if it was the active one.

---

## 9. Engagement & Conversion Components

### 9.1 AuthWallModal

**File**: `src/components/engagement/AuthWallModal.tsx`
**Type**: Client Component

**Props**:
```ts
interface AuthWallModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason?: string
  variant?: 'subtle' | 'wall'
}
```

**Two variants**:
- **subtle** (default): Smaller dialog (`sm:max-w-md`), title + reason, 5 benefits list, Sign Up + Log In buttons, "Continue as Guest" dismiss.
- **wall**: Larger dialog (`sm:max-w-2xl`), brand mark, larger title with count, benefits in muted background, premium teaser section with link to pricing, "Continue Browsing" dismiss.

**Benefits**: 5 items from `engagement.authWall` i18n namespace with Check icons.

---

### 9.2 InstallPrompt

**File**: `src/components/engagement/InstallPrompt.tsx`
**Type**: Client Component

**Behavior**:
- Tracks visits in localStorage (`pod-visit-count`)
- Shows after 3+ visits AND if `beforeinstallprompt` event fires
- Dismisses for 7 days (stored in localStorage `pod-install-dismissed`)
- Checks if already in standalone mode
- Fixed bottom-left (full-width on mobile, 320px on md:)

**Actions**: "Install" button (triggers native prompt), "Not now" dismiss, X close.

---

### 9.3 WelcomePopup

**File**: `src/components/engagement/WelcomePopup.tsx`
**Type**: Client Component (dynamically imported, SSR=false)

**Trigger**: Shows on `/chat` route for unauthenticated users who haven't dismissed in current session (sessionStorage `pod-welcome-seen`).

**Content**: Brand mark, welcome title (with brand name), description, 3 benefits (Check icons), subscription teaser, Sign Up + Log In buttons, "Continue as Guest" text button.

**Uses**: Dialog from shadcn/ui, BrandMark component, BRAND config.

---

### 9.4 Engagement Integration Points

```
StorefrontLayout
  +-- InstallPrompt (always rendered, self-manages visibility)
  +-- WelcomePopup (only on /chat, dynamically imported)

useEngagement hook (used by ChatArea and design components)
  +-- checkAction(action) --> may trigger:
      +-- AuthWallModal (variant='subtle' or 'wall')
      +-- Upgrade modal (not a separate component -- state returned to consumer)
```

---

## 10. Cross-Cutting Concerns

### 10.1 State Persistence Summary

| Data | Storage | Sync Mechanism |
|------|---------|----------------|
| Auth session | Server cookie | Cross-tab via localStorage events (`pod-auth-sync`) |
| Cart | Server (Supabase) | Per-tab fetch, refreshCart() after mutations |
| Wishlist (auth) | Server (Supabase) | Per-tab fetch, refreshWishlist() after mutations |
| Wishlist (guest) | localStorage (`pod-guest-wishlist`) | Per-tab only; syncs to server on login |
| Recently viewed | localStorage (`pod_recently_viewed`) | Per-tab only |
| Applied coupon | sessionStorage (`pod_applied_coupon`) | Per-tab, same session; shared between cart and checkout |
| Visit count | localStorage (`pod-visit-count`) | Cross-tab (same origin) |
| Install dismiss | localStorage (`pod-install-dismissed`) | Cross-tab |
| Welcome seen | sessionStorage (`pod-welcome-seen`) | Per-tab, same session |
| Exit intent shown | sessionStorage (`pod_exit_intent_shown`) | Per-tab, same session |
| Product cache | IndexedDB (idb-cache) | Cross-tab (same origin) |
| Product detail cache | In-memory (Map) | Per-tab only, 5-min TTL |
| Sidebar collapsed | localStorage (useSidebarCollapsed hook) | Cross-tab |

### 10.2 i18n Strategy

All user-facing text uses `next-intl`:
- Server pages: `getTranslations({ locale, namespace })`
- Client components: `useTranslations(namespace)`
- Namespaces: `Profile`, `Orders`, `Cart`, `Checkout`, `storefront`, `navigation`, `wishlist`, `engagement.authWall`, `engagement.welcome`, `common`

**GAP**: Checkout cancel page has hardcoded English text. Some toast messages in useCart are hardcoded English ("Added to cart", "Removed from cart", etc.).

### 10.3 Currency Handling

- `formatPrice(amount, locale, currency)` from `@/lib/currency`
- User currency sourced from: `user?.currency` || `cartItems[0]?.product_currency` || `STORE_DEFAULTS.currency`
- Supported: USD, EUR (selectable in profile)

### 10.4 shadcn/ui Component Usage Audit

| Component | Used In |
|-----------|---------|
| Button | All components |
| Card, CardHeader, CardTitle, CardDescription, CardContent | Profile, Orders, Cart, Checkout, Wishlist |
| Input | ProfileForm, AddressForm, Cart (coupon/zip), Checkout (email), Wishlist (name) |
| Label | ProfileForm, AddressForm, ChangePasswordForm, Checkout |
| Select, SelectTrigger, SelectContent, SelectItem, SelectValue | ProfileForm (language/currency), CartView (variant editing) |
| Switch | ProfileForm (notifications), CheckoutView (gift message) |
| Textarea | OrderDetailView (return reason), CheckoutView (gift message) |
| Checkbox | Profile AddressForm (is_default) |
| Badge | Throughout (status, variants, personalization, cart count, public) |
| Separator | Throughout |
| Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger | Wishlist (create/share), OrderDetail (return), DeleteAccount, AuthWall, Welcome |
| AlertDialog, AlertDialogContent, etc. | PaymentMethodsList (remove), CheckoutView (exit intent) |
| Avatar, AvatarImage, AvatarFallback | ProfileForm, StorefrontHeader |
| DropdownMenu, DropdownMenuContent, etc. | StorefrontHeader (user menu, locale switcher) |
| Sheet, SheetContent, SheetTitle | StorefrontLayout (mobile sidebar) |
| Tabs, TabsList, TabsTrigger, TabsContent | DetailPanel (artifact tabs) |
| Progress | CartView (free shipping progress bar) |
| Skeleton | Profile loading, Wishlist loading |
| Tooltip | NOT used in audited components |

**Violation found**: ShippingAddressList uses `window.confirm()` for delete confirmation instead of `AlertDialog`.

### 10.5 Responsive Breakpoint Usage

| Pattern | Components |
|---------|------------|
| Mobile-first defaults (no prefix) | All |
| `md:` (768px) | Profile form grids, order header, cart images, checkout address grid |
| `lg:` (1024px) | Cart 3-col grid, Checkout 3-col grid, StorefrontLayout sidebar visibility |
| `sm:` (640px) | Order footer layout, checkout action buttons, StorefrontHeader notifications |

---

## 11. Gaps & Missing Features

### Critical

| ID | Gap | Location | Impact |
|----|-----|----------|--------|
| G1 | **No product images in order items** | OrderDetailView | Users see Package icon placeholder instead of actual product thumbnails |
| G2 | **Invoice is HTML, not PDF** | OrderDetailView `handleDownloadInvoice` | Unprofessional invoice format; PDF expected by EU regulations |
| G3 | **Hardcoded English in checkout cancel page** | `checkout/cancel/page.tsx` | Breaks i18n for ES/DE users |
| G4 | **Hardcoded English in useCart toasts** | `useCart.tsx` lines 111, 113, 121, 148, 183, 228 | Toast messages not localized |
| G5 | **Duplicate AddressForm components** | `checkout/AddressForm.tsx` vs `profile/AddressForm.tsx` | Different interfaces, different validation, maintenance burden |

### Moderate

| ID | Gap | Location | Impact |
|----|-----|----------|--------|
| G6 | `window.confirm()` used for delete | ShippingAddressList line 53 | Inconsistent with rest of app using AlertDialog; not themeable |
| G7 | **No cross-tab cart sync** | useCart.tsx | Cart changes in one tab not reflected in others |
| G8 | **useAuth is not a context** | useAuth.ts | Each usage creates independent state + API call; redundant network requests |
| G9 | **Add Payment Method disabled** | PaymentMethodsList line 170 | Button exists but is disabled; no flow to add cards outside checkout |
| G10 | **Shared wishlist links missing locale** | SharedWishlistPage line 139, 186 | Links to `/shop/{id}` and `/en/shop` instead of `/{locale}/shop/{id}` |
| G11 | **No order cancellation from order detail** | OrderDetailView | Users can request returns but not cancel pending orders |
| G12 | **No order item product links** | OrderDetailView | Order items show title but are not clickable links to product pages |

### Minor / Enhancement Opportunities

| ID | Gap | Location | Impact |
|----|-----|----------|--------|
| G13 | No password strength indicator | ChangePasswordForm | Users don't know password quality until submit |
| G14 | No address autocomplete | Both AddressForm variants | Manual address entry is error-prone |
| G15 | No order search/filter | OrdersView | Can't search by date, status, or product name |
| G16 | No wishlist item removal from wishlist page (auth mode) | WishlistPage | Must go to product page to toggle wishlist |
| G17 | No re-order / buy again from orders | OrderDetailView | Common e-commerce feature missing |
| G18 | Exit intent only on desktop | useExitIntent | Mobile users (majority) never see retention dialog |
| G19 | Cross-sell only uses first cart item | CartView line 526 | Should consider all cart items for recommendations |
| G20 | Coupon not validated against cart changes | CartView | If user changes cart after applying coupon, discount may be stale |
| G21 | No loading state for "Add All to Cart" | WishlistPage line 144-160 | Sequential POST calls with no progress indicator |
| G22 | Country code is a plain text input | Both AddressForm variants | Should be a Select/Combobox with country list |

### Accessibility Gaps

| ID | Gap | Location |
|----|-----|----------|
| A1 | Password visibility toggles lack `aria-label` | ChangePasswordForm |
| A2 | Star ratings in OrdersView not accessible | Uses visual-only star characters |
| A3 | Cart quantity buttons missing `aria-label` | CartView +/- buttons |
| A4 | Color swatch in personalization not accessible | CartView line 445-448 (color only via background) |
| A5 | Sidebar product cards missing `aria-label` for click action | StorefrontSidebar ProductCard |

---

## File Index

| File | Type | Lines |
|------|------|-------|
| `src/app/[locale]/(app)/profile/page.tsx` | Server | 63 |
| `src/app/[locale]/(app)/profile/loading.tsx` | Server | 55 |
| `src/components/profile/ProfileForm.tsx` | Client | 593 |
| `src/components/profile/ShippingAddressList.tsx` | Client | 227 |
| `src/components/profile/AddressForm.tsx` | Client | 228 |
| `src/components/profile/PaymentMethodsList.tsx` | Client | 242 |
| `src/components/profile/ChangePasswordForm.tsx` | Client | 236 |
| `src/components/profile/DeleteAccountSection.tsx` | Client | 131 |
| `src/components/profile/DeletionCountdownBanner.tsx` | Client | 84 |
| `src/app/[locale]/(app)/orders/page.tsx` | Server | 22 |
| `src/app/[locale]/(app)/orders/[id]/page.tsx` | Server | 30 |
| `src/components/orders/OrdersView.tsx` | Client | 273 |
| `src/components/orders/OrderDetailView.tsx` | Client | 687 |
| `src/app/[locale]/(app)/cart/page.tsx` | Server | 22 |
| `src/components/cart/CartView.tsx` | Client | 753 |
| `src/components/cart/CartCrossSell.tsx` | Client | 51 |
| `src/hooks/useCart.tsx` | Client | 265 |
| `src/app/[locale]/(focused)/checkout/page.tsx` | Server | 22 |
| `src/app/[locale]/(focused)/checkout/success/page.tsx` | Server | 152 |
| `src/app/[locale]/(focused)/checkout/success/CartClearer.tsx` | Client | 31 |
| `src/app/[locale]/(focused)/checkout/cancel/page.tsx` | Server | 60 |
| `src/components/checkout/CheckoutView.tsx` | Client | 758 |
| `src/components/checkout/AddressForm.tsx` | Client | 295 |
| `src/components/checkout/CheckoutBreadcrumb.tsx` | Client | 71 |
| `src/app/[locale]/(app)/wishlist/page.tsx` | Client | 428 |
| `src/app/[locale]/(app)/wishlist/loading.tsx` | Server | 47 |
| `src/app/[locale]/(app)/wishlist/shared/[token]/page.tsx` | Client | 224 |
| `src/hooks/useWishlist.tsx` | Client | 277 |
| `src/hooks/useAuth.ts` | Client | 164 |
| `src/hooks/useProductCache.ts` | Client | 39 |
| `src/hooks/useRecentlyViewed.ts` | Client | 70 |
| `src/hooks/useEngagement.ts` | Client | 110 |
| `src/hooks/useProductDetail.ts` | Client | 81 |
| `src/hooks/useExitIntent.ts` | Client | 41 |
| `src/components/storefront/StorefrontLayout.tsx` | Client | 160 |
| `src/components/storefront/StorefrontSidebar.tsx` | Client | 312 |
| `src/components/storefront/StorefrontHeader.tsx` | Client | 315 |
| `src/components/storefront/DetailPanel.tsx` | Client | 565 |
| `src/components/storefront/StorefrontContext.tsx` | Client | 82 |
| `src/components/engagement/AuthWallModal.tsx` | Client | 112 |
| `src/components/engagement/InstallPrompt.tsx` | Client | 82 |
| `src/components/engagement/WelcomePopup.tsx` | Client | 119 |

**Total files audited: 42**
**Total lines of code (approximate): ~7,500**
