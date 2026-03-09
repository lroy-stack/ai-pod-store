# 06 - Chat Interface & Artifacts Panel — Exhaustive Documentation

**Date**: 2026-03-08
**Scope**: `src/components/storefront/ChatArea.tsx`, `ChatInputBar.tsx`, `ChatMessages.tsx`, `ChatWelcome.tsx`, `src/components/artifacts/*`, `src/hooks/useChat*.ts`, `src/hooks/useImageUpload.ts`, `src/lib/chat/tools.ts`, `src/lib/chat/context.ts`, `StorefrontLayout.tsx`, `DetailPanel.tsx`, `StorefrontContext.tsx`, `ChatMessageContext.tsx`, `BottomNav.tsx`

---

## 1. Architecture Overview

The chat system follows a **claude.ai-inspired** three-column layout:

```
+------------------+---------------------------+-------------------+
| Sidebar (240px)  |     Center Column         | DetailPanel(340px)|
| StorefrontSidebar|  StorefrontHeader          | Artifact tabs     |
|                  |  ChatArea (or children)    | Product detail    |
|                  |    ChatWelcome / Messages  | Design preview    |
|                  |    SignupBanner             |                   |
|                  |    ChatInputBar            |                   |
+------------------+---------------------------+-------------------+
                   |     BottomNav (mobile)     |
                   +---------------------------+
```

**Key architectural decisions:**
- ChatArea is **always mounted** in StorefrontLayout. When not on `/chat`, it collapses to `h-0 overflow-hidden pointer-events-none` to preserve SSE connection and state.
- ChatArea is **dynamically imported** (`next/dynamic`, `ssr: false`) with a loading fallback.
- Two React contexts coordinate state: `StorefrontContext` (artifacts, selectedProduct) and `ChatMessageContext` (pending messages from DetailPanel to chat).
- The AI SDK 6 (Vercel) powers the transport layer via `useChat()` + `DefaultChatTransport`.

### Component Hierarchy

```
StorefrontLayout
  StorefrontProvider
    ChatMessageProvider
      StorefrontShell
        StorefrontSidebar (desktop aside / Sheet mobile)
        main
          StorefrontHeader
          OfflineBanner
          SubscriptionStatusBanner
          div (chat container, flex-1 when isChatPage, h-0 otherwise)
            ErrorBoundary
              ChatArea
                ChatWelcome (when messages.length === 0)
                ChatMessages (when messages.length > 0)
                SignupBanner
                ChatInputBar
                AuthWallModal
                UpgradeModal
          div (children container, non-chat pages)
            {children}
            Footer
        DetailPanel (desktop aside lg:flex, mobile full-screen overlay)
        BottomNav (mobile fixed bottom)
        InstallPrompt
        WelcomePopup (on /chat, first visit)
```

---

## 2. ChatArea.tsx — Orchestrator

**File**: `src/components/storefront/ChatArea.tsx` (268 lines)

### Role
Top-level orchestrator that composes all chat sub-components and hooks. Does not render UI directly beyond layout divs.

### State

| State/Ref | Type | Source | Purpose |
|---|---|---|---|
| `userData` | `{ user, activeOrders, recentFavorites }` | `useState` + `useEffect` fetch | Welcome screen personalization |
| `initialMessages` | `SerializedMessage[] \| undefined` | `useChatSession` | Restored from sessionStorage |
| `conversationIdRef` | `RefObject<string \| null>` | `useChatSession` | Session continuity header |
| `messages` | `Message[]` | `useChatTransport` (AI SDK) | Live message history |
| `status` | AI SDK status | `useChatTransport` | `submitted` / `streaming` / `idle` |
| `isLoading` | boolean | Derived: `status === 'submitted' \|\| status === 'streaming'` | Disables input |
| `isLimitReached` | boolean | `useChatTransport` | Blocks input for limit-hit users |
| `showAuthWall` | boolean | `useChatTransport` | Shows auth modal |
| `showUpgrade` | boolean | `useChatTransport` | Shows upgrade modal |
| `image.*` | `useImageUpload` return | Hook | Image selection, drag-drop, FileReader |
| `scrollContainerRef` | `RefObject<HTMLDivElement>` | `useRef` | Auto-scroll container |
| `messagesEndRef` | `RefObject<HTMLDivElement>` | `useRef` | Scroll-to-bottom anchor |
| `userScrolledUpRef` | `RefObject<boolean>` | `useRef` | Prevents auto-scroll if user scrolled up >150px |

### Data Fetching (on mount)

Parallel fetch of 3 endpoints:
1. `GET /api/auth/session` — current user
2. `GET /api/orders?limit=3&status=processing,pending` — active orders
3. `GET /api/wishlist` — recent favorites (extracts first 3 items)

Results stored in `userData` for `ChatWelcome`.

### Auto-scroll Behavior

- `handleScroll`: Sets `userScrolledUpRef.current = true` when `scrollHeight - scrollTop - clientHeight > 150`.
- On `messages.length` change: if user has NOT scrolled up, `requestAnimationFrame` + `messagesEndRef.scrollIntoView({ behavior: 'smooth' })`.

### Pending Messages (Cross-Component Communication)

DetailPanel can send questions to chat via `ChatMessageContext`:
- `pendingChatMessage` is set by `DetailPanel.onAskAbout`.
- `ChatArea` watches it in a `useEffect`: when non-empty, calls `sendMessage({ text })` and clears it.

### Session Lifecycle

- `sessionExpired` from `useChatSession`: when true and messages exist, calls `setMessages([])` (one-shot).
- `persistMessages(messages)` is called on every `messages` change (debounced by hook).

