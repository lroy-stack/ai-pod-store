# POD AI Store — Component & Design Standards

## PodClaw — Autonomous Agent

- **Location**: `podclaw/` (Python, Claude Agent SDK)
- **Documentation**: See `podclaw/README.md`, `podclaw/AGENTS.md`, `podclaw/SECURITY.md`
- **Bridge API**: FastAPI on port 8000 (`podclaw/bridge/api.py`)
- **Configuration**: `podclaw/config.py` (budgets, tools, models, rate limits)
- **Skills**: `podclaw/skills/<agent>/SKILL.md` (8 agents)
- **Memory**: `memory/` (daily, weekly, MEMORY.md, context/, conversations/)
- **Identity**: `podclaw/SOUL.md` (immutable Constraints + Escalation)
- **SDK patterns**: `max_budget_usd`, `allowed_tools`, `can_use_tool` deny chain, `PreCompact` transcript archiving, `SandboxSettings`, session `resume`
- **Security**: Fail-closed security hook, no Bash access for agents, `[DATA]` boundaries

---

## shadcn/ui Component Mapping (MANDATORY)

| Instead of... | Use this |
|---|---|
| `<button className="...">` | `<Button>` from `@/components/ui/button` |
| `<input className="...">` | `<Input>` from `@/components/ui/input` |
| `<label>` | `<Label>` from `@/components/ui/label` |
| `<textarea>` | `<Textarea>` from `@/components/ui/textarea` |
| `<select>` | `<Select>` + `<SelectTrigger>` + `<SelectContent>` + `<SelectItem>` from `@/components/ui/select` |
| `<div class="rounded shadow...">` (card) | `<Card>` + `<CardHeader>` + `<CardContent>` from `@/components/ui/card` |
| Custom modal div | `<Dialog>` + `<DialogTrigger>` + `<DialogContent>` from `@/components/ui/dialog` |
| Custom mobile drawer | `<Sheet>` + `<SheetTrigger>` + `<SheetContent>` from `@/components/ui/sheet` |
| `<input type="checkbox">` | `<Checkbox>` from `@/components/ui/checkbox` |
| Toggle switch div | `<Switch>` from `@/components/ui/switch` |
| Status pill / tag | `<Badge>` from `@/components/ui/badge` |
| `<hr>` or `border-t` dividers | `<Separator>` from `@/components/ui/separator` |
| Custom dropdown | `<DropdownMenu>` from `@/components/ui/dropdown-menu` |
| Custom tabs | `<Tabs>` + `<TabsList>` + `<TabsTrigger>` + `<TabsContent>` from `@/components/ui/tabs` |
| User avatar circle | `<Avatar>` + `<AvatarImage>` + `<AvatarFallback>` from `@/components/ui/avatar` |
| Alert / toast div | `toast()` from `sonner` |

Use `cn()` from `@/lib/utils` for conditional class merging.

## Semantic Tokens — ALLOWED

```
bg-primary, bg-primary/90, text-primary, text-primary-foreground
bg-secondary, text-secondary-foreground
bg-destructive, bg-destructive/10, text-destructive, text-destructive-foreground
bg-muted, text-muted-foreground
bg-accent, text-accent-foreground
bg-card, text-card-foreground
bg-popover, text-popover-foreground
bg-background, text-foreground
bg-input, border-input
border-border
ring-ring, focus:ring-ring
bg-success, bg-success/10, text-success
bg-warning, bg-warning/10, text-warning
```

## Tokens PROHIBITED (NEVER use these)

```
bg-blue-*, bg-green-*, bg-red-*, bg-yellow-*, bg-orange-*
bg-gray-*, bg-slate-*, bg-zinc-*, bg-neutral-*, bg-stone-*
text-gray-*, text-slate-*, text-zinc-*
bg-white (as card/surface bg), bg-black (as page bg)
border-gray-*, border-slate-*
```

If you find yourself reaching for `bg-blue-600`, use `bg-primary` instead.
If you need `bg-gray-100`, use `bg-muted` or `bg-card`.
If you need `text-gray-500`, use `text-muted-foreground`.

## Responsive Patterns — Mobile-First

```
Base (375px)  → default styles (no prefix)
Tablet (768px) → md: prefix
Desktop (1024px+) → lg: prefix
```

Patterns:
- **Grids**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (or lg:grid-cols-4)
- **Navigation**: `<Sheet>` hamburger on mobile, full nav on `md:`
- **Sidebars**: hidden on mobile, `<Sheet>` drawer, visible on `lg:`
- **Forms**: full-width on mobile, `max-w-md mx-auto` on `md:`
- **Touch targets**: minimum `p-3` (44px) on interactive elements

## Reference Implementation

`src/components/storefront/StorefrontHeader.tsx` + `StorefrontSidebar.tsx` — canonical examples of:
- shadcn/ui components (Button, Avatar, DropdownMenu, Badge, Link)
- Semantic tokens (bg-background, text-foreground, border-border)
- Mobile-first responsive (Sheet sidebar on mobile, full layout on lg:)
- Auth-aware UI (useAuth + useCart hooks)

## Architecture — AppShell (claude.ai model)

```
[locale]/layout.tsx → Providers (i18n, CartProvider, Toaster)
  (app)/layout.tsx  → StorefrontLayout (sidebar + header + detail panel)
    page.tsx        → ChatArea (homepage = chat)
    shop/           → Product grid
    cart/           → Cart view
    orders/         → Order list
    profile/        → User profile
    wishlist/       → Wishlists
  (focused)/layout.tsx → Minimal wrapper (no sidebar)
    auth/           → Login, register, etc.
    checkout/       → Checkout flow
```

Route groups `(app)` and `(focused)` are invisible in URLs.

## Before Writing ANY Component — Checklist

1. Does a shadcn/ui component exist for this element? → Use it.
2. Am I using semantic tokens only? → Search for bg-blue, bg-gray, bg-white, text-gray.
3. Is it mobile-first? → Base styles for 375px, then md: and lg: overrides.
4. Does it match the patterns in StorefrontHeader.tsx / StorefrontSidebar.tsx?
5. Am I importing cn() for conditional classes?
