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

## Design & Product Creation Skills

Skills especializados en `.claude/skills/` para diseñar productos y expandir el catálogo SKAPARA. Claude los activa automáticamente según el contexto.

### `design-dtg` — Diseños para impresión DTG (Direct-to-Garment)

- **Cuándo**: Diseñar camisetas, hoodies, crewnecks, long sleeves, zip hoodies, tote bags, kids clothing
- **Provider**: P26 Textildruck Europa (Alemania)
- **Archivos**: `SKILL.md` (pipeline Printify 10 pasos), `CANVAS_SPECS.md` (dimensiones por BP), `DESIGN_GUIDELINES.md` (patrones reales de diseño)
- **Diseños de referencia**: `/frontend/public/meme-designs/`, `/frontend/public/meme-previews/`, `/frontend/public/branded-previews/`
- **Patrones clave**: Two-Tone Text Hierarchy (ghost setup + bold punchline), UI Simulation (ChatGPT/Claude interfaces), Extreme Minimalism

### `design-embroidery` — Diseños para bordado

- **Cuándo**: Diseñar gorras, snapbacks, dad hats, beanies, bucket hats, hoodies bordadas
- **Provider**: P410 Printful (Letonia)
- **Restricciones**: Max 3 colores de hilo, sin gradientes, líneas min 1.5mm, texto min 5mm
- **Diseños de referencia**: `/frontend/public/hat-designs/` (ilustrativo/geométrico, NO texto)

### `design-sublimation` — Diseños para sublimación/UV

- **Cuándo**: Diseñar mugs, botellas, tumblers, desk mats, mouse pads, stickers, sneakers
- **Providers**: P26 (mugs), P23 (bottles), P410/P86 (tumblers), P90 (sneakers, desk mats), P30 (mouse pads, stickers)
- **Diseños de referencia**: `/frontend/public/branded-previews/`, `/frontend/public/brand-designs/`
- **Patrón clave**: Logo lockup con 5 variantes de color (Noir, White, Full Gradient, Ocean, Warm)

### `product-catalog-planner` — Planificador de expansión del catálogo

- **Cuándo**: Planificar nuevos productos, expandir el catálogo (32→250), sugerir qué crear
- **Archivos**: `SKILL.md` (distribución, fases, GPSR, validación), `PRICING_RULES.md`, `BRAND_IDENTITY.md`
- **EU only**: Solo proveedores P26, P410, P90, P23, P30, P255, P86

### Reglas transversales (todos los skills)

- **GPSR obligatorio**: EU Regulation 2023/988 — manufacturer, material, compliance en CADA producto antes de publish
- **product_details JSONB**: safety_information, material, care_instructions, print_technique, manufacturing_country, brand
- **Descripciones**: Solo texto creativo/marketing. Specs técnicas van en product_details
- **EU Provider validation**: `isEUProvider()` en `frontend/src/lib/store-config.ts` bloquea providers no-EU
- **Precio en Printify PRIMERO**: El cron sync margin fixer sobreescribe si margen <35%

---

## PRINTIFY & SUPABASE — CONNECTION REFERENCE (MANDATORY READ)

### PRINTIFY API
- **Base URL**: `https://api.printify.com/v1`
- **Auth**: Bearer JWT — env var `PRINTIFY_API_TOKEN`
- **Shop ID**: env var `PRINTIFY_SHOP_ID` (value: 26473208 = AI-Shopper)
- **NEVER use shop 17595620** (Insomnialz — different store, DO NOT TOUCH)
- **REQUIRED headers** (ALL calls):
  ```
  Authorization: Bearer ${PRINTIFY_API_TOKEN}
  Content-Type: application/json
  User-Agent: POD-AI-Store/1.0
  ```
- **Rate limits**: ~120 req/min. Use `delay(1500-2000)` between calls in scripts
- **Products list limit**: MAX 50 per page (NOT 100 — returns validation error)
- **Cloudflare protection**: Missing User-Agent may cause 403/404. If blocked, wait 10-15s and retry
- **TypeScript client**: `frontend/src/lib/printify.ts` — PrintifyClient class with catalog cache (10 min)
- **Script pattern**: Parse `.env.local` with regex, use fetch() or curl (curl for Cloudflare-blocked contexts)

### SUPABASE CLIENTS
| Client | File | Env Vars | RLS |
|---|---|---|---|
| Frontend (anon) | `src/lib/supabase.ts` | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Respected |
| Server (user auth) | `src/lib/supabase-server.ts` | Same as anon + user Bearer token from request | Respected |
| Admin (service role) | `src/lib/supabase-admin.ts` | `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | **Bypassed** |

- **IMPORTANT**: The service key env var is `SUPABASE_SERVICE_KEY` (NOT `SUPABASE_SERVICE_ROLE_KEY`)
- **Scripts**: Use `createClient(url, serviceKey)` for admin operations (product creation, cron sync)
- **Fallback**: `SUPABASE_URL` falls back to `NEXT_PUBLIC_SUPABASE_URL` if not set

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