### Prompt Suggestions

When `messages.length === 0`, generates 4 `PromptSuggestion` objects from i18n keys:
- Design, T-shirt, Trending, Gift

### Handlers

| Handler | Action |
|---|---|
| `handlePromptClick(prompt)` | `sendMessage({ text: prompt })` |
| `handleAddToCart(productId, title?, price?)` | `addToCart()`, on VARIANT_REQUIRED opens DetailPanel |
| `handleSelectProduct(productId, productData?)` | `setSelectedProduct(id)`, `addArtifact()` to open DetailPanel |
| `handleSubmit(text, imageData)` | Sends text or text+image via `sendMessage()`, clears image |

### Layout Structure

```html
<div flex flex-col flex-1 min-h-0 onDragOver onDrop>
  <!-- Scrollable messages -->
  <div ref={scrollContainerRef} flex-1 min-h-0 overflow-y-auto overscroll-contain onScroll>
    <div px-3 py-4 sm:px-4 md:px-6 md:py-6>
      {messages.length === 0 ? <ChatWelcome /> : <ChatMessages />}
    </div>
  </div>

  <SignupBanner messageCount={messages.length} />

  <!-- Input pinned at bottom (flex-shrink-0) -->
  <ChatInputBar ... />

  <!-- Modals -->
  <AuthWallModal />
  <UpgradeModal />
</div>
```

**Key responsive notes:**
- Padding: `px-3 py-4` base, `sm:px-4`, `md:px-6 md:py-6`.
- The entire area supports drag-and-drop for image upload.
- `overscroll-contain` prevents rubber-banding on mobile.

---

## 3. ChatInputBar.tsx — Input Component

**File**: `src/components/storefront/ChatInputBar.tsx` (211 lines)

### Visual Structure

```
+--------------------------------------------------+
| [Prompt Chip] [Prompt Chip] [Prompt Chip] [...]   | <-- horizontal scroll, only when no messages
+--------------------------------------------------+
| +----------------------------------------------+ |
| | [image preview 14x14 w/ X remove]            | |
| |                                               | |
| | [Paperclip] [___input field___] [Mic] [Send] | |
| +----------------------------------------------+ |
|      AI responses may be inaccurate (10px)       |
+--------------------------------------------------+
```

### Props

```ts
interface ChatInputBarProps {
  onSubmit: (text: string, image: string | null) => void
  isLoading: boolean
  isLimitReached: boolean
  isLoggedIn: boolean
  locale: string
  selectedImage: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAttachClick: () => void
  onRemoveImage: () => void
  suggestions?: PromptSuggestion[]
  onSuggestionClick?: (prompt: string) => void
}
```

### Internal State
- `inputValue: string` — controlled text input

### Voice Input
Uses `useSpeechToText` hook with:
- `locale` prop passed through
- `continuous: false`, `interimResults: true`
- `onTranscript(transcript, isFinal)`: appends to inputValue when final
- `onError`: `toast.error()`

### Prompt Suggestions (chips)
- Rendered as horizontally scrollable `overflow-x-auto scrollbar-hide` buttons
- Each chip: `rounded-full border border-border/60 bg-card/80`, `text-xs`, `whitespace-nowrap`, `active:scale-95`
- Only shown when `suggestions.length > 0` and `onSuggestionClick` exists

### Input Container
- `bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl shadow-lg`
- Image preview: 14x14 thumbnail with destructive X button (absolute positioned)
- Hidden file input: `accept="image/*"`
- Paperclip button: `variant="ghost"`, `h-9 w-9 sm:h-10 sm:w-10 rounded-full`
- Input field: `<Input>` from shadcn/ui, `border-0 bg-transparent shadow-none focus-visible:ring-0`, `text-sm`
- Mic button: conditional on `isSpeechSupported`, red pulse animation when recording
- Send button: `h-9 w-9 sm:h-10 sm:w-10 rounded-full`, disabled when empty

### Keyboard
- `Enter` (no Shift) submits the form
- `Shift+Enter` does nothing special (single-line Input, not Textarea)

### Responsive Breakpoints
- `px-3 pb-2 pt-1` base, `sm:px-4`, `md:px-6 md:pb-3 md:pt-2`
- Button sizes: `h-9 w-9` base, `sm:h-10 sm:w-10`
- Input min-height: `min-h-[36px]` base, `sm:min-h-[40px]`
- Disclaimer text: `text-[10px]` base, `sm:text-xs`
- `max-w-4xl mx-auto` constrains width on large screens

---

## 4. ChatMessages.tsx — Message Renderer

**File**: `src/components/storefront/ChatMessages.tsx` (328 lines)

### Layout Structure

```
<div max-w-4xl mx-auto space-y-4>
  {messages.map(message => (
    <div flex gap-3 justify-end|justify-start>
      {assistant && <Avatar 8x8>}
      <div user-bubble | assistant-parts>
        {message.parts.map(part => TextPart | FilePart | ToolArtifact)}
      </div>
      {user && <Avatar 8x8>}
    </div>
  ))}
  {isLoading && <TypingIndicator />}
  {error && <ErrorDisplay />}
  <div ref={messagesEndRef} />
</div>
```

### Message Rendering

**User messages:**
- Aligned right (`justify-end`)
- Bubble: `rounded-2xl bg-primary text-primary-foreground px-4 py-2 max-w-[80%]`
- Avatar: `<User>` icon fallback, `h-8 w-8`, positioned after content

