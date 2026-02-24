# ADR-0002: Three Route Groups for Frontend Architecture

## Status

Accepted

## Context

The POD AI storefront is a chat-first, AI-managed e-commerce platform where the conversational interface is the primary shopping experience. The app has three distinct user interaction modes:

1. **Landing/Marketing** - Anonymous visitors browsing the value proposition, testimonials, and product showcase
2. **Chat-first storefront** - Authenticated or anonymous users interacting with PodClaw in the three-panel layout (sidebar + chat + detail panel)
3. **Focused tasks** - Authentication flows, checkout, returns where distractions must be minimized

Traditional e-commerce layouts use a single unified layout with persistent navigation. However, POD AI's chat-first model creates conflicts:
- Chat sidebar should not appear on the landing page (it's empty until a conversation starts)
- Checkout pages should be distraction-free (no chat sidebar, minimal header)
- Marketing pages need different header CTAs than the storefront

## Decision

We will use **three Next.js route groups** with distinct layouts:

### 1. `(landing)` - Marketing & SEO Routes
**Path**: `app/[locale]/(landing)/`
**Layout**: `LandingLayout` with full-width hero, minimal header, footer with newsletter signup
**Routes**: `/`, `/about`, `/how-it-works`
**Characteristics**:
- No chat sidebar (no StorefrontLayout)
- SEO-optimized: generateMetadata(), JSON-LD schema, static generation where possible
- CTA buttons point to `/en/chat` to start conversation

### 2. `(app)` - Storefront & Chat Experience
**Path**: `app/[locale]/(app)/`
**Layout**: `StorefrontLayout` with three-panel layout (sidebar + chat + detail panel)
**Routes**: `/chat`, `/shop`, `/shop/[category]`, `/products/[id]`, `/account`, `/orders`, `/referrals`
**Characteristics**:
- **Always-mounted chat**: Chat panel uses CSS `visibility: hidden` instead of conditional rendering (prevents conversation loss on navigation)
- Persistent sidebar with categories, filters, and conversation history
- Detail panel shows product details, order history, or account settings
- Mobile: Sidebar collapses to Sheet drawer, chat takes full width

### 3. `(focused)` - Task-Oriented Flows
**Path**: `app/[locale]/(focused)/`
**Layout**: `FocusedLayout` with minimal header (logo + close), no footer, no chat
**Routes**: `/login`, `/signup`, `/checkout`, `/returns/[id]`
**Characteristics**:
- Distraction-free: no chat sidebar, no navigation links, no product recommendations
- Single-column layout optimized for form completion
- Progress indicators for multi-step flows (checkout, returns)
- Mobile-first: full viewport width on all devices

## Consequences

**Positive**:
- ✅ **Clear mental model**: Route path = user intent (landing, shopping, focused task)
- ✅ **Performance**: Landing pages can be statically generated without client-side chat bundle
- ✅ **UX consistency**: Chat is always available in the storefront but never interrupts focused tasks
- ✅ **SEO**: Landing pages have clean HTML without chat/React hydration noise
- ✅ **Mobile optimization**: Each layout can optimize for its context (landing = full-width hero, app = three-panel, focused = single column)

**Negative**:
- ❌ **Layout duplication**: Header/footer components must handle three different contexts
- ❌ **Navigation transitions**: Moving from `(landing)` to `(app)` triggers a layout remount (chat sidebar initializes)
- ❌ **Developer confusion**: New developers must learn which route group to use for new pages
- ❌ **Bundle size**: Chat bundle loads for all `(app)` routes even if user doesn't chat

**Mitigations**:
- Shared components: `<Header variant="landing|storefront|focused">` to reduce duplication
- Document route group decision tree in CLAUDE.md
- Use Next.js route interception for modals to avoid group transitions
- Code-split chat panel with dynamic imports to defer load until first interaction

## Implementation Notes

**Layout nesting**:
```
app/[locale]/
├── layout.tsx              # Root layout (ThemeProvider, i18n)
├── (landing)/
│   ├── layout.tsx          # LandingLayout
│   └── page.tsx            # Homepage
├── (app)/
│   ├── layout.tsx          # StorefrontLayout (with always-mounted chat)
│   ├── chat/
│   ├── shop/
│   └── products/
└── (focused)/
    ├── layout.tsx          # FocusedLayout (minimal)
    ├── login/
    ├── checkout/
    └── returns/
```

**Chat mounting strategy**:
- Chat is mounted in `StorefrontLayout` but visibility is controlled by URL state
- `/chat` route makes chat visible, other routes hide it with CSS
- This prevents conversation context loss on navigation within `(app)` group

## References

- Next.js App Router Route Groups: https://nextjs.org/docs/app/building-your-application/routing/route-groups
- StorefrontLayout implementation: `frontend/src/app/[locale]/(app)/layout.tsx`
- Chat visibility toggle: `frontend/src/providers/chat-provider.tsx`
