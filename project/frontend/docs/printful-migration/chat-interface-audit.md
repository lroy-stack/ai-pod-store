# Chat Interface Audit -- Complete Codebase Documentation

> Generated: 2026-03-02
> Purpose: Full audit of the AI-powered conversational storefront for POD provider migration.
> Scope: Layout, Chat API (26 tools), Artifacts (16 components), State Management, Data Flow, Printify Coupling.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Layout Architecture](#2-layout-architecture)
3. [Chat API -- Tools & System Prompt](#3-chat-api----tools--system-prompt)
4. [Artifact Registry & Components](#4-artifact-registry--components)
5. [State Management](#5-state-management)
6. [Data Flow](#6-data-flow)
7. [Printify Coupling Analysis](#7-printify-coupling-analysis)
8. [Migration Impact Assessment](#8-migration-impact-assessment)

---

## 1. Architecture Overview

The storefront is a **claude.ai-inspired conversational commerce interface** where the primary interaction paradigm is an AI chat assistant. Users ask the assistant to browse products, generate designs, manage cart/orders, and proceed to checkout -- all within a single chat conversation.

### Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| React | React 19.2 |
| AI SDK | `@ai-sdk/react` v6, `ai` v6 (Vercel AI SDK) |
| AI Model | Google Gemini 2.5 Flash (via `@ai-sdk/google`) |
| Transport | SSE streaming via `DefaultChatTransport` |
| Database | Supabase (PostgreSQL) -- service role client (RLS bypassed) |
| Design Generation | fal.ai (Flux Schnell, Flux Dev image-to-image) |
| Background Removal | Self-hosted rembg sidecar (port 8080) |
| Payment | Stripe Checkout Sessions |
| i18n | next-intl (en/es/de) |
| Styling | Tailwind v4 + shadcn/ui + semantic tokens |

### Key Files Map

```
src/
  app/
    [locale]/(app)/chat/page.tsx             -- Chat page (renders null; ChatArea is in layout)
    api/chat/route.ts                        -- THE main chat API endpoint (2454 lines)
  components/
    storefront/
      StorefrontLayout.tsx                   -- App shell (sidebar + header + chat + detail panel)
      ChatArea.tsx                           -- Message history + input bar + AI SDK integration
      DetailPanel.tsx                        -- Right panel for product details / artifact tabs
      StorefrontHeader.tsx                   -- Top header (search, cart badge, user menu, locale)
      StorefrontSidebar.tsx                  -- Left sidebar (nav links, recommended products)
      StorefrontContext.tsx                  -- Context: selectedProduct, artifacts array, activeTab
      ChatMessageContext.tsx                 -- Context: pendingChatMessage bridge
      DesignContext.tsx                      -- Context: activeProductId, latestDesignUrl
    artifacts/
      registry.tsx                           -- Tool name -> Component mapping (16 tools -> 12 components)
      ProductGridArtifact/                   -- Product search results grid
      ProductDetailArtifact/                 -- Single product detail card
      CartSummaryArtifact/                   -- Cart contents display
      OrderListArtifact/                     -- Order history list
      OrderTimelineArtifact/                 -- Order tracking timeline
      DesignPreviewArtifact/                 -- AI-generated design preview
      ApprovalCardArtifact/                  -- Checkout approval dialog
      ProductMockupArtifact/                 -- Design-on-product mockup
      ComparisonTableArtifact/               -- Product comparison table
      SizeGuideArtifact/                     -- Size chart display
      PricingTableArtifact/                  -- Shipping estimates
      ReturnRequestArtifact/                 -- Return request approval
      PersonalizationSuggestionsArtifact/    -- Text personalization suggestions
  hooks/
    useCart.tsx                               -- Cart state (Context + /api/cart)
    useAuth.ts                               -- Auth state (/api/auth/session)
    useWishlist.tsx                           -- Wishlist (Context + /api/wishlist + localStorage guest)
    useProductCache.ts                       -- IndexedDB product cache
    useRecentlyViewed.ts                     -- localStorage recently viewed
    useProductDetail.ts                      -- Single product fetch with client cache
  lib/
    store-config.ts                          -- BRAND, STORE_DEFAULTS, EU_APPROVED_PROVIDERS, SHIPPING_RATES
    design-generation.ts                     -- AI design generation with intent routing
    providers/router.ts                      -- fal.ai provider routing by design intent
```

---

## 2. Layout Architecture

### File: `src/components/storefront/StorefrontLayout.tsx`

**Purpose:** The app shell for the entire `(app)` route group. Wraps all pages in a three-column layout inspired by Claude.ai.

**Structure:**

```
StorefrontProvider  (artifacts, selectedProduct)
  ChatMessageProvider  (pendingChatMessage bridge)
    StorefrontShell
      +---------------------------+------------------+-----------------+
      | Left Sidebar (240px)      | Center Content   | Right Detail    |
      | StorefrontSidebar         | Header + Chat/   | Panel (340px)   |
      | - Navigation              |   Page Content   | - Product view  |
      | - Recommended products    | - ChatArea       | - Artifact tabs |
      | - PodClaw status          | - Footer         | - Design view   |
      +---------------------------+------------------+-----------------+
```

**Key behaviors:**

- `ChatArea` is **always mounted** (dynamically imported, SSR disabled). When the user navigates away from `/chat`, it collapses to `h-0 overflow-hidden` but preserves SSE connection and state.
- The chat page (`/[locale]/chat`) renders `null` -- the layout handles showing ChatArea based on `pathname === /${locale}/chat`.
- The `DetailPanel` appears when `artifacts.length > 0 || selectedProduct` is truthy. On desktop it slides in from the right (340px aside). On mobile it renders as a full-screen overlay.
- `WelcomePopup` is lazy-loaded and shown only on the chat page for first-time visitors.
- `InstallPrompt` (PWA) appears after 3+ visits.
- Desktop sidebar is collapsible via `useSidebarCollapsed` hook (persisted).
- Mobile sidebar uses shadcn `Sheet` component (slide-in drawer).

**Props/State:**

| State | Source | Purpose |
|---|---|---|
| `selectedProduct` | `StorefrontContext` | Product ID to show in DetailPanel |
| `artifacts` | `StorefrontContext` | Array of artifacts open in DetailPanel tabs |
| `pendingChatMessage` | `ChatMessageContext` | Bridge: DetailPanel "Ask about" -> ChatArea input |
| `isSidebarOpen` | Local `useState` | Mobile sidebar Sheet open state |
| `isCollapsed` | `useSidebarCollapsed` | Desktop sidebar collapsed state |

---

### File: `src/components/storefront/StorefrontHeader.tsx`

**Purpose:** Top header bar with navigation links, search, cart badge, locale switcher, theme toggle, and user menu.

**Key features:**
- Navigation links: Chat, Shop (with active state highlighting)
- Search bar (desktop: centered, mobile: full-screen overlay)
- Cart badge with item count from `useCart()`
- Notification bell with unread count from `useNotifications()`
- Locale switcher (en/es/de) with flags
- Theme toggle (light/dark)
- User avatar dropdown (profile, logout) or Login button

**Printify coupling:** None. Header is provider-agnostic.

---

### File: `src/components/storefront/StorefrontSidebar.tsx`

**Purpose:** Left sidebar with store navigation and product recommendations.

**Key features:**
- Brand logo + name (BrandMark component)
- Navigation links: Chat, Shop, New Arrivals, Favorites, Orders, Cart (with badge)
- `UsageMeter` component (shows remaining chat/design quota)
- **Recommended products**: Fetches top 6 by rating via `/api/products?limit=6&sort=topRated`, shuffles, shows 2. Refreshes every 5 minutes.
- **Popular Today**: Fetches top 4 by review_count via `/api/products?limit=4&sort=popular`, selects 1 based on day-of-year seed.
- PodClaw status indicator (green pulse dot)
- Clicking a product in sidebar calls `setSelectedProduct` + `addArtifact` to open DetailPanel.

**Printify coupling:** None. Products are fetched from Supabase via `/api/products`.

---

## 3. Chat API -- Tools & System Prompt

### File: `src/app/api/chat/route.ts` (2454 lines)

This is the **critical file** for the entire conversational interface. It handles:
- Rate limiting (burst, velocity, concurrent slots)
- User authentication and tier resolution (anonymous/free/premium)
- Usage tracking and budget enforcement
- Conversation persistence (Supabase `conversations` + `messages` tables)
- System prompt construction (locale-aware, FAQ context via CAG, RAG augmentation)
- 26 tool definitions
- Streaming response via Gemini 2.5 Flash

### Model & Streaming

| Parameter | Value |
|---|---|
| Model | `gemini-2.5-flash` (Google Generative AI) |
| Max output tokens | anonymous: 2048, free: 4096, premium: 8192 |
| Max tool loop steps | free: 3, premium: 5 |
| Max message chars | 4000 |
| Max context messages | 40 (sliding window) |
| Streaming | SSE via `toUIMessageStreamResponse()` |

### System Prompt Structure

The system prompt includes:
1. **Store identity**: Assistant name, store name, currency (EUR), measurement unit (cm), European store context
2. **Locale instruction**: Language-specific greeting and tone guidance (EN/ES/DE)
3. **FAQ context (CAG)**: Store policies (shipping, returns, privacy, terms) loaded from `/api/policies` and injected directly into context if under 200K tokens
4. **Tool catalog**: Lists all 26 tools with descriptions
5. **Tool selection guidance**: 28 numbered scenarios mapping user intents to tools
6. **Design intent classification**: 7 intent types (text-heavy, photorealistic, vector, artistic, pattern, quick-draft, general)
7. **Privacy classification**: public/private/personal for generated designs
8. **No-results handling**: Instructions for graceful fallback when search returns empty
9. **RAG context**: Semantic search results from `/api/rag/search` appended at the end

### Complete Tool Inventory (26 tools)

#### Product Discovery (5 tools)

| Tool | Parameters | DB Tables | Artifact | Returns |
|---|---|---|---|---|
| `product_search` | `query: string` | `products`, `categories` | `ProductGridArtifact` | `products[]`, `count`, or `noExactMatch` with `suggestions[]` + `availableCategories[]` |
| `browse_catalog` | `category?`, `page?`, `limit?`, `sort?`, `newArrivals?` | `products`, `categories` | `ProductGridArtifact` | `products[]`, `totalCount`, `hasMore`, `page` |
| `get_product_detail` | `productIdentifier: string` (UUID or name) | `products`, `categories` | `ProductDetailArtifact` | Full product with materials, care, safety, shipping, variants |
| `compare_products` | `productIds: string[]` (2-4) | `products`, `categories` | `ComparisonTableArtifact` | `products[]` with materials, printTechnique, manufacturingCountry |
| `get_recommendations` | `category?`, `maxPrice?`, `mode?` ("top_rated"/"new_arrivals"/"popular") | `products`, `categories` | `ProductGridArtifact` | `products[]`, `count`, `mode` |

**Product data format (formatProduct helper):**
```typescript
{
  id: p.id,
  title: p.title,
  description: p.description?.substring(0, 150),
  category: categories.slug,
  price: base_price_cents / 100,
  currency: 'EUR',
  image: images[0].src || images[0].url,
  rating: avg_rating,
  reviewCount: review_count,
}
```

#### Product Information (2 tools)

| Tool | Parameters | Returns |
|---|---|---|
| `get_size_guide` | `productType: string` | Hardcoded size charts (t-shirt, hoodie, generic) in cm |
| `check_availability` | `productId`, `variantId?` | Always "Made to Order" + variant list from `product_variants` table |

#### Cart & Checkout (5 tools)

| Tool | Parameters | DB Tables | Artifact |
|---|---|---|---|
| `add_to_cart` | `productId`, `variantId?`, `size?`, `color?`, `quantity?` | `products`, `product_variants`, `cart_items` | None (text response) |
| `get_cart` | (none) | `cart_items`, `products` | `CartSummaryArtifact` |
| `apply_coupon` | `code: string` | `coupons` | None (text response) |
| `estimate_shipping` | `country?` | (hardcoded `SHIPPING_RATES`) | `PricingTableArtifact` |
| `create_checkout` | `customerEmail?` | `cart_items`, `products` | `ApprovalCardArtifact` (needsApproval) |
| `confirm_checkout` | `confirmed: boolean` | `cart_items`, `products` | Redirects to Stripe checkout URL |

**Cart identification:** Uses `chatUserId` (from Supabase auth token) or `cartSessionId` (from `cart-session-id` cookie). Cart items stored in `cart_items` table with `user_id` or `session_id`.

**Variant resolution logic (add_to_cart):**
1. If `variantId` provided: validate against `product_variants`
2. If `size`/`color` provided: query `product_variants` with `ilike` match
3. If neither: auto-select if only 1 variant, else return `needsVariantSelection` with variant options

#### Order Management (3 tools)

| Tool | Parameters | Requires Auth | Artifact |
|---|---|---|---|
| `track_order` | `orderId?` | Yes (or orderId) | `OrderTimelineArtifact` |
| `get_order_history` | `limit?` | Yes | `OrderListArtifact` |
| `request_return` | `orderId?`, `reason?` | Yes | `ReturnRequestArtifact` (needsApproval) |

#### Design Generation (5 tools)

| Tool | Parameters | External Services | Artifact |
|---|---|---|---|
| `generate_design` | `prompt`, `style?`, `intent?`, `privacy_level?` | fal.ai (Flux Schnell), rembg | `DesignPreviewArtifact` |
| `customize_design` | `original_image_url`, `modifications` | fal.ai (Flux Dev image-to-image), rembg | `DesignPreviewArtifact` |
| `remove_background` | `image_url`, `design_id?` | rembg sidecar | `DesignPreviewArtifact` |
| `ai_design_generate` | `prompt`, `stylePreset?`, `productId?` | fal.ai (via orchestrator) | None (returns image_url in text) |
| `apply_design_to_product` | `generationId`, `productId`, `productType?` | (DB only) | None (needsApproval, creates composition) |

**Design generation pipeline:**
1. Content safety check (`checkPromptSafety`)
2. Usage limit check (separate `design:generate` quota per tier)
3. Intent-based provider routing (`routeDesign` in `providers/router.ts`)
4. Prompt engineering (`engineerPrompt` in `providers/prompt-engineer.ts`)
5. Image generation via fal.ai
6. Auto background removal via rembg sidecar
7. Save to `designs` table in Supabase
8. Return image URL for artifact display

**Design DB tables:** `designs`, `ai_generations`, `user_design_assets`, `design_compositions`

#### Personalization (1 tool)

| Tool | Parameters | Returns |
|---|---|---|
| `personalize_product` | `product_id`, `suggested_texts[]`, `recommended_font?`, `recommended_position?` | Product info + AI-generated text suggestions |

#### Utility (4 tools)

| Tool | Parameters | Returns |
|---|---|---|
| `add_to_wishlist` | `product_id`, `variant_id?` | Success/error (requires auth) |
| `get_store_policies` | (none) | Store policies from `/api/policies` |
| `switch_language` | `locale` ("en"/"es"/"de") | Redirect URL |
| `analyze_image` | `description` | Structured analysis + suggestions |

### Conversation Persistence

| Table | Fields | Purpose |
|---|---|---|
| `conversations` | `id`, `user_id`, `session_id`, `model`, `locale`, `title`, `updated_at` | Conversation metadata |
| `messages` | `id`, `conversation_id`, `role`, `content`, `tool_calls`, `tool_results`, `tokens_used`, `created_at` | Individual messages |

- Conversation ID is sent/received via `x-conversation-id` header
- User messages saved fire-and-forget on each request
- Assistant messages (with tool calls/results and token count) saved in `onFinish` callback
- Conversation title auto-generated from first assistant response (first 100 chars)

### Rate Limiting & Security

| Check | Layer | Details |
|---|---|---|
| Burst rate limit | IP-based | Stricter for requests without fingerprint (`x-fp-id`) |
| Active block check | Identifier | Auto-blocked by anomaly monitor |
| Velocity check | Identifier | Anti-bot: 5+ msgs in <3s triggers block |
| Concurrent slot limit | Identifier | Max 2 streaming requests per user |
| Daily chat limit | Tier-based | `checkAndIncrementUsage(identifier, 'chat', tier)` |
| Daily message limit | Tier-based | `checkAndIncrementUsage(identifier, 'chat:messages', tier)` |
| Anomaly detection | Tier-based | Checks consumption rate against tier limits |
| Daily token budget | Tier-based | `checkTokenBudget(identifier, tier)` |
| Message length | Global | Max 4000 chars per user message |
| Context window | Global | Max 40 messages (sliding window) |
| Content safety | Per-design | `checkPromptSafety()` before design generation |
| Input sanitization | Per-query | `sanitizeForPostgrest()` and `sanitizeForLike()` for SQL injection prevention |

### Cost Monitoring

```typescript
// Estimated cost alert for expensive responses
const estimatedCost = (inputTk * 0.30 + outputTk * 1.25) / 1_000_000
if (estimatedCost > 0.05) {
  console.warn('[CostAlert] expensive_response', { ... })
}
```

---

## 4. Artifact Registry & Components

### File: `src/components/artifacts/registry.tsx`

Maps tool names to React components. Each entry has a `Component` (full render) and `Skeleton` (loading state).

### Tool-to-Artifact Mapping

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
| `personalize_product` | `PersonalizationSuggestionsArtifact` | `PersonalizationSuggestionsSkeleton` |

**Tools WITHOUT visual artifacts** (return text-only responses): `add_to_cart`, `apply_coupon`, `confirm_checkout`, `add_to_wishlist`, `get_store_policies`, `switch_language`, `analyze_image`, `check_availability`, `ai_design_generate`, `apply_design_to_product`

### Artifact Component Details

#### ProductGridArtifact (`src/components/artifacts/ProductGridArtifact/ProductGridArtifact.tsx`)

- **Purpose:** Renders product search/browse results as a responsive card grid within chat messages.
- **Props:** `products: ProductCard[]`, `onSelectProduct`, `variant` (inline/full)
- **Features:** Max 6 items for inline variant, square image aspect ratio, wishlist heart toggle, "Add to Cart" button (calls `useCart().addToCart`), "View Details" button (opens DetailPanel), star rating.
- **Product data consumed:**
  - `id`, `title`, `price`, `currency`, `image`, `rating`
  - `image` URLs come from Supabase `products.images[0].src` -- these are **Printify CDN URLs** (images.printify.com).

#### ProductDetailArtifact (`src/components/artifacts/ProductDetailArtifact/ProductDetailArtifact.tsx`)

- **Purpose:** Shows full product details in a card layout within chat.
- **Props:** `product: ProductDetail`, `onAddToCart`, `onAddToWishlist`, `variant`
- **Displays:** Title, price, category badge, rating, description, variant badges (sizes), materials, care instructions, print technique, manufacturing country, safety information (collapsible with `SafeHTML`), shipping info.
- **Printify-sourced data:** `materials`, `printTechnique`, `manufacturingCountry`, `safetyInformation`, `careInstructions` -- all come from `product_details` JSONB in Supabase, populated by Printify sync.

#### CartSummaryArtifact (`src/components/artifacts/CartSummaryArtifact/CartSummaryArtifact.tsx`)

- **Purpose:** Displays current cart contents with item list, subtotal, and action buttons.
- **Props:** `items: CartItem[]`, `itemCount`, `subtotal`, `currency`, `variant`
- **Actions:** "View Full Cart" (navigates to `/cart`), "Proceed to Checkout" (navigates to `/checkout`).
- **Printify coupling:** None. Cart items reference Supabase product IDs.

#### OrderListArtifact (`src/components/artifacts/OrderListArtifact/OrderListArtifact.tsx`)

- **Purpose:** Displays user's order history as a list.
- **Props:** `orders: OrderItem[]`, `variant`
- **Displays:** Order ID (truncated), date, status badge (color-coded), total price, "View Details" and "Track Order" buttons.
- **Printify coupling:** None. Orders stored in Supabase `orders` table.

#### OrderTimelineArtifact (`src/components/artifacts/OrderTimelineArtifact/OrderTimelineArtifact.tsx`)

- **Purpose:** Visual timeline of order status progression.
- **Props:** `orderId`, `status`, `trackingNumber`, `estimatedDelivery`, `createdAt`, `paidAt`, `shippedAt`, `deliveredAt`, `currency`, `total`, `variant`
- **Timeline events:** Placed -> Paid -> Processing -> Shipped -> Delivered (with icons and completion state).
- **Printify coupling:** Order status values (`pending`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`) must match whatever the fulfillment provider reports via webhooks.

#### DesignPreviewArtifact (`src/components/artifacts/DesignPreviewArtifact/DesignPreviewArtifact.tsx`)

- **Purpose:** Shows AI-generated design with action buttons.
- **Props:** `imageUrl`, `prompt`, `style`, `designId`, `provider`, `onCustomize`, `onAddToProduct`, `onViewMockup`, `variant`
- **Actions:** Download, Remove Background (calls `/api/designs/remove-bg`), View Mockup (calls `/api/designs/mockup`), Add to Product.
- **Printify coupling:** None directly. Mockup generation uses separate mockup API, not Printify's mockup generator.

#### ApprovalCardArtifact (`src/components/artifacts/ApprovalCardArtifact/ApprovalCardArtifact.tsx`)

- **Purpose:** Checkout approval dialog requiring user confirmation before Stripe redirect.
- **Props:** `cartItems[]`, `subtotal`, `onApprove`, `onDeny`, `variant`
- **Printify coupling:** None. This is purely a cart summary + confirmation UI.

#### ProductMockupArtifact (`src/components/artifacts/ProductMockupArtifact/ProductMockupArtifact.tsx`)

- **Purpose:** Shows a design applied to a product mockup image.
- **Props:** `mockupUrl`, `designUrl`, `productType`, `productName`, `onAddToCart`, `variant`
- **Product types:** `tshirt`, `hoodie`, `mug`, `phone-case`, `tote-bag`
- **Printify coupling:** The mockup images could be from any source. Currently uses client-side overlay (design image positioned on top of product template).

---

## 5. State Management

### StorefrontContext (`src/components/storefront/StorefrontContext.tsx`)

Central state for the storefront shell.

```typescript
interface Artifact {
  id: string
  type: 'product' | 'design' | 'comparison' | 'cart' | 'order' | 'other'
  title: string
  data: any
}

interface StorefrontContextType {
  selectedProduct: string | null          // Legacy: product ID for DetailPanel
  setSelectedProduct: (id) => void
  artifacts: Artifact[]                   // Tab-based artifacts in DetailPanel
  addArtifact: (artifact) => void         // Add or update artifact (activates it)
  removeArtifact: (id) => void            // Remove artifact tab
  clearArtifacts: () => void              // Close all artifact tabs
  activeArtifactId: string | null         // Currently active tab
  setActiveArtifactId: (id) => void
}
```

**Behavior:**
- `addArtifact` replaces existing artifact with same ID, then activates it.
- DetailPanel shows when `artifacts.length > 0 || selectedProduct` is truthy.
- Multiple artifacts render as tabs in DetailPanel.

### ChatMessageContext (`src/components/storefront/ChatMessageContext.tsx`)

Lightweight bridge for cross-component message passing.

```typescript
interface ChatMessageContextType {
  pendingChatMessage: string            // Text to inject into ChatArea input
  setPendingChatMessage: (msg) => void
}
```

**Use case:** DetailPanel's "Ask about this product" button sets `pendingChatMessage`, ChatArea picks it up via `useEffect` and fills the input field.

### DesignContext (`src/components/storefront/DesignContext.tsx`)

State for the AI design workflow.

```typescript
interface DesignContextType {
  activeProductId: string | null
  setActiveProductId: (id) => void
  latestDesignUrl: string | null
  setLatestDesignUrl: (url) => void
  latestGenerationId: string | null
  setLatestGenerationId: (id) => void
}
```

**Note:** DesignContext is defined but not currently wrapped in `StorefrontLayout`. It is available for the `DesignStudio` component workflow.

### Chat Session Persistence

Chat messages are persisted in `sessionStorage` (browser tab-scoped):

| Key | Content | TTL |
|---|---|---|
| `pod-chat-messages` | Serialized message array (text + tool output parts only) | 3 hours (anonymous) |
| `pod-chat-ts` | Timestamp of first message | Used for TTL calculation |
| `pod-conversation-id` | UUID for conversation continuity | Survives navigation |

**Expiration:**
- Anonymous users: 3-hour TTL, checked on mount, visibility change, focus, and every 10 minutes.
- Authenticated users: No TTL (persists until tab closes).
- On expiration: clears sessionStorage and resets messages array.

---

## 6. Data Flow

### Product Search Flow

```
User types "show me hoodies"
  |
  v
ChatArea.sendMessage({ text: "show me hoodies" })
  |
  v
POST /api/chat (SSE stream)
  |
  v
Gemini 2.5 Flash identifies intent -> calls product_search(query="hoodie")
  |
  v
Supabase query: products.select(...).eq('status','active')
                  .or('title.wfts.hoodie,description.wfts.hoodie')
  |
  v
Tool returns: { success: true, products: [...], count: N }
  |
  v
AI SDK streams tool-invocation part with output
  |
  v
ChatArea renders: isToolUIPart(part) -> getArtifact("product_search")
  |                                      -> ProductGridArtifact
  v
User clicks product card -> onSelectProduct(productId, productData)
  |
  v
setSelectedProduct(productId) + addArtifact({ type: 'product', data })
  |
  v
DetailPanel appears (right panel / mobile overlay)
  |
  v
useProductDetail(productId, locale) -> GET /api/products/{id}?locale=en
  |
  v
ProductView renders with full details, variant selectors, add-to-cart
```

### Add to Cart Flow (via Chat)

```
User: "add the blue hoodie to my cart"
  |
  v
Gemini identifies product ID from conversation context
  |
  v
add_to_cart(productId=<uuid>, color="Blue", quantity=1)
  |
  v
1. Validate product exists in products table
2. Resolve variant_id:
   - Query product_variants WHERE product_id AND color ILIKE 'Blue'
   - Auto-select if single variant, else return needsVariantSelection
3. Check existing cart_items for same product+variant
4. If exists: UPDATE quantity (capped at STORE_DEFAULTS.maxCartQuantity=99)
5. If new: INSERT into cart_items
  |
  v
Returns: { success: true, message: "Added 1x Blue Hoodie to cart" }
  |
  v
No artifact rendered (text-only response)
```

### Add to Cart Flow (via Artifact Button)

```
User clicks "Add to Cart" on ProductGridArtifact card
  |
  v
ChatArea.handleAddToCart(productId, title, price)
  |
  v
useCart().addToCart(productId, 1, undefined, title, price)
  |
  v
POST /api/cart { product_id, quantity: 1, product_title, product_price }
  |
  v
If VARIANT_REQUIRED error -> setSelectedProduct(productId) to open DetailPanel
  |
  v
toast.success("Added to cart")
```

### Checkout Flow

```
User: "checkout" or "I want to pay"
  |
  v
create_checkout() [needsApproval: true]
  |
  v
1. Fetch cart_items for user/session
2. Fetch product details for cart items
3. Build displayCartItems array
4. Return { needsApproval: true, cartItems, subtotal }
  |
  v
ApprovalCardArtifact renders in chat with cart summary
  |
  v
User clicks "Approve" button
  |
  v
ChatArea.handleApprove():
  POST /api/checkout/create-session { cartItems, locale, currency }
  |
  v
Stripe creates checkout session
  |
  v
window.location.href = stripeCheckoutUrl (redirects to Stripe)
```

### Design Generation Flow

```
User: "design a cat t-shirt"
  |
  v
Gemini classifies intent: "artistic"
  |
  v
generate_design(prompt="cat t-shirt", intent="artistic")
  |
  v
1. checkPromptSafety(prompt)
2. checkAndIncrementUsage(identifier, 'design:generate', tier)
3. generateDesign({ prompt, intent: 'artistic' })
   -> routeDesign('artistic') selects fal-ai/flux/schnell
   -> engineerPrompt(prompt) enhances prompt
   -> POST to fal.ai API
4. Auto bg removal: removeBackground(imageUrl) via rembg sidecar
5. Save to designs table in Supabase
  |
  v
Returns: { success: true, imageUrl, prompt, designId, provider, bgRemoved }
  |
  v
DesignPreviewArtifact renders in chat with:
  - Design image
  - Download button
  - Remove BG button (if not already done)
  - View Mockup button
  - Add to Product button
```

### Image Data Flow (Critical for Migration)

Product images flow through this chain:

```
Printify CDN (images.printify.com)
  |
  v
Printify Sync (cron/sync-printify) writes to products.images JSONB
  |  Format: [{ src: "https://images.printify.com/...", variant_ids: [...] }]
  |
  v
/api/products returns images[0].src as product.image
  |
  v
ProductGridArtifact, ProductDetailArtifact, DetailPanel consume image URLs
```

**Design images** flow differently:
```
fal.ai CDN (fal.media/...)
  |
  v
designs.image_url in Supabase
  |
  v
DesignPreviewArtifact, ProductMockupArtifact
```

---

## 7. Printify Coupling Analysis

### Direct Printify References in Chat Interface

The chat interface has **NO direct Printify API calls**. All product data comes from Supabase tables that are populated by the Printify sync cron job. The coupling is indirect:

#### 7.1 Product Data Structure

The `products` table schema was designed around Printify's data model:

| Supabase Column | Printify Origin | Used By Chat |
|---|---|---|
| `images` (JSONB) | `images` array with `src` URLs from Printify CDN | `formatProduct()`, all artifact components |
| `base_price_cents` | Calculated from Printify variant prices | All price displays |
| `product_details` (JSONB) | Manual GPSR data + Printify product metadata | `get_product_detail` tool |
| `product_details.material` | Manual entry (GPSR requirement) | ProductDetailArtifact |
| `product_details.print_technique` | Manual entry | ProductDetailArtifact |
| `product_details.manufacturing_country` | Manual entry | ProductDetailArtifact |
| `product_details.safety_information` | Printify GPSR endpoint | ProductDetailArtifact (SafeHTML) |
| `product_details.care_instructions` | Manual entry | ProductDetailArtifact |
| `category_id` | Mapped during sync from Printify product types | Category filtering |
| `status` | Synced from Printify publish status | Active product filtering |

#### 7.2 Variant Structure

The `product_variants` table mirrors Printify's variant model:

| Column | Printify Origin | Used By |
|---|---|---|
| `product_id` | FK to products | `add_to_cart`, `check_availability` |
| `size` | Printify variant option (e.g., "M", "L") | Variant resolution in `add_to_cart` |
| `color` | Printify variant option (e.g., "Black") | Variant resolution in `add_to_cart` |
| `price_cents` | Printify variant price | Variant price display |
| `is_enabled` | Printify `is_enabled` flag | Availability filtering |
| `is_available` | Printify `is_available` flag | Availability filtering |
| `image_url` | Synced from Printify variant-image mapping | Color image toggles in ProductCard |

#### 7.3 Image URLs

All product images are hosted on Printify's CDN:
- Format: `https://images.printify.com/mockup/...`
- Stored in `products.images` JSONB array as `{ src: "url", variant_ids: [...] }`
- Used by `formatProduct()`: `images[0].src || images[0].url`
- Used by `get_product_detail` tool: full `images` array returned
- Used by all artifact components via `product.image` or `product.images`

#### 7.4 EU Provider Validation

```typescript
// src/lib/store-config.ts
export const EU_APPROVED_PROVIDERS = new Set([26, 410, 90, 23, 30, 255, 86])
export function isEUProvider(providerId: number): boolean {
  return EU_APPROVED_PROVIDERS.has(providerId)
}
```

This is used in `src/app/api/designs/[id]/create-product/route.ts` to block non-EU providers. The chat tools themselves do not call `isEUProvider()`.

#### 7.5 System Prompt References

The system prompt contains these Printify-relevant phrases:
- "European print-on-demand store" -- general POD reference
- "Made to order" -- POD availability model (always available)
- Shipping info: "Made to order in {country}" -- references `product_details.manufacturing_country`
- Size guides are hardcoded, not from Printify

#### 7.6 Order Status Pipeline

The `track_order` tool reads from the `orders` table which has a status field. The order lifecycle is:
```
pending -> paid -> processing/submitted -> in_production -> shipped -> delivered
```
These status values are set by:
1. Stripe webhook (`paid`)
2. Printify webhook (`processing`, `in_production`, `shipped`)
3. Manual/carrier (`delivered`)

The `OrderTimelineArtifact` maps these to a visual timeline. The status names are somewhat generic but `in_production` is POD-specific.

---

## 8. Migration Impact Assessment

### Zero-Change Components (Provider Agnostic)

These components have NO Printify coupling and require no changes:

| Component | Reason |
|---|---|
| `StorefrontLayout.tsx` | Pure layout shell |
| `StorefrontHeader.tsx` | Navigation/search only |
| `StorefrontSidebar.tsx` | Fetches from Supabase API, not Printify directly |
| `ChatArea.tsx` | AI SDK integration, message rendering |
| `StorefrontContext.tsx` | Generic state management |
| `ChatMessageContext.tsx` | Message bridge only |
| `DesignContext.tsx` | Design state only |
| `CartSummaryArtifact.tsx` | Uses Supabase cart data |
| `OrderListArtifact.tsx` | Uses Supabase order data |
| `ApprovalCardArtifact.tsx` | Generic cart confirmation |
| `DesignPreviewArtifact.tsx` | Uses fal.ai, not Printify |
| `ProductMockupArtifact.tsx` | Client-side mockup overlay |
| `useAuth.ts` | Supabase auth only |
| `useCart.tsx` | Supabase cart API only |
| `useWishlist.tsx` | Supabase wishlist API only |
| `useProductCache.ts` | Caches from `/api/products` |
| `useRecentlyViewed.ts` | localStorage only |
| `useProductDetail.ts` | Fetches from `/api/products/[id]` |

### Low-Impact Components (Data Shape Dependent)

These consume product data from Supabase but are agnostic to provider. Migration impact depends on whether new provider's synced data maintains the same Supabase schema:

| Component | Migration Notes |
|---|---|
| `ProductGridArtifact.tsx` | Consumes `ProductCard` type. If `images` structure changes in DB, `formatProduct()` in route.ts needs updating. |
| `ProductDetailArtifact.tsx` | Consumes full product with `materials`, `printTechnique`, `manufacturingCountry`. These fields must be populated for new provider. |
| `OrderTimelineArtifact.tsx` | Status values must match new provider's webhook status names. |
| `ComparisonTableArtifact.tsx` | Same as ProductDetailArtifact. |

### Medium-Impact: Chat API Route (`src/app/api/chat/route.ts`)

The chat API route is the **primary migration target** for the chat interface:

| Area | Impact | Details |
|---|---|---|
| `formatProduct()` helper (lines 31-43) | LOW | Reads from Supabase, not Printify directly. Change only if DB schema changes. |
| `get_product_detail` tool (lines 652-722) | LOW | Reads `product_details` JSONB. New provider must populate same fields. |
| `check_availability` tool (lines 885-957) | LOW | Queries `product_variants` table. Stock model is "Made to Order" -- same for any POD provider. |
| `add_to_cart` variant resolution (lines 959-1104) | LOW | Queries `product_variants`. Same schema must be maintained. |
| System prompt (lines 373-494) | LOW | Replace "print-on-demand" references if needed. "Made to Order" model stays the same. |
| `confirm_checkout` Stripe session (lines 1379-1480) | NONE | Provider-agnostic Stripe integration. |
| Design tools (lines 1733-2310) | NONE | Uses fal.ai, not Printify. |

### High-Impact: Backend Sync Layer (NOT in chat interface)

The following files are NOT part of the chat interface but are the **actual Printify coupling points** that would need full replacement:

| File | Purpose |
|---|---|
| `src/lib/printify.ts` | PrintifyClient class (API calls) |
| `src/lib/printify-sync.ts` | Cron sync that populates products/variants in Supabase |
| `src/app/api/cron/sync-printify/route.ts` | Cron endpoint |
| `src/app/api/designs/[id]/create-product/route.ts` | Creates products in Printify |
| `src/lib/store-config.ts` | `EU_APPROVED_PROVIDERS` set |

### Migration Checklist for Chat Interface

1. **Maintain Supabase schema**: Keep `products`, `product_variants`, `cart_items`, `orders` tables with same columns. The entire chat interface reads from these tables, not from any provider API.

2. **Image URL migration**: All product images currently reference `images.printify.com`. New provider's sync must populate `products.images` with the new CDN URLs in the same `[{ src: "url" }]` format.

3. **Variant structure**: `product_variants` table must maintain `size`, `color`, `price_cents`, `is_enabled`, `is_available`, `image_url` columns.

4. **Product details JSONB**: `products.product_details` must contain `material`, `care_instructions`, `print_technique`, `manufacturing_country`, `safety_information`, `brand`.

5. **Order status webhook mapping**: Map new provider's order statuses to: `pending`, `paid`, `processing`/`submitted`, `in_production`, `shipped`, `delivered`.

6. **EU provider validation**: Update `EU_APPROVED_PROVIDERS` set in `store-config.ts` with new provider IDs (or remove if switching to a single provider like Printful).

7. **Size guides**: Currently hardcoded in the `get_size_guide` tool. Update measurements if new provider's blanks have different sizing.

8. **Shipping rates**: Currently hardcoded in `SHIPPING_RATES` in `store-config.ts`. Update if new provider has different shipping costs/zones.

---

## Appendix A: Product Type Definitions

```typescript
// src/types/product.ts -- Three-tier hierarchy

interface ProductBase {
  id: string; title: string; price: number; currency: string; image: string | null
}

interface ProductCard extends ProductBase {
  description: string; rating?: number; reviewCount?: number; category?: string
  inStock?: boolean; stock?: number; createdAt?: string
  compareAtPrice?: number; labels?: string[]
  variants?: { sizes?: string[]; colors?: string[]; colorImages?: Record<string, string> }
}

interface ProductDetail extends Omit<ProductCard, 'variants'> {
  images: string[]
  materials?: string | null; careInstructions?: string | null
  printTechnique?: string | null; manufacturingCountry?: string | null
  brand?: string | null; safetyInformation?: string | null; finish?: string | null
  variants?: {
    sizes?: string[]; colors?: string[]
    allColors?: string[]; allSizes?: string[]
    colorImages?: Record<string, string>
    colorImageIndices?: Record<string, number[]>
    sizeImageIndices?: Record<string, number[]>
    unavailableCombinations?: Array<{ color: string; size: string }>
  }
}
```

## Appendix B: AI SDK 6 Integration Details

```typescript
// ChatArea.tsx -- Key integration points

// Transport: SSE with custom fetch (CSRF + conversation ID headers)
const transport = new DefaultChatTransport({ api: '/api/chat', fetch: customFetch })

// Hook: AI SDK 6 useChat
const { messages, setMessages, sendMessage, status, addToolApprovalResponse, error } = useChat({
  transport,
  messages: initialMessages, // Restored from sessionStorage
})

// Message rendering: parts array with text, tool-invocation, file parts
message.parts.map((part) => {
  if (part.type === 'text') -> SafeMarkdown
  if (part.type === 'file') -> <img>
  if (isToolUIPart(part)) -> getArtifact(toolName) -> Component/Skeleton
})

// Special tool handling:
// - needsApproval tools (create_checkout, request_return) render with onApprove/onDeny callbacks
// - confirm_checkout with checkoutUrl triggers window.location.href redirect
// - output.success === false -> null (no artifact rendered)
```

## Appendix C: File Sizes and Line Counts

| File | Lines | Tokens (approx) |
|---|---|---|
| `api/chat/route.ts` | 2454 | ~28K |
| `ChatArea.tsx` | 968 | ~9K |
| `DetailPanel.tsx` | 519 | ~5K |
| `StorefrontSidebar.tsx` | 300 | ~3K |
| `StorefrontHeader.tsx` | 315 | ~3K |
| `StorefrontLayout.tsx` | 160 | ~2K |
| `StorefrontContext.tsx` | 82 | ~1K |
| `ChatMessageContext.tsx` | 29 | ~300 |
| `DesignContext.tsx` | 42 | ~400 |
| `registry.tsx` | 103 | ~1K |
| `ProductGridArtifact.tsx` | 168 | ~2K |
| `ProductDetailArtifact.tsx` | 245 | ~3K |
| `CartSummaryArtifact.tsx` | 135 | ~1.5K |
| `OrderListArtifact.tsx` | 153 | ~2K |
| `OrderTimelineArtifact.tsx` | 258 | ~3K |
| `DesignPreviewArtifact.tsx` | 218 | ~2K |
| `ApprovalCardArtifact.tsx` | 119 | ~1.5K |
| `ProductMockupArtifact.tsx` | 143 | ~1.5K |
| `useCart.tsx` | 265 | ~2.5K |
| `useAuth.ts` | 164 | ~1.5K |
| `useWishlist.tsx` | 277 | ~2.5K |
| `useProductCache.ts` | 39 | ~400 |
| `useRecentlyViewed.ts` | 69 | ~600 |
| `useProductDetail.ts` | 81 | ~800 |