**Assistant messages:**
- Aligned left (`justify-start`)
- Avatar: Brand logo (light/dark variants), `h-8 w-8`, positioned before content
- Content wrapper: `flex-1 min-w-0 space-y-2`
- Text parts: `bg-muted rounded-2xl w-fit max-w-full prose prose-sm dark:prose-invert px-4 py-2.5`, rendered via `<SafeMarkdown>`
- File parts (user uploads): `<img>` with `max-w-xs rounded-lg border`

### Part Types Handled

| Part Type | Renderer |
|---|---|
| `text` (assistant) | `<SafeMarkdown>` in muted bubble |
| `text` (user) | Plain `<p>` in primary bubble |
| `file` (user) | `<img>` thumbnail |
| `tool-ui` (via `isToolUIPart`) | `<ToolArtifact>` internal component |

### ToolArtifact Internal Component

Resolves tool name via `getToolName(part)` and looks up in `artifactRegistry`. Handles 5 states:

1. **`input-streaming` / `input-available`**: Renders `<artifact.Skeleton />`
2. **`output-available` + `needsApproval` + `create_checkout`**: Renders `ApprovalCardArtifact` with `handleApprove` (creates Stripe session via `POST /api/checkout/create-session`)
3. **`output-available` + `needsApproval` + `request_return`**: Renders `ReturnRequestArtifact` with `handleApprove` (submits return via `POST /api/orders/{id}/returns`)
4. **`output-available` + `checkoutUrl` + `confirm_checkout`**: Renders `<CheckoutRedirect>` (safe redirect via `useEffect`)
5. **`output-available` + `success === false`**: Red error text
6. **`output-available` (default)**: Renders `<artifact.Component {...output}>` with handlers

All successful artifacts wrapped in: `animate-in fade-in slide-in-from-bottom-2 duration-300`

### Typing Indicator
Three bouncing dots (`w-2 h-2 rounded-full bg-muted-foreground animate-bounce`) with staggered delays: `[-0.3s, -0.15s, 0s]`

### Error Display
- Red `!` avatar
- `bg-destructive/10 border border-destructive/20` container
- Shows `t('chatError')` header + `error.message` detail

---

## 5. ChatWelcome.tsx — Welcome Screen

**File**: `src/components/storefront/ChatWelcome.tsx` (93 lines)

### Props

```ts
interface ChatWelcomeProps {
  userName?: string
  activeOrders?: Array<{ id: string; status: string; total: number }> | null
  recentFavorites?: Array<{ id: string; name: string; price: number }> | null
}
```

### Visual Structure

```
+------------------------------------------+
|           [BrandMark 32px + name]         |
|                                           |
|   Welcome back, {firstName}!              |
|   (or generic subtitle for guests)        |
|                                           |
| +------------------+ +------------------+ |
| | Active Orders     | | Recent Favorites | |
| | #abc123 [status] €| | Product Name  €X | |
| | #def456 [status] €| | Product Name  €X | |
| +------------------+ +------------------+ |
+------------------------------------------+
```

### Layout
- Centered: `flex flex-col items-center justify-center min-h-[40vh] md:min-h-[50vh]`
- Content: `max-w-lg mx-auto px-2`
- `BrandMark` component: 32px icon with store name
- Heading: `text-lg md:text-2xl font-bold`

### Returning User Cards
- Only shown when `userName` AND (`activeOrders` OR `recentFavorites`) exist
- Container: `flex flex-col sm:flex-row gap-3 mt-4`
- Each card: `rounded-xl border border-border/50 bg-card/60 px-3 py-2.5`
- Orders card: Shows up to 2 orders with `<Badge variant="secondary">` for status
- Favorites card: Shows up to 2 items with truncated name and price

---

## 6. Artifact Registry

**File**: `src/components/artifacts/registry.tsx` (107 lines)

### Registry Interface

```ts
interface ArtifactRegistryEntry {
  Component: React.ComponentType<any>
  Skeleton: React.ComponentType<any>
}
```

### Tool-to-Artifact Mapping

| Tool Name | Component | Skeleton | Notes |
|---|---|---|---|
| `product_search` | `ProductGridArtifact` | `ProductGridSkeleton` | Product search results |
| `browse_catalog` | `ProductGridArtifact` | `ProductGridSkeleton` | Category browsing |
| `get_recommendations` | `ProductGridArtifact` | `ProductGridSkeleton` | AI recommendations |
| `get_product_detail` | `ProductDetailArtifact` | `ProductDetailSkeleton` | Single product detail |
| `compare_products` | `ComparisonTableArtifact` | `ComparisonTableSkeleton` | Side-by-side comparison |
| `get_size_guide` | `SizeGuideArtifact` | `SizeGuideSkeleton` | Sizing chart |
| `get_cart` | `CartSummaryArtifact` | `CartSummarySkeleton` | Cart contents |
| `estimate_shipping` | `PricingTableArtifact` | `PricingTableSkeleton` | Shipping options |
| `create_checkout` | `ApprovalCardArtifact` | `ApprovalCardSkeleton` | Checkout approval |
| `track_order` | `OrderTimelineArtifact` | `OrderTimelineSkeleton` | Order tracking timeline |
| `get_order_history` | `OrderListArtifact` | `OrderListSkeleton` | Past orders list |
| `request_return` | `ReturnRequestArtifact` | `ReturnRequestSkeleton` | Return approval form |
| `generate_design` | `DesignPreviewArtifact` | `DesignPreviewSkeleton` | AI-generated design |
| `customize_design` | `DesignPreviewArtifact` | `DesignPreviewSkeleton` | Modified design |
| `remove_background` | `DesignPreviewArtifact` | `DesignPreviewSkeleton` | BG-removed design |
| `ai_design_generate` | `DesignPreviewArtifact` | `DesignPreviewSkeleton` | Orchestrated AI design |
| `apply_design_to_product` | `ProductMockupArtifact` | `ProductMockupSkeleton` | Design on product mockup |

