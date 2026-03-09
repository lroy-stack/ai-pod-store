# 07 - Artifact Components: Detailed Documentation

**Date**: 2026-03-08
**Scope**: Every artifact component in `src/components/artifacts/`, the registry, tool definitions, and the rendering pipeline.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Registry (`registry.tsx`)](#2-registry)
3. [Rendering Pipeline](#3-rendering-pipeline)
4. [Individual Artifact Components](#4-individual-artifact-components)
   - 4.1 [ProductGridArtifact](#41-productgridartifact)
   - 4.2 [ProductDetailArtifact](#42-productdetailartifact)
   - 4.3 [ComparisonTableArtifact](#43-comparisontableartifact)
   - 4.4 [SizeGuideArtifact](#44-sizeguideartifact)
   - 4.5 [CartSummaryArtifact](#45-cartsummaryartifact)
   - 4.6 [PricingTableArtifact](#46-pricingtableartifact)
   - 4.7 [ApprovalCardArtifact](#47-approvalcardartifact)
   - 4.8 [OrderTimelineArtifact](#48-ordertimelineartifact)
   - 4.9 [OrderListArtifact](#49-orderlistartifact)
   - 4.10 [ReturnRequestArtifact](#410-returnrequestartifact)
   - 4.11 [DesignPreviewArtifact](#411-designpreviewartifact)
   - 4.12 [ProductMockupArtifact](#412-productmockupartifact)
5. [Tool Definitions (AI Side)](#5-tool-definitions)
6. [StorefrontContext & DetailPanel Integration](#6-storefrontcontext--detailpanel-integration)
7. [Shared Types](#7-shared-types)
8. [Cross-Cutting Observations](#8-cross-cutting-observations)

---

## 1. System Overview

The artifact system is the visual layer between the AI assistant and the user. When the AI calls a tool (e.g., `product_search`, `generate_design`), the tool's output is rendered as a rich visual component -- an "artifact" -- embedded inline in the chat conversation.

**Architecture flow:**

```
User message
  -> AI SDK chat endpoint (/api/chat)
    -> AI model selects tool (e.g. product_search)
      -> Tool execute() runs server-side, returns JSON
        -> AI SDK streams tool result as `tool-ui` part
          -> ChatMessages.tsx detects isToolUIPart(part)
            -> getArtifact(toolName) from registry.tsx
              -> Renders artifact.Skeleton during loading
              -> Renders artifact.Component with {...output} when done
```

**Key files:**

| File | Role |
|---|---|
| `src/components/artifacts/registry.tsx` | Maps tool names to Component + Skeleton pairs |
| `src/components/storefront/ChatMessages.tsx` | Renders tool outputs as artifact components inline in chat |
| `src/components/storefront/ChatArea.tsx` | Orchestrator: manages messages, passes handlers to ChatMessages |
| `src/lib/chat/tools.ts` | Server-side tool definitions (parameters, execute functions, return shapes) |
| `src/components/storefront/StorefrontContext.tsx` | Shared state for artifacts, selectedProduct, activeArtifactId |
| `src/components/storefront/DetailPanel.tsx` | Right panel that can display product artifacts in tab view |
| `src/types/product.ts` | ProductBase, ProductCard, ProductDetail type hierarchy |

**Total artifact types:** 12 visual components, mapped from 16 tool names (some tools share the same component).

---

## 2. Registry

**File:** `src/components/artifacts/registry.tsx`

The registry is a simple `Record<string, ArtifactRegistryEntry>` that maps tool names to component pairs:

```typescript
interface ArtifactRegistryEntry {
  Component: React.ComponentType<any>
  Skeleton: React.ComponentType<any>
}
```

### Complete Mapping Table

| Tool Name | Component | Skeleton |
|---|---|---|
| `product_search` | `ProductGridArtifact` | `ProductGridSkeleton` |
| `browse_catalog` | `ProductGridArtifact` | `ProductGridSkeleton` |
| `get_recommendations` | `ProductGridArtifact` | `ProductGridSkeleton` |
| `get_product_detail` | `ProductDetailArtifact` | `ProductDetailSkeleton` |
| `compare_products` | `ComparisonTableArtifact` | `ComparisonTableSkeleton` |
| `get_size_guide` | `SizeGuideArtifact` | `SizeGuideSkeleton` |
| `get_cart` | `CartSummaryArtifact` | `CartSummarySkeleton` |
| `estimate_shipping` | `PricingTableArtifact` | `PricingTableSkeleton` |
| `create_checkout` | `ApprovalCardArtifact` | `ApprovalCardSkeleton` |
| `track_order` | `OrderTimelineArtifact` | `OrderTimelineSkeleton` |
| `get_order_history` | `OrderListArtifact` | `OrderListSkeleton` |
| `request_return` | `ReturnRequestArtifact` | `ReturnRequestSkeleton` |
| `generate_design` | `DesignPreviewArtifact` | `DesignPreviewSkeleton` |
| `customize_design` | `DesignPreviewArtifact` | `DesignPreviewSkeleton` |
| `remove_background` | `DesignPreviewArtifact` | `DesignPreviewSkeleton` |
| `ai_design_generate` | `DesignPreviewArtifact` | `DesignPreviewSkeleton` |
| `apply_design_to_product` | `ProductMockupArtifact` | `ProductMockupSkeleton` |

**Lookup function:**

```typescript
export function getArtifact(toolName: string): ArtifactRegistryEntry | null {
  return artifactRegistry[toolName] || null
}
```

### Tools NOT in the registry (text-only responses)

The following tools defined in `tools.ts` have **no artifact entry** and produce text-only AI responses:

- `check_availability` -- returns availability info as text
- `add_to_cart` -- returns success/failure message
- `apply_coupon` -- returns coupon result as text
- `confirm_checkout` -- redirects to Stripe via `CheckoutRedirect` (special handling in ChatMessages)
- `add_to_wishlist` -- returns success/failure message
- `get_store_policies` -- returns policies as text
- `switch_language` -- returns redirect instruction
- `analyze_image` -- returns analysis as text
- `personalize_product` -- returns text suggestions

---

## 3. Rendering Pipeline

### ChatMessages.tsx (Rendering Logic)

**File:** `src/components/storefront/ChatMessages.tsx`

The `ToolArtifact` internal component handles all artifact rendering:

```
1. getToolName(part) -> toolName
2. getArtifact(toolName) -> artifact (Component + Skeleton) or null
3. If null -> return null (no visual, AI handles as text)
4. If part.state === 'input-streaming' or 'input-available' -> render <artifact.Skeleton />
5. If part.state === 'output-available':
   a. Special case: output.needsApproval && toolName === 'create_checkout'
      -> Render ApprovalCardArtifact with onApprove (calls /api/checkout/create-session) and onDeny
   b. Special case: output.needsApproval && toolName === 'request_return'
      -> Render ReturnRequestArtifact with onApprove (calls /api/orders/{id}/returns) and onDeny
   c. Special case: output.checkoutUrl && toolName === 'confirm_checkout'
      -> Render CheckoutRedirect (useEffect -> window.location.href)
   d. If output.success === false
      -> Show error message in red text
   e. Default: Render <artifact.Component {...output} onSelectProduct={...} onAddToCart={...} variant="inline" />
6. If part.state === 'output-error' -> Show generic error text
```

### Prop Injection

All artifacts receive their data via `{...output}` spread from the tool's return value. Additionally, ChatMessages injects these handler props:

- `onSelectProduct(productId, productData?)` -- Opens DetailPanel with product
- `onAddToCart(productId)` -- Adds product to cart via useCart hook
- `onAddToWishlist(productId)` -- Toggles wishlist via useWishlist hook
- `variant="inline"` -- All artifacts render in inline (compact) mode within chat

### Animation

All artifacts are wrapped in:
```html
<div className="py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
```

---

## 4. Individual Artifact Components

### Directory Structure Pattern

Each artifact follows this consistent structure:

```
ArtifactName/
  ArtifactName.tsx    -- Main component
  Skeleton.tsx        -- Loading state (shimmer placeholders)
  index.ts            -- Re-exports Component + Skeleton + types
```

---

### 4.1 ProductGridArtifact

**File:** `src/components/artifacts/ProductGridArtifact/ProductGridArtifact.tsx`
**Type:** Product catalog display
**Tools:** `product_search`, `browse_catalog`, `get_recommendations`

#### Visual

A responsive grid of product cards. Each card shows:
- Square product image with hover zoom (scale 1.03)
- Color variant swatches overlaid at bottom of image (circular thumbnails, 32x32px)
- Wishlist heart button (top-right of image)
- Category label (uppercase, tracking-widest)
- Star rating
- Product title (1-line clamp)
- Price with optional compare-at-price and discount badge
- Two action buttons: Add to Cart (accent) + View Details (outline eye icon)

#### Props/Data

```typescript
interface ProductGridArtifactProps {
  products: ProductCard[]      // From types/product.ts
  onSelectProduct: (productId: string, productData?: ProductCard) => void
  variant?: 'inline' | 'full'  // 'inline' limits to 6 items
}
```

Each `ProductCard` contains:
```typescript
{
  id: string
  title: string
  description: string
  price: number
  currency: string
  image: string | null
  rating?: number
  reviewCount?: number
  category?: string
  compareAtPrice?: number
  variants?: {
    sizes?: string[]
    colors?: string[]
    colorImages?: Record<string, string>  // color name -> image URL
  }
}
```

#### Interactivity

- **Click card** -> `onSelectProduct(product.id, product)` -> Opens DetailPanel
- **Add to Cart button** -> `addToCart(product.id, 1, undefined, product.title, product.price)` via useCart
- **View Details button** -> Same as clicking card (calls onSelect)
- **Wishlist heart** -> `toggleWishlist(product.id)` via useWishlist
- **Color swatches** -> Click or hover changes displayed image; state managed with `colorIdx`

#### Responsive

- Grid class: `neu-grid` (defined in globals.css)
- In inline variant: max 6 items displayed
- Touch-friendly: action buttons always visible (no hover-to-show)

#### Store Integration

- **useCart** -- `addToCart` hook for cart additions
- **useWishlist** -- `isWishlisted()` and `toggleWishlist()` for heart state
- **formatPrice** -- Locale-aware price formatting via `@/lib/currency`

#### Skeleton

`ProductGridSkeleton` renders 6 (configurable via `count` prop) placeholder cards with:
- Square aspect-ratio animated pulse for image
- Three placeholder lines for title, price, and action buttons
- Grid layout: `grid-cols-[repeat(auto-fill,minmax(200px,1fr))]`

---

### 4.2 ProductDetailArtifact

**File:** `src/components/artifacts/ProductDetailArtifact/ProductDetailArtifact.tsx`
**Type:** Single product detail card
**Tool:** `get_product_detail`

#### Visual

A Card component with a two-column grid layout:
- **Left column:** Product image (square aspect ratio, or Package icon placeholder)
- **Right column:** Full product details:
  - Title + category badge
  - Price (with compare-at and discount percentage)
  - Star rating with review count
  - Description section with Info icon
  - Variant badges (sizes/colors as outline badges)
  - Materials, care instructions, print technique, manufacturing country (each with appropriate icon: Shirt, Droplets, Printer, Globe)
  - Safety information in a collapsible `<details>` element rendered via `SafeHTML`
  - Shipping info
  - Footer: Add to Cart button + Wishlist heart button

#### Props/Data

```typescript
interface ProductDetailArtifactProps {
  product: ProductDetail
  onAddToCart?: (productId: string) => void
  onAddToWishlist?: (productId: string) => void
  variant?: 'inline' | 'full'
}

interface ProductDetail {
  id: string
  title: string
  description: string
  category: string
  price: number
  compareAtPrice?: number
  currency: string
  images: { src: string; alt: string }[]
  rating: number
  reviewCount: number
  variants?: { name: string; options: string[] }[]
  materials?: string
  careInstructions?: string
  printTechnique?: string
  manufacturingCountry?: string
  brand?: string
  safetyInformation?: string
  shippingInfo?: string
  available: boolean
}
```

Note: This `ProductDetail` interface is defined locally in the artifact file and differs from `types/product.ts`. The tool output uses `images: { src, alt }[]` while `types/product.ts` uses `images: string[]`.

#### Interactivity

- **Add to Cart** -> `onAddToCart(product.id)` (disabled when `!product.available`)
- **Wishlist** -> `toggleWishlist(product.id)` via useWishlist hook
- **Safety info** -> Expandable/collapsible `<details>` element

#### Responsive

- Inline variant: `md:grid-cols-[300px_1fr]` (image fixed 300px, content flex)
- Full variant: `md:grid-cols-2` (equal columns)
- Single column on mobile (stacked)

#### Skeleton

Two-column grid with animated pulses for image, title, price, description, variant badges, and action buttons.

---

### 4.3 ComparisonTableArtifact

**File:** `src/components/artifacts/ComparisonTableArtifact/ComparisonTableArtifact.tsx`
**Type:** Product comparison table
**Tool:** `compare_products`

#### Visual

A horizontally scrollable HTML table with:
- **Header row:** Product images (96x96 rounded), titles, and category badges
- **Price row:** Price with compare-at and discount styling
- **Rating row:** Star icon + rating number + review count
- **Availability row:** In Stock (green check badge) or Out of Stock (red X badge)
- **Feature rows:** Dynamically generated from `features[]` -- check mark or X per product
- **Action row:** Full-width "Add to Cart" button per product

#### Props/Data

```typescript
interface ComparisonTableArtifactProps {
  products: ComparisonProduct[]
  onAddToCart?: (productId: string) => void
  variant?: 'inline' | 'full'
}

interface ComparisonProduct {
  id: string
  title: string
  category: string
  price: number
  compareAtPrice?: number
  currency: string
  image: string | null
  rating: number
  reviewCount: number
  available: boolean
  features?: string[]
}
```

#### Interactivity

- **Add to Cart** per product -> `onAddToCart(product.id)` (disabled when `!product.available`)
- **Horizontal scroll** on mobile for table overflow

#### Responsive

- `overflow-x-auto` wrapper for horizontal scrolling
- First column (`td:first-child`) is sticky (`sticky left-0 z-10`) so row labels remain visible during scroll
- Min-width 200px per product column
- `hover:bg-muted/50` on rows

#### Skeleton

Table structure with animated pulses for 2 product columns, 5 rows, header, and action row.

---

### 4.4 SizeGuideArtifact

**File:** `src/components/artifacts/SizeGuideArtifact/SizeGuideArtifact.tsx`
**Type:** Size/measurement chart
**Tool:** `get_size_guide`

#### Visual

A Card with:
- Header: Shirt icon + "Size Guide" title
- Product type badge + unit badge (inches/cm with Ruler icon)
- Responsive table with columns shown dynamically based on available data:
  - Size (always shown)
  - Chest (if any size has `chest` value)
  - Length (if any size has `length` value)
  - Width (if any size has `width` value)
  - Sleeve (if any size has `sleeve` value)
- Tip text at bottom

#### Props/Data

```typescript
interface SizeGuideArtifactProps {
  guide: SizeGuide
}

interface SizeGuide {
  productType: string
  unit: 'inches' | 'cm'
  sizes: {
    size: string
    chest?: number
    length?: number
    width?: number
    sleeve?: number
  }[]
}
```

The tool returns hardcoded size data for t-shirts (6 sizes XS-2XL with chest/length/width), hoodies (5 sizes S-2XL with chest/length/sleeve), or a generic fallback (4 sizes S-XL with width/length).

#### Interactivity

- None. Read-only display.
- Row hover: `hover:bg-muted/50`

#### Responsive

- `overflow-x-auto` for table horizontal scrolling on small screens

#### Skeleton

Card with animated pulse lines for header badges, table header, 5 table rows, and tip text.

---

### 4.5 CartSummaryArtifact

**File:** `src/components/artifacts/CartSummaryArtifact/CartSummaryArtifact.tsx`
**Type:** Shopping cart summary
**Tool:** `get_cart`

#### Visual

**Empty state:** Large ShoppingCart icon, "Empty Cart" title, description, and "Browse Products" button navigating to `/[locale]/shop`.

**With items:** A Card showing:
- Header: ShoppingCart icon + "Shopping Cart (X items)" title
- Item list: Each item shows title (2-line clamp), unit price x quantity, and subtotal
- Items separated by `<Separator>`
- Footer: Subtotal label + bold total price
- Two action buttons: "View Full Cart" (outline) and "Proceed to Checkout" (accent)
- Small note: "Shipping & tax calculated at checkout"

#### Props/Data

```typescript
interface CartSummaryArtifactProps {
  items: CartItem[]
  itemCount: number
  subtotal: number
  currency?: string
  variant?: 'inline' | 'full'
}

interface CartItem {
  id: string
  productId: string
  title: string
  price: number
  currency?: string
  quantity: number
  subtotal: number
}
```

#### Interactivity

- **View Full Cart** -> `router.push('/[locale]/cart')` via next/navigation
- **Proceed to Checkout** -> `router.push('/[locale]/checkout')`
- **Browse Products** (empty state) -> `router.push('/[locale]/shop')`

#### Responsive

- Button row: `flex-col sm:flex-row` (stacked on mobile, side-by-side on tablet+)

#### Skeleton

Card with 3 animated item rows, subtotal area, and 2 button placeholders.

---

### 4.6 PricingTableArtifact

**File:** `src/components/artifacts/PricingTableArtifact/PricingTableArtifact.tsx`
**Type:** Shipping options pricing table
**Tool:** `estimate_shipping`

#### Visual

A Card showing:
- Header: "Shipping Options" title + "Shipping to: [country]" + optional message badge
- List of shipping options, each in a bordered rounded row:
  - Method name + "Recommended" badge on first option
  - Delivery time estimate
  - Price (right-aligned, bold)
- Footer (if `freeShippingThreshold` provided): Check icon + "Free shipping on orders over [threshold]"

#### Props/Data

```typescript
interface PricingTableArtifactProps {
  country: string
  options: ShippingOption[]
  freeShippingThreshold?: number
  message?: string
}

interface ShippingOption {
  method: string
  price: number
  days: string
  currency: string
}
```

The tool returns shipping rates from `SHIPPING_RATES` config, country-specific or EU default.

#### Interactivity

- None. Read-only display.
- Row hover: `hover:bg-muted/50`

#### Responsive

- Full-width card, no special breakpoint handling needed (single column layout)

#### Skeleton

Card with 3 bordered shipping option rows, each with animated pulse lines for method and price.

---

### 4.7 ApprovalCardArtifact

**File:** `src/components/artifacts/ApprovalCardArtifact/ApprovalCardArtifact.tsx`
**Type:** Checkout confirmation dialog
**Tool:** `create_checkout` (with `needsApproval: true`)

#### Visual

A Card showing:
- Header: CreditCard icon + "Checkout Approval" title + subtitle
- Item list with product name, quantity, and calculated price
- Separator
- Subtotal row (bold)
- Info box with AlertCircle icon and approval note text
- Footer: Cancel (outline) and Approve (primary accent) buttons

#### Props/Data

```typescript
interface ApprovalCardArtifactProps {
  variant?: 'inline' | 'detail'
  cartItems?: Array<{
    productId: string
    productName: string
    productPrice: number
    quantity: number
  }>
  subtotal?: number
  onApprove?: () => void
  onDeny?: () => void
}
```

#### Interactivity

- **Approve button** -> `onApprove()` -- In ChatMessages.tsx, this triggers a POST to `/api/checkout/create-session` which creates a Stripe session and redirects via `window.location.href = data.url`
- **Cancel button** -> `onDeny()` -- Sends "Checkout cancelled." message to chat
- Prices are hardcoded to EUR currency formatting

#### Responsive

- `max-w-lg` in inline variant, `max-w-2xl mx-auto` in detail variant

#### Skeleton

Card with header icon, 2 item placeholder rows, subtotal area, info box, and 2 action buttons -- all animated pulse.

---

### 4.8 OrderTimelineArtifact

**File:** `src/components/artifacts/OrderTimelineArtifact/OrderTimelineArtifact.tsx`
**Type:** Order tracking timeline
**Tool:** `track_order`

#### Visual

A Card with vertical timeline showing 5 stages:
1. **Order Placed** (Package icon) -- always completed
2. **Payment Confirmed** (CheckCircle icon) -- completed if paidAt exists
3. **Processing** (Clock icon) -- completed if status is processing/shipped/delivered
4. **Shipped** (Truck icon) -- completed if shippedAt exists or status is delivered
5. **Delivered** (MapPin icon) -- completed if deliveredAt exists

Each stage shows:
- Circular icon (primary fill when completed, primary/20 bg when active, muted when pending)
- Vertical connector line (primary when completed, border when pending)
- Stage label + timestamp

Additional sections:
- Tracking number (monospace font, after separator)
- Estimated delivery date (hidden when status is "delivered")
- Footer: "View Order Details" button + "Track Package" button (opens Google search for tracking number)

Header shows: Order #[8-char ID] + status badge (colored per status map) + total price.

#### Props/Data

```typescript
interface OrderTimelineArtifactProps {
  orderId: string
  status: string
  trackingNumber?: string
  estimatedDelivery?: string
  createdAt: string
  paidAt?: string
  shippedAt?: string
  deliveredAt?: string
  currency: string
  total: number          // In cents (divided by 100 for display)
  variant?: 'inline' | 'full'
  showFooter?: boolean   // Default true
}
```

Status color map:
```
pending    -> bg-warning/10 text-warning
paid       -> bg-success/10 text-success
processing -> bg-primary/10 text-primary
shipped    -> bg-accent/10 text-accent-foreground
delivered  -> bg-success/10 text-success
cancelled  -> bg-destructive/10 text-destructive
```

#### Interactivity

- **View Order Details** -> `router.push('/[locale]/orders/[orderId]')`
- **Track Package** -> `window.open('https://www.google.com/search?q=track+[trackingNumber]', '_blank')`

#### Responsive

- Footer buttons: `flex-col sm:flex-row` (stacked on mobile)
- Title wraps: `flex-wrap` on header

#### Skeleton

5-step timeline with circular icon placeholders, connector lines, text placeholders, tracking/delivery sections, and 2 footer buttons -- all animated pulse.

---

### 4.9 OrderListArtifact

**File:** `src/components/artifacts/OrderListArtifact/OrderListArtifact.tsx`
**Type:** Order history list
**Tool:** `get_order_history`

#### Visual

**Empty state:** Large Package icon, "No Orders" title, description, and "Browse Products" button.

**With orders:** A Card showing:
- Header: Package icon + "Order History (X orders)" title
- Order list: Each order shows:
  - Order ID (first 8 chars) + status badge (colored)
  - Calendar icon + date + Banknote icon + total (bold)
  - Two action buttons: "View Details" (outline) and "Track Order" (accent, hidden for cancelled)
- Orders separated by `<Separator>`

#### Props/Data

```typescript
interface OrderListArtifactProps {
  orders: OrderItem[]
  variant?: 'inline' | 'full'
}

interface OrderItem {
  id: string
  status: string
  totalCents: number      // Divided by 100 for display
  currency: string
  createdAt: string
  paidAt?: string
  shippedAt?: string
}
```

Uses the same status color map as OrderTimelineArtifact.

#### Interactivity

- **View Details** -> `router.push('/[locale]/orders/[orderId]')`
- **Track Order** -> `router.push('/[locale]/orders/[orderId]')` (same destination)

#### Responsive

- Order rows: `flex-col sm:flex-row sm:items-center sm:justify-between`
- Action buttons: `flex-col sm:flex-row`

#### Skeleton

3 order rows with animated placeholders for ID, badge, date, total, and 2 buttons each.

---

### 4.10 ReturnRequestArtifact

**File:** `src/components/artifacts/ReturnRequestArtifact/ReturnRequestArtifact.tsx`
**Type:** Return request confirmation dialog
**Tool:** `request_return` (with `needsApproval: true`)

#### Visual

A Card showing:
- Header: PackageX icon (destructive color) + "Return Request" title + subtitle
- Order summary: Order ID (8-char mono) + status badge
- Date grid (2 columns): Order date, paid date, shipped date
- Refund amount (bold)
- **Reason textarea** -- Required input, minimum 10 characters, with character count validation message
- Info box with AlertCircle and return policy note
- Footer: Cancel (outline) and Submit Return (destructive red) buttons

#### Props/Data

```typescript
interface ReturnRequestArtifactProps {
  variant?: 'inline' | 'detail'
  orderId?: string
  status?: string
  totalCents?: number       // Divided by 100 for display
  currency?: string         // Default 'EUR'
  createdAt?: string
  paidAt?: string
  shippedAt?: string
  reason?: string           // Initial reason text
  onApprove?: (reason: string) => void
  onDeny?: () => void
}
```

#### Interactivity

- **Reason textarea** -- User types return reason (managed with useState)
- **Submit Return button** -- `onApprove(reason.trim())` -- disabled until `reason.trim().length >= 10`
- **Cancel button** -> `onDeny()` -- Sends "Return request cancelled." to chat

In ChatMessages.tsx, `onApprove` calls `POST /api/orders/{orderId}/returns` with `{ reason }`, then sends a success/failure message to chat.

#### Responsive

- Date grid: `grid-cols-2`
- `max-w-lg` in inline variant

#### Skeleton

Card with order ID/status area, 2x2 date grid, refund amount, textarea placeholder, info box, and 2 buttons -- all animated pulse.

---

### 4.11 DesignPreviewArtifact

**File:** `src/components/artifacts/DesignPreviewArtifact/DesignPreviewArtifact.tsx`
**Type:** AI-generated design display
**Tools:** `generate_design`, `customize_design`, `remove_background`, `ai_design_generate`

#### Visual

A Card with:
- Header: Sparkles icon (primary) + "AI Design Preview" title + subtitle
- Badges: "Transparent" (if bg removed), provider name, style name
- Square design image (using Next.js `<Image>` with fill + object-cover)
  - Transparent bg: shows checkerboard pattern background via `bg-[url(/checkerboard.svg)]`
  - No image: "No image available" placeholder text
- Prompt display: "PROMPT" label + prompt text
- Footer (2 rows, each with 2 buttons):
  - Row 1: Download (opens image URL in new tab) + Remove BG (calls `/api/designs/remove-bg`)
  - Row 2: View Mockup (calls `/api/designs/mockup`) + Add to Product (primary accent)

#### Props/Data

```typescript
interface DesignPreviewArtifactProps {
  variant?: 'inline' | 'detail'
  imageUrl?: string
  prompt?: string
  style?: string
  designId?: string | null
  provider?: string
  onCustomize?: () => void
  onAddToProduct?: () => void
  onViewMockup?: (mockupUrl: string) => void
}
```

Tool return shape (from `generate_design`):
```typescript
{
  success: true,
  imageUrl: string,       // Final URL (possibly with bg removed)
  prompt: string,         // Cleaned prompt
  style: string,          // 'default' or user-specified
  designId: string | null,// DB design ID
  provider: string,       // e.g. 'fal-schnell'
  bgRemoved: boolean,
  message: string,
}
```

#### Interactivity

- **Download** -> `window.open(imageUrl, '_blank')`
- **Remove BG** -> POST `/api/designs/remove-bg` with `{ imageUrl, designId }` -> Updates `imageUrl` state + shows "Transparent" badge. Button disabled after removal.
- **View Mockup** -> POST `/api/designs/mockup` with `{ designUrl, productType: 'tshirt' }` -> Calls `onViewMockup(mockupUrl)`
- **Add to Product** -> Calls `onAddToProduct()` callback

Internal state management:
- `imageUrl` -- mutable, updated after bg removal
- `bgRemoved` -- tracks if background was removed
- `generatingMockup` / `removingBg` -- loading states for async operations

#### Responsive

- `max-w-lg` in inline, `max-w-2xl mx-auto` in detail
- Button rows: `flex-col gap-2 sm:flex-row`

#### Skeleton

Card with header icon/title, aspect-square image placeholder, prompt text lines, and 2 button placeholders.

---

### 4.12 ProductMockupArtifact

**File:** `src/components/artifacts/ProductMockupArtifact/ProductMockupArtifact.tsx`
**Type:** Design-on-product mockup display
**Tool:** `apply_design_to_product`

#### Visual

A Card showing:
- Header: Shirt icon (primary) + "Product Mockup" title + product name
- Product type badge (e.g., "T-Shirt", "Hoodie")
- Square mockup image:
  - Product template as background (full image from mockupUrl)
  - Design overlay centered (max 60% of container, object-contain)
- Product type info section
- Footer: Download Mockup (outline) + Add to Cart (primary accent)

#### Props/Data

```typescript
interface ProductMockupArtifactProps {
  variant?: 'inline' | 'detail'
  mockupUrl?: string       // Full mockup image URL
  designUrl?: string       // Design overlay URL
  productType?: string     // 'tshirt', 'hoodie', 'mug', 'phone-case', 'tote-bag'
  productName?: string
  onAddToCart?: () => void
}
```

Product type labels:
```typescript
{ tshirt: 'T-Shirt', hoodie: 'Hoodie', mug: 'Mug', 'phone-case': 'Phone Case', 'tote-bag': 'Tote Bag' }
```

#### Interactivity

- **Download Mockup** -> `window.open(mockupUrl, '_blank')`
- **Add to Cart** -> `onAddToCart()` callback

#### Responsive

- `max-w-lg` in inline, `max-w-2xl mx-auto` in detail
- Footer: `flex-col gap-2 sm:flex-row`

#### Skeleton

Card with header icon/title, aspect-square image placeholder, product info lines, and 2 button placeholders.

---

## 5. Tool Definitions

**File:** `src/lib/chat/tools.ts`

Each tool is defined using AI SDK's `tool()` function with:
- `description` -- Used by the AI model to decide when to call the tool
- `parameters` -- Zod schema defining expected inputs
- `execute` -- Async server-side function that queries Supabase and returns JSON
- `needsApproval` -- Optional flag (used by `create_checkout` and `request_return`)

### Tool Context

All tools receive a shared context object:
```typescript
interface ChatToolsContext {
  supabase: SupabaseClient
  chatUserId: string | null
  chatUserTier: UserTier
  chatLocale: string
  cartSessionId: string | null
  fpId: string | null       // Fingerprint ID for anonymous users
  ip: string
}
```

### How the AI Decides Which Tool to Call

The AI model (Gemini, via AI SDK) reads tool descriptions and selects the appropriate tool based on user intent. Key description patterns:

| User Intent | Tool Selected | Description Keyword |
|---|---|---|
| "Show me t-shirts" | `product_search` | "Search for products...ANY product request" |
| "Browse hoodies" | `browse_catalog` | "Browse products by category with pagination" |
| "What's popular?" | `get_recommendations` | "Get product recommendations by mode" |
| "Tell me about X" | `get_product_detail` | "detailed information about a specific product" |
| "Compare these two" | `compare_products` | "Compare multiple products side by side" |
| "What sizes?" | `get_size_guide` | "Get size guide/chart for a product type" |
| "What's in my cart?" | `get_cart` | "Get the current shopping cart contents" |
| "How much is shipping?" | `estimate_shipping` | "Calculate shipping cost estimates" |
| "I want to buy" | `create_checkout` | "Create a Stripe checkout session" |
| "Track my order" | `track_order` | "Track an order by order ID" |
| "Show my orders" | `get_order_history` | "Get the user's order history" |
| "I want to return" | `request_return` | "Request a return for an order" |
| "Design a cat shirt" | `generate_design` | "Generate a custom AI design" |
| "Make it blue" | `customize_design` | "Modify an existing design" |
| "Remove background" | `remove_background` | "Remove the background from a design image" |

### Data Transformation: Tool Output -> Artifact Props

The tool's `execute` return value is spread directly as props to the artifact component. Key transformations:

**Product tools (`product_search`, `browse_catalog`, `get_recommendations`):**
```
DB row -> formatProduct() -> enrichWithVariants() -> { products: [...], count, query }
```

`formatProduct()` converts:
- `base_price_cents` -> `price` (divided by 100)
- `compare_at_price_cents` -> `compareAtPrice` (divided by 100)
- `categories.slug` -> `category`
- `images[0].src` -> `image`

`enrichWithVariants()` adds:
- `variants.sizes` -- Set of available sizes
- `variants.colors` -- Set of available colors
- `variants.colorImages` -- Map of color -> image URL

**Order tools (`track_order`):**
- `total_cents` -> `total` (kept in cents, divided by 100 in component)
- Direct field mapping: `tracking_number`, `estimated_delivery`, timestamps

---

## 6. StorefrontContext & DetailPanel Integration

### StorefrontContext

**File:** `src/components/storefront/StorefrontContext.tsx`

Provides shared state across the storefront layout:

```typescript
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

When a user clicks "View Details" on a ProductGridArtifact card:
1. `ChatArea.handleSelectProduct(productId, productData)` is called
2. This calls `setSelectedProduct(productId)` -- opens the DetailPanel
3. And `addArtifact({ id: productId, type: 'product', title: ..., data: productData })` -- adds to artifact tabs

### DetailPanel

**File:** `src/components/storefront/DetailPanel.tsx`

The DetailPanel is the right-side panel in the StorefrontLayout. It renders artifacts in a tabbed interface:

**Rendering logic:**
1. If `artifacts.length > 0`:
   - Multiple artifacts: `<Tabs>` component with closable tabs, each tab renders `<ArtifactContent>`
   - Single artifact: Direct `<ArtifactContent>` without tabs
2. If no artifacts but `productId` prop: Fetches product via `useProductDetail` hook and renders `<ProductView>`
3. Loading state: `<DetailPanelSkeleton>`
4. Error state: "Product not found" with AlertCircle icon

**ArtifactContent component:**
- `type === 'product'`: Fetches full product detail via `useProductDetail` and renders `<ProductView>` with full variant selection, image gallery, specifications, add-to-cart, wishlist, and "Ask about product" functionality
- `type === 'design'`: Renders design image + prompt text
- Other types: JSON dump in `<pre>` tag

Note: The DetailPanel's `ProductView` is a separate, richer implementation from the inline `ProductDetailArtifact`. It includes `VariantSelector`, `QuantitySelector`, `ProductImageGallery`, `ProductSpecifications` sub-components and variant-reactive pricing.

---

## 7. Shared Types

**File:** `src/types/product.ts`

Three-tier type hierarchy:

```
ProductBase (minimal: id, title, price, currency, image)
  -> ProductCard (list: + description, rating, category, variants with colorImages)
    -> ProductDetail (detail: + images[], materials, careInstructions, printTechnique, etc.)
```

Key variant shapes:

**ProductCard.variants:**
```typescript
{
  sizes?: string[]
  colors?: string[]
  colorImages?: Record<string, string>  // color -> image URL
}
```

**ProductDetail.variants (extended):**
```typescript
{
  sizes?: string[]
  colors?: string[]
  allColors?: string[]       // All colors including out-of-stock
  allSizes?: string[]        // All sizes including out-of-stock
  colorImages?: Record<string, string>
  colorImageIndices?: Record<string, number[]>  // color -> image array indices
  sizeImageIndices?: Record<string, number[]>
  unavailableCombinations?: Array<{ color: string; size: string }>
  prices?: Array<{ size: string; color: string; price: number }>
}
```

---

## 8. Cross-Cutting Observations

### Dual artifact rendering paths

There are two distinct rendering paths for artifacts:
1. **Inline chat** (ChatMessages.tsx): Uses `registry.tsx` to map tool name -> Component. Props come directly from tool output via `{...output}`. Compact, read-optimized.
2. **DetailPanel** (DetailPanel.tsx): Uses `StorefrontContext.artifacts[]` for tabbed views. For `type === 'product'`, it fetches full product data via `useProductDetail` hook and renders the richer `ProductView` component with variant selection, quantity picker, and image gallery.

### Component styling patterns

All artifacts consistently use:
- shadcn/ui primitives: `Card`, `CardHeader`, `CardContent`, `CardFooter`, `Button`, `Badge`, `Separator`
- Semantic tokens: `text-foreground`, `text-muted-foreground`, `bg-muted`, `bg-card`, `bg-primary`, `text-destructive`
- `cn()` from `@/lib/utils` for conditional classes
- `neu-*` custom classes for neumorphic styling: `neu-card`, `neu-grid`, `neu-btn-accent`, `neu-btn-soft`, `neu-fav`, `neu-image`
- `formatPrice()` from `@/lib/currency` for locale-aware price rendering
- `useTranslations('storefront')` for i18n (all user-facing text)

### Skeleton pattern

Every artifact has a corresponding Skeleton component with:
- `animate-pulse` on `bg-muted` placeholder divs
- Matching layout structure to the real component (avoids layout shift)
- Some skeletons accept props (e.g., `count`, `eventCount`, `itemCount`, `variant`)

### Tools without visual artifacts

Several tools produce text-only responses handled by the AI's natural language:
- `check_availability`, `add_to_cart`, `apply_coupon`, `add_to_wishlist`, `get_store_policies`, `switch_language`, `analyze_image`, `personalize_product`

The `confirm_checkout` tool has special handling: it returns a `checkoutUrl` that triggers a `CheckoutRedirect` component using `useEffect` to navigate.

### Approval workflow

Two tools use `needsApproval: true`:
- `create_checkout` -- ApprovalCardArtifact with Stripe redirect on approve
- `request_return` -- ReturnRequestArtifact with reason textarea and API submission on approve

Both follow the same pattern: tool returns `{ needsApproval: true, ...data }`, ChatMessages renders the approval component with `onApprove`/`onDeny` handlers that perform async operations and send follow-up messages to chat.

### Type inconsistency

The `ProductDetail` interface in `ProductDetailArtifact.tsx` (line 27) defines `images: { src: string; alt: string }[]`, while `types/product.ts` defines `images: string[]`. The tool output from `get_product_detail` returns the `{ src, alt }` format directly from the Supabase `images` JSONB column.

### Missing features in inline artifacts vs DetailPanel

The inline `ProductGridArtifact` and `ProductDetailArtifact` lack:
- Variant selection (size/color picker) -- only badges, no interactive selection
- Quantity selector
- Image gallery (multiple images, thumbnails)
- Variant-reactive pricing
- "Ask about product" button

These features exist in the DetailPanel's `ProductView` component, which is the intended destination when users click "View Details" from inline artifacts.
