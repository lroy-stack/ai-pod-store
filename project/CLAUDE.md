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

## Architecture — Route Groups (DO NOT CHANGE)

```
[locale]/layout.tsx → Providers (i18n, CartProvider, Toaster)
  (landing)/layout.tsx → Minimal layout (bg-background, NO StorefrontLayout)
    page.tsx           → Landing page (/[locale]/ — hero, carousel, CTA, Footer)
  (app)/layout.tsx     → StorefrontLayout (sidebar + header + detail panel)
    chat/page.tsx      → Renders null (ChatArea lives in StorefrontLayout CSS toggle)
    shop/              → Product grid
    cart/              → Cart view
    orders/            → Order list
    profile/           → User profile
    wishlist/          → Wishlists
    ⚠ NO page.tsx here → (app) has NO root page — NEVER create one
  (focused)/layout.tsx → Minimal wrapper (no sidebar)
    auth/              → Login, register, etc.
    checkout/          → Checkout flow
```

Route groups `(app)`, `(landing)`, and `(focused)` are invisible in URLs.
The landing page is at `/` via `(landing)/page.tsx`. The chat is at `/chat` via `(app)/chat/page.tsx`.

## Before Writing ANY Component — Checklist

1. Does a shadcn/ui component exist for this element? → Use it.
2. Am I using semantic tokens only? → Search for bg-blue, bg-gray, bg-white, text-gray.
3. Is it mobile-first? → Base styles for 375px, then md: and lg: overrides.
4. Does it match the patterns in StorefrontHeader.tsx / StorefrontSidebar.tsx?
5. Am I importing cn() for conditional classes?

---

## Docker — Self-Hosted Stack

### File Structure

All Docker Compose files and `.env` live at the **project root**. Support files (Caddyfile, Dockerfiles) stay in `deploy/`.

```
project/
├── docker-compose.yml          # Base — 8 services, no ports exposed
├── docker-compose.local.yml    # Local dev override (127.0.0.1 ports)
├── docker-compose.prod.yml     # Production override (80/443, auth enabled)
├── .env.example                # Template — cp to .env and fill values
├── .env                        # Secrets (gitignored, auto-loaded by Compose)
├── start.sh                    # Orchestration script
└── deploy/
    ├── Caddyfile               # Reverse proxy config
    ├── Dockerfile              # PodClaw image (multi-stage Python)
    └── rembg/                  # Background removal sidecar
        ├── Dockerfile
        └── server.py
```

### start.sh — Orchestration Script

```bash
./start.sh              # Local dev (default)
./start.sh --prod       # Production (requires DOMAIN in .env)
./start.sh --down       # Stop all services
./start.sh --build      # Build images only
./start.sh --clean      # Stop + prune Docker resources
./start.sh --status     # Show service health
```

The script:
1. Checks Docker prerequisites
2. Creates `.env` from `.env.example` on first run
3. Validates required variables (rejects placeholders)
4. Builds images
5. Starts in 3 phases: infrastructure (redis, rembg, crawl4ai) → application (podclaw, frontend, admin, mcp-server) → reverse proxy (caddy)

### Services & Networks

```
proxy network:       caddy <-> frontend, admin, podclaw, mcp-server
data network:        frontend, podclaw, mcp-server <-> redis
ai-services network: podclaw <-> rembg, crawl4ai
```

| Service | Port | Image | Network(s) |
|---|---|---|---|
| frontend | 3000 | ./frontend/Dockerfile | proxy, data |
| admin | 3001 | ./admin/Dockerfile | proxy |
| podclaw | 8000 | deploy/Dockerfile | proxy, data, ai-services |
| mcp-server | 8002 | ./mcp-server/Dockerfile | proxy, data |
| rembg | 8080 | deploy/rembg/Dockerfile | ai-services |
| redis | 6379 | redis:7-alpine | data |
| crawl4ai | 11235 | unclecode/crawl4ai:0.8.0 | ai-services |
| caddy | 80/443 | caddy:2.9-alpine | proxy |

### Security Hardening

- **cap_drop: ALL** on every service, selective `cap_add` only for redis (SETGID/SETUID/DAC_OVERRIDE), crawl4ai (SYS_ADMIN), caddy (NET_BIND_SERVICE)
- **Non-root users** in all custom images (nextjs, rembg, podclaw)
- **No `env_file:`** — each service declares only the variables it needs via `environment:`
- **rembg + crawl4ai**: zero secrets (isolated ai-services network)
- **Redis**: `rename-command` blocks FLUSHALL, FLUSHDB, DEBUG, CONFIG
- **Local dev**: all ports bound to `127.0.0.1`
- **Log rotation**: json-file driver, 10MB x 3 files per service

### Environment Variables

Single `.env` file at project root. See `.env.example` for all variables with `[REQUIRED]`/`[OPTIONAL]` tags and service ownership annotations. Key principle: **each service receives ONLY the secrets it needs**.