### Tools WITHOUT visual artifacts (text-only responses)
- `check_availability`, `add_to_cart`, `apply_coupon`, `confirm_checkout`, `add_to_wishlist`, `get_store_policies`, `switch_language`, `analyze_image`, `personalize_product`

### Lookup Function
```ts
function getArtifact(toolName: string): ArtifactRegistryEntry | null
```
Returns `null` for tools without visual artifacts.

---

## 7. Artifact Components — Detailed Breakdown

### 7.1 ProductGridArtifact

**File**: `src/components/artifacts/ProductGridArtifact/ProductGridArtifact.tsx` (242 lines)

**Visual**: Responsive CSS Grid of product cards, max 6 items for inline variant.

**Grid CSS**: Uses custom `.neu-grid` class:
```css
.neu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--grid-card-min, 200px), 1fr));
  gap: var(--grid-gap, 1rem);
}
```

**Each ProductCard features:**
- Square aspect image with hover scale `group-hover:scale-[1.03] transition-transform duration-500`
- Color variant swatches overlaid at bottom of image (32x32 circular thumbnails, scrollable)
- Wishlist heart button (top-right, `.neu-fav`)
- Category badge (uppercase tracking-widest 10px)
- Star rating (11px, `.fill-rating`)
- Compare-at-price with `-X%` destructive badge
- Action buttons: Cart (`.neu-btn-accent`) + Eye/View (`.neu-btn-soft`), both 8x8

**Interactions:**
- Entire card clickable (calls `onSelectProduct`)
- Color swatches: click or hover changes displayed image
- Cart button: direct add via `useCart().addToCart`
- Wishlist heart: toggle via `useWishlist().toggleWishlist`

**Skeleton**: 6 shimmer cards matching real layout (aspect-square image + text + buttons).

### 7.2 ProductDetailArtifact

**File**: `src/components/artifacts/ProductDetailArtifact/ProductDetailArtifact.tsx` (264 lines)

**Visual**: Full product card with image + details in a Card component.

**Layout**: `grid gap-6`, inline: `md:grid-cols-[300px_1fr]`, full: `md:grid-cols-2`

**Sections:**
1. Product image (aspect-square, first image from array)
2. Title + category badge
3. Price (with compare-at-price and discount badge)
4. Star rating
5. Description (with `<Info>` icon)
6. Variants (badges listing options)
7. Materials section (Shirt, Droplets, Printer, Globe icons)
8. Safety information (collapsible `<details>` element with `<SafeHTML>`)
9. Shipping info (Package icon)
10. Footer: Add to Cart + Wishlist buttons

**Skeleton**: Two-column shimmer.

### 7.3 ComparisonTableArtifact

**File**: `src/components/artifacts/ComparisonTableArtifact/ComparisonTableArtifact.tsx` (205 lines)

**Visual**: Horizontal scrollable HTML table in a Card.

**Rows:**
- Header: Product images (96x96), titles, category badges
- Price row (with compare-at styling)
- Rating row (star + count)
- Availability row (check/x badges)
- Dynamic feature rows (from `features[]` arrays)
- Action row: Add to Cart button per product

**Key CSS**: `overflow-x-auto`, sticky left column (`sticky left-0 z-10`), `min-w-[200px]` per product column.

**Skeleton**: Simple shimmer.

### 7.4 SizeGuideArtifact

**File**: `src/components/artifacts/SizeGuideArtifact/SizeGuideArtifact.tsx` (127 lines)

**Visual**: Clean table in Card with Shirt + Ruler icons.

**Dynamic columns**: Only shows chest/length/width/sleeve if data contains those fields.

**Badges**: Product type + measurement unit (inches/cm).

**Footer**: Size tip text.

### 7.5 CartSummaryArtifact

**File**: `src/components/artifacts/CartSummaryArtifact/CartSummaryArtifact.tsx` (134 lines)

**Visual**: Card with item list, subtotal, and action buttons.

**Empty state**: Large cart icon + "Browse Products" CTA.

**Each item**: Title (line-clamp-2) + unit price x quantity + subtotal.

**Footer**: Subtotal (text-xl font-bold), "View Full Cart" (outline) + "Checkout" (accent) buttons, shipping/tax note.

### 7.6 ApprovalCardArtifact

**File**: `src/components/artifacts/ApprovalCardArtifact/ApprovalCardArtifact.tsx` (118 lines)

**Visual**: Checkout confirmation card with CreditCard icon.

**Sections:**
- Header with icon + title + subtitle
- Item count summary
- Individual item rows (name, qty, price)
- Subtotal (large bold)
- Info note (`AlertCircle` icon)
- Footer: Cancel (outline) + Confirm (primary) buttons

**Width**: `max-w-lg` (inline) / `max-w-2xl` (detail)

### 7.7 OrderTimelineArtifact

**File**: `src/components/artifacts/OrderTimelineArtifact/OrderTimelineArtifact.tsx` (259 lines)

**Visual**: Vertical timeline with 5 steps: Placed, Paid, Processing, Shipped, Delivered.

**Each step**: 40x40 rounded-full icon with connecting vertical line (0.5px wide).
- Completed: `bg-primary border-primary text-primary-foreground`
- Active: `bg-primary/20 border-primary text-primary`
- Future: `bg-muted border-border text-muted-foreground`

**Additional sections:**
- Tracking number (monospace)
- Estimated delivery
- Footer: "View Order Details" + "Track Package" (Google search link)

**Status colors**: warning (pending), success (paid/delivered), primary (processing), accent (shipped), destructive (cancelled).

### 7.8 OrderListArtifact

**File**: `src/components/artifacts/OrderListArtifact/OrderListArtifact.tsx` (152 lines)

**Visual**: Card with list of orders, each showing ID, status badge, date, total.

**Empty state**: Package icon + CTA.

**Each order**: Stacks vertically on mobile (`flex-col sm:flex-row`), "View Details" + "Track Order" buttons.

### 7.9 DesignPreviewArtifact

**File**: `src/components/artifacts/DesignPreviewArtifact/DesignPreviewArtifact.tsx` (218 lines)

**Visual**: Card with Sparkles icon, generated design image, prompt text, and action buttons.

**Image**: `aspect-square` with `next/image` fill, `sizes="(max-width: 768px) 100vw, 512px"`. When background removed, shows checkerboard pattern.

**Badges**: "Transparent" (if bg removed), provider name, style name.

**Action buttons (4, in 2x2 grid on mobile):**
1. Download (opens in new tab)
2. Remove BG (calls `POST /api/designs/remove-bg`, updates image in-place)
3. View Mockup (calls `POST /api/designs/mockup`)
4. Add to Product (primary accent)

**Internal state**: `generatingMockup`, `removingBg`, `imageUrl` (can change after bg removal), `bgRemoved`.

**Width**: `max-w-lg` (inline) / `max-w-2xl` (detail)

### 7.10 ProductMockupArtifact

**File**: `src/components/artifacts/ProductMockupArtifact/ProductMockupArtifact.tsx` (142 lines)

**Visual**: Card with Shirt icon, product mockup with design overlay.

**Mockup rendering**: Base product image + centered design overlay (`max-w-[60%] max-h-[60%]`, `object-contain`).

**Product type labels**: tshirt, hoodie, mug, phone-case, tote-bag.

**Buttons**: Download Mockup + Add to Cart.

### 7.11 PricingTableArtifact

**File**: `src/components/artifacts/PricingTableArtifact/PricingTableArtifact.tsx` (102 lines)

**Visual**: Card listing shipping options with country, delivery time, and price.

**Each option**: Bordered row with method name, "Recommended" badge on first, delivery days, price.

**Footer**: Free shipping threshold note with check icon.

### 7.12 ReturnRequestArtifact

**File**: `src/components/artifacts/ReturnRequestArtifact/ReturnRequestArtifact.tsx` (202 lines)

**Visual**: Card with PackageX icon (destructive/10), order summary, reason textarea.

**Sections:**
- Order ID + status badge
- Grid: order date, paid date, shipped date
- Refund amount (large bold)
- Reason textarea (required, min 10 chars, with char count validation)
- Warning note
- Cancel + Submit buttons (submit is destructive-colored, disabled until reason >= 10 chars)

---

## 8. Chat Hooks

### 8.1 useChatSession

**File**: `src/hooks/useChatSession.ts` (196 lines)

**Purpose**: Session persistence, TTL expiry, conversation ID tracking.

**Storage keys:**
- `pod-chat-messages` (sessionStorage) — serialized messages
- `pod-chat-ts` (sessionStorage) — session start timestamp
- `pod-conversation-id` (sessionStorage) — conversation UUID

**TTL**: 3 hours (`CHAT_TTL_MS = 3 * 60 * 60 * 1000`)

**Serialization**: Strips messages down to `{ id, role, parts[] }`. Only keeps `text` parts and `tool-*` parts with `state === 'output-available'`. Discards streaming/input states.

**Expiry checks**: On mount, on `visibilitychange`, on `focus`, and every 10 minutes.

**Debounced persistence**: 500ms debounce timer. Never writes during streaming tokens.

**Returns**: `{ initialMessages, conversationIdRef, persistMessages, sessionExpired }`

### 8.2 useChatTransport

**File**: `src/hooks/useChatTransport.ts` (150 lines)

**Purpose**: AI SDK 6 integration with CSRF, conversation ID, and engagement limit interception.

**Custom fetch wrapper** (`customFetch`):
1. Attaches `x-csrf-token` header from `getCsrfToken()`
2. Attaches `x-conversation-id` header from `conversationIdRef`
3. Extracts `x-conversation-id` from response and persists to sessionStorage
4. Intercepts 429/403 with `body.code === 'LIMIT_REACHED'`:
   - Sets `isLimitReached = true`
   - Anonymous: shows `AuthWallModal`
   - Logged-in: shows `UpgradeModal`
   - Returns fake empty SSE stream (`status: 200, content-type: text/event-stream`) to prevent useChat error

**Transport**: `DefaultChatTransport({ api: '/api/chat', fetch: customFetch })`

**Usage check on mount**: For anonymous users, calls `GET /api/usage/status` and pre-blocks input if `chatUsage.remaining <= 0`.

**Returns**: `{ messages, setMessages, sendMessage, status, error, isLoading, addToolApprovalResponse, showAuthWall, setShowAuthWall, showUpgrade, setShowUpgrade, isLimitReached }`

### 8.3 useImageUpload

**File**: `src/hooks/useImageUpload.ts` (116 lines)

**Purpose**: Image selection, validation, drag-and-drop, FileReader management.

**Validation rules:**
- Must be `image/*` type
- SVG rejected (XSS prevention)
- Max 5MB
- FileReader abort on previous read or unmount

**Returns**: `{ selectedImage, setSelectedImage, fileInputRef, handleImageSelect, handleAttachClick, handleRemoveImage, handleDragOver, handleDrop }`

---

## 9. Chat Tools (Server-Side)

**File**: `src/lib/chat/tools.ts` (~1958 lines)

### Context Interface

```ts
interface ChatToolsContext {
  supabase: SupabaseClient
  chatUserId: string | null
  chatUserTier: UserTier
  chatLocale: string
  cartSessionId: string | null
  fpId: string | null
  ip: string
}
```

### Complete Tool Inventory (24 tools)

| # | Tool | Parameters | Artifact | Needs Approval | Auth Required |
|---|---|---|---|---|---|
| 1 | `product_search` | `query` | ProductGrid | No | No |
| 2 | `browse_catalog` | `category?, page?, limit?, sort?, newArrivals?` | ProductGrid | No | No |
| 3 | `get_product_detail` | `productIdentifier` (UUID or name) | ProductDetail | No | No |
| 4 | `compare_products` | `productIds[]` (2-4) | ComparisonTable | No | No |
| 5 | `get_recommendations` | `category?, maxPrice?, mode?` | ProductGrid | No | No |
| 6 | `get_size_guide` | `productType` | SizeGuide | No | No |
| 7 | `check_availability` | `productId, variantId?` | None (text) | No | No |
| 8 | `add_to_cart` | `productId, variantId?, size?, color?, quantity?` | None (text) | No | No |
| 9 | `get_cart` | (none) | CartSummary | No | No |
| 10 | `apply_coupon` | `code` | None (text) | No | No |
| 11 | `estimate_shipping` | `country?` | PricingTable | No | No |
| 12 | `create_checkout` | `customerEmail?` | ApprovalCard | **Yes** | No* |
| 13 | `confirm_checkout` | `confirmed` | CheckoutRedirect | No | No* |
| 14 | `track_order` | `orderId?` | OrderTimeline | No | Yes** |
| 15 | `get_order_history` | `limit?` | OrderList | No | Yes |
| 16 | `request_return` | `orderId?, reason?` | ReturnRequest | **Yes** | Yes |
| 17 | `generate_design` | `prompt, style?, intent?, privacy_level?` | DesignPreview | No | No*** |
| 18 | `customize_design` | `original_image_url, modifications` | DesignPreview | No | No*** |
| 19 | `remove_background` | `image_url, design_id?` | DesignPreview | No | No |
| 20 | `add_to_wishlist` | `product_id, variant_id?` | None (text) | No | Yes |
| 21 | `get_store_policies` | (none) | None (text) | No | No |
| 22 | `switch_language` | `locale` | None (text) | No | No |
| 23 | `analyze_image` | `description` | None (text) | No | No |
| 24 | `personalize_product` | `product_id, suggested_texts[], recommended_font?, recommended_position?` | None (text) | No | No |
| 25 | `ai_design_generate` | `prompt, stylePreset?, productId?` | DesignPreview | No | No*** |
| 26 | `apply_design_to_product` | `generationId, productId, productType?` | ProductMockup | **Yes** | No |

\* Cart operations use `chatUserId || cartSessionId`
\** `track_order` without orderId requires auth; with orderId also requires auth
\*** Design generation uses `checkAndIncrementUsage()` — anonymous allowed but limited

### Key Implementation Details

**Search**: Uses PostgREST full-text search (`wfts`) with `sanitizeForPostgrest()`. Limit 8 results. Zero results trigger `getSearchFallback()` (top-rated alternatives + category counts).

**Product detail**: Accepts UUID or name (ilike search). Returns materials, care instructions, print technique, manufacturing country, brand, safety information from `product_details` JSONB.

**Variant enrichment**: `enrichWithVariants()` batch-fetches `product_variants` for all returned products, attaching `colorImages`, `sizes`, `colors` maps.

**Cart operations**: Resolve variant by direct ID, size/color match, or auto-select (single variant). Uses `STORE_DEFAULTS.maxCartQuantity` limit.

**Design generation**: Pipeline: content safety check -> usage check -> `generateDesign()` -> auto bg-removal -> save to `designs` table -> return.

**Checkout flow**: `create_checkout` returns `needsApproval: true` with cart summary. Client-side `ToolArtifact` in ChatMessages handles approval button, calling `POST /api/checkout/create-session`. `confirm_checkout` creates Stripe session server-side and returns `checkoutUrl` for redirect.

---

## 10. Chat Context (System Prompt)

**File**: `src/lib/chat/context.ts` (223 lines)

### loadFAQContext(locale)

Fetches store policies from `GET /api/policies?locale=X`. Formats as Q&A pairs. Returns as string if under 200K tokens (~800K chars), otherwise null (falls back to RAG).

### buildSystemPrompt(locale, faqContext, ragContext)

Builds the full system prompt with:
1. **Identity**: "Shopping assistant for {storeName}, European fashion & accessories brand"
2. **Tone**: "Friendly, knowledgeable, casual — like a friend who knows fashion"
3. **Restrictions**: Never mention "AI", "print-on-demand", "POD"
4. **Locale config**: English/Spanish/German instruction
5. **FAQ context**: Injected inline (CAG pattern)
6. **Tool documentation**: All 24+ tools with descriptions and when-to-use guide
7. **Design intent classification**: 7 categories (artistic, text-heavy, photorealistic, vector, pattern, quick-draft, general)
8. **Privacy classification**: public/private/personal for designs
9. **No-results handling**: Instructions to show alternatives
10. **Premium plan awareness**: EUR 9.99/month, 100 chats/day, 50 designs/month
11. **RAG context**: Appended at the end

---

## 11. Layout & Responsive Behavior

### Desktop (lg: 1024px+)

```
[Sidebar 240px] [Center flex-1] [DetailPanel 340px*]
```
*DetailPanel only appears when `artifacts.length > 0 || selectedProduct`

- Sidebar: `hidden lg:flex lg:w-60`, collapsible to `lg:w-0`
- DetailPanel: `hidden lg:flex lg:w-[340px] border-l`, `animate-in slide-in-from-right duration-300`
- ChatArea: Fills center column `flex-1`, messages scroll independently
- BottomNav: Hidden (`md:hidden`)
- ChatInputBar: Pinned at bottom via flexbox (`flex-shrink-0`)

### Tablet (md: 768px)

- Sidebar: Hidden (Sheet drawer)
- No DetailPanel aside
- DetailPanel as full-screen overlay
- BottomNav: Hidden (`md:hidden`)
- Chat padding increases: `md:px-6 md:py-6`

### Mobile (< 768px)

- Sidebar: Sheet drawer (left)
- DetailPanel: Full-screen fixed overlay (`fixed inset-0 z-50 bg-background`)
- BottomNav: Fixed bottom, 56px height, 4 items (Chat, Shop, Cart, Profile)
- Chat has `pb-16` to account for BottomNav
- Prompt suggestions: Horizontal scroll
- All action buttons: Always visible (no hover-only states)

### Chat Page Detection

```ts
const isChatPage = pathname === `/${locale}/chat` || pathname === `/${locale}/chat/`
```

When `isChatPage`:
- Chat container: `flex-1 pb-16 md:pb-0` (visible, takes full height)
- Children container: Hidden

When NOT `isChatPage`:
- Chat container: `h-0 overflow-hidden pointer-events-none` (hidden but mounted)
- Children container: `flex flex-1 flex-col min-h-0 overflow-y-auto pb-16 md:pb-0`

### Animations

| Element | Animation |
|---|---|
| DetailPanel (desktop) | `animate-in slide-in-from-right duration-300` |
| DetailPanel (mobile) | `animate-in slide-in-from-bottom duration-300` |
| Tool artifacts | `animate-in fade-in slide-in-from-bottom-2 duration-300` |
| SignupBanner | `animate-in fade-in slide-in-from-bottom-1 duration-300` |
| Color swatch selection | `transition-all duration-200` |
| Product image hover | `group-hover:scale-[1.03] transition-transform duration-500 ease-out` |
| Typing dots | `animate-bounce` with staggered delays |
| Mic recording | `animate-pulse` |

---

## 12. StorefrontContext — Shared State

**File**: `src/components/storefront/StorefrontContext.tsx` (81 lines)

### Artifact Type

```ts
interface Artifact {
  id: string
  type: 'product' | 'design' | 'comparison' | 'cart' | 'order' | 'other'
  title: string
  data: any
}
```

### State

| Field | Type | Purpose |
|---|---|---|
| `selectedProduct` | `string \| null` | Legacy: product ID for DetailPanel |
| `artifacts` | `Artifact[]` | List of open artifacts in DetailPanel tabs |
| `activeArtifactId` | `string \| null` | Currently visible tab |

### Methods

- `addArtifact(artifact)`: Adds or replaces by ID, sets as active
- `removeArtifact(id)`: Removes from list, clears activeId if it was the removed one
- `clearArtifacts()`: Empties all
- `setSelectedProduct(id)`: Sets legacy product ID

---

## 13. ChatMessageContext — Cross-Component Messaging

**File**: `src/components/storefront/ChatMessageContext.tsx` (28 lines)

Simple context with a single string: `pendingChatMessage`. Used by DetailPanel to send "Tell me more about {product}" to ChatArea.

---

## 14. DetailPanel — Right Column

**File**: `src/components/storefront/DetailPanel.tsx` (548 lines)

### Activation

Shown when `artifacts.length > 0 || selectedProduct` (from StorefrontContext).

### Modes

1. **Artifact tabs mode** (when `hasArtifacts`):
   - Multiple artifacts: `<Tabs>` with horizontally scrollable tab list, each tab has close button
   - Single artifact: Direct render without tabs
   - Each tab renders `<ArtifactContent>` which fetches full product data for `type: 'product'`

2. **Legacy product mode** (when `selectedProduct` and no artifacts):
   - Fetches product via `useProductDetail(productId, locale)`
   - Renders `<ProductView>`

### ProductView (memo'd)

Full product detail with:
- Image gallery (variant-reactive: color/size changes filter visible images)
- Variant selectors (color + size)
- Variant-reactive pricing
- Unavailable combination detection
- Quantity selector
- Footer: Add to Cart + Design link + Wishlist + "Ask about this product" button

### ArtifactContent (memo'd)

Handles 3 artifact types:
- `product`: Fetches product detail and renders ProductView
- `design`: Shows image + prompt
- Other: JSON dump in pre block

---

## 15. Engagement Components

### SignupBanner
**File**: `src/components/engagement/SignupBanner.tsx` (80 lines)

Inline banner below chat messages for guests at 50%+ of daily limit. Shows remaining messages count + "Sign up" CTA. Polls `/api/usage/status` every 30s. Dismissible.

### AuthWallModal
**File**: `src/components/engagement/AuthWallModal.tsx`

Dialog with brand mark, 5 benefits list, "Create Account" + "Log In" buttons. Two variants: `subtle` (small) and `wall` (larger, center-aligned).

### UpgradeModal
**File**: `src/components/engagement/UpgradeModal.tsx`

Similar dialog for logged-in free users who hit limits. Shows premium plan benefits.

---

## 16. Neumorphic Design System (CSS)

The artifact components use a custom CSS design system with neumorphic-inspired classes that degrade gracefully when the theme doesn't provide `--neu-*` variables:

| Class | Purpose | Fallback |
|---|---|---|
| `.neu-grid` | Responsive auto-fill grid | `minmax(200px, 1fr)` |
| `.neu-card` | Card with neumorphic shadow | Standard shadow |
| `.neu-image` | Image container with inner shadow overlay | Plain muted bg |
| `.neu-btn-accent` | Primary action button with glow | Standard button |
| `.neu-btn-soft` | Secondary action button with soft shadow | Standard outline |
| `.neu-fav` | Wishlist heart button with shadow | Transparent ghost |

---

## 17. Data Flow Summary

### User sends message:
```
ChatInputBar.onSubmit(text, image)
  -> ChatArea.handleSubmit(text, imageData)
    -> useChatTransport.sendMessage({ text, files? })
      -> DefaultChatTransport POST /api/chat (with CSRF + conversation ID)
        -> AI processes, calls tools server-side
          -> Tool returns structured data
            -> SSE streams parts back
              -> useChat updates messages[]
                -> ChatMessages renders parts
                  -> ToolArtifact resolves from registry
                    -> artifact.Skeleton (during streaming)
                    -> artifact.Component (when output ready)
```

### User clicks product in artifact:
```
ProductGridArtifact.onSelect(productId)
  -> ChatArea.handleSelectProduct(id, productData)
    -> StorefrontContext.setSelectedProduct(id)
    -> StorefrontContext.addArtifact({ id, type: 'product', ... })
      -> StorefrontShell detects showDetailPanel
        -> DetailPanel renders with artifact tabs
          -> ArtifactContent fetches full product detail
            -> ProductView renders with variants, gallery, add-to-cart
```

### User asks about product from DetailPanel:
```
DetailPanel "Ask about this product" button
  -> ChatMessageContext.setPendingChatMessage("Tell me more about X")
    -> ChatArea useEffect detects pendingChatMessage
      -> sendMessage({ text })
      -> setPendingChatMessage('')
```

### Checkout flow:
```
AI calls create_checkout (needsApproval: true)
  -> Returns cart summary with needsApproval flag
    -> ToolArtifact renders ApprovalCardArtifact
      -> User clicks "Confirm"
        -> handleApprove() POSTs to /api/checkout/create-session
          -> Stripe session URL returned
            -> window.location.href = url (redirect to Stripe)
```

---

## 18. File Index

| Path | Lines | Role |
|---|---|---|
| `components/storefront/ChatArea.tsx` | 268 | Orchestrator |
| `components/storefront/ChatInputBar.tsx` | 211 | Input + voice + image |
| `components/storefront/ChatMessages.tsx` | 328 | Message list + tool artifacts |
| `components/storefront/ChatWelcome.tsx` | 93 | Welcome screen |
| `components/storefront/StorefrontLayout.tsx` | 163 | App shell (3-column) |
| `components/storefront/StorefrontContext.tsx` | 81 | Artifact + product state |
| `components/storefront/ChatMessageContext.tsx` | 28 | Cross-component messaging |
| `components/storefront/DetailPanel.tsx` | 548 | Right panel (product/artifact detail) |
| `components/storefront/BottomNav.tsx` | 52 | Mobile bottom navigation |
| `components/artifacts/registry.tsx` | 107 | Tool-to-component mapping |
| `components/artifacts/ProductGridArtifact/` | 242 + 40 | Product grid + skeleton |
| `components/artifacts/ProductDetailArtifact/` | 264 + skel | Product detail card |
| `components/artifacts/ComparisonTableArtifact/` | 205 + skel | Comparison table |
| `components/artifacts/SizeGuideArtifact/` | 127 + skel | Size chart |
| `components/artifacts/CartSummaryArtifact/` | 134 + skel | Cart summary |
| `components/artifacts/ApprovalCardArtifact/` | 118 + skel | Checkout approval |
| `components/artifacts/OrderTimelineArtifact/` | 259 + skel | Order tracking |
| `components/artifacts/OrderListArtifact/` | 152 + skel | Order history |
| `components/artifacts/DesignPreviewArtifact/` | 218 + 43 | AI design preview |
| `components/artifacts/ProductMockupArtifact/` | 142 + skel | Design on product |
| `components/artifacts/PricingTableArtifact/` | 102 + skel | Shipping options |
| `components/artifacts/ReturnRequestArtifact/` | 202 + skel | Return request form |
| `hooks/useChatSession.ts` | 196 | Session persistence + TTL |
| `hooks/useChatTransport.ts` | 150 | AI SDK transport + CSRF |
| `hooks/useImageUpload.ts` | 116 | Image handling |
| `lib/chat/tools.ts` | ~1958 | 24+ server-side tools |
| `lib/chat/context.ts` | 223 | System prompt builder |
| `components/engagement/SignupBanner.tsx` | 80 | Guest usage banner |
| `components/engagement/AuthWallModal.tsx` | ~80 | Auth wall dialog |
| `components/engagement/UpgradeModal.tsx` | ~80 | Upgrade dialog |
