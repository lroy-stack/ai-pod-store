# Admin Panel — Auditoría Real contra Codebase

**Fecha**: 2026-03-06
**Método**: 3 agentes de exploración contra codebase real (no suposiciones)
**Scope**: `/admin/` completo — páginas, API, componentes, auth, UX, responsive

---

## 1. Inventario Real

| Categoría | Count |
|---|---|
| Páginas (page.tsx) | 39 |
| Rutas API (route.ts) | 81 |
| Componentes custom | 22 |
| Componentes shadcn/ui | 24 |
| Hooks custom | 3+ |
| Layouts | 2 (root + dashboard route group) |
| Error boundaries | 2 (root + dashboard) |
| Tests | 5 archivos, 816 líneas |

### Comparación con auditorías anteriores

| Métrica | Feb 23 (audit-360) | Mar 6 (production-audit) | Mar 6 (REAL) |
|---|---|---|---|
| Páginas | 34 | 44 | 39 |
| Rutas API | 69 | 69 | 81 |
| Auth protegidas | 3/69 (4.3%) | 3/69 (4.3%) | 16/81 (19.8%) — mejor pero aún 80% abierto |
| Route group (dashboard) | NO existía | No revisado | SÍ existe |
| Error boundaries | 0 | No revisado | 2 |
| alert()/prompt() | 24 | No revisado | 0 |
| Settings page | Stub (setTimeout) | Stub | **VERIFICADO: FUNCIONA** — adminFetch PUT real (líneas 80-103) |
| Branding save | No implementado | No implementado | **VERIFICADO: FUNCIONA** — saveBrandConfig() líneas 88-112 |
| React Query | 1/34 páginas | No revisado | 5+ páginas (dashboard, products, orders, designs, customers) |

---

## 2. Páginas — Estado Real

### Core Commerce
| Página | Path | Data Fetching | Loading | Responsive | Mobile View |
|---|---|---|---|---|---|
| Dashboard | `(dashboard)/page.tsx` | React Query (5 queries) | Skeleton cards | grid-cols-1→2→4 | Cards stack, chart heights adjust |
| Products | `(dashboard)/products/page.tsx` | React Query (useProducts) | Skeleton rows | Table→Cards | `hidden md:block` + card view |
| Product Edit | `(dashboard)/products/[id]/page.tsx` | Fetch POST | Skeleton | Full-width form | OK |
| Product New | `(dashboard)/products/new/page.tsx` | Fetch POST | Loading state | Full-width form | OK |
| Orders | `(dashboard)/orders/page.tsx` | React Query (useOrders) | Loading text | Table→Cards | Keyboard nav (j/k/Enter) |
| Order Detail | `(dashboard)/orders/[id]/page.tsx` | Fetch GET | Skeleton | Responsive layout | OK |
| Customers | `(dashboard)/customers/page.tsx` | React Query (useCustomers) | Skeleton | Table→Cards | Detail modal responsive |
| Returns | `(dashboard)/returns/page.tsx` | React Query/adminFetch | Loading state | Responsive | OK |
| Reviews | `(dashboard)/reviews/page.tsx` | React Query | Loading state | Responsive | OK |
| Designs | `(dashboard)/designs/page.tsx` | React Query (useDesigns) | Spinner (Loader2) | Grid 1→2→3→4 | OK |
| Design Detail | `(dashboard)/designs/[id]/page.tsx` | Fetch GET | Loading state | Responsive | OK |
| Categories | `(dashboard)/categories/page.tsx` | React Query/adminFetch | Loading state | Responsive | OK |

### Analytics & Finance
| Página | Path | Data Fetching | Loading | Responsive | Problemas |
|---|---|---|---|---|---|
| Analytics | `(dashboard)/analytics/page.tsx` | adminFetch (state) | Loading text | Cards responsive | **Product Margins table SIN mobile view** (hidden md:block sin fallback) |
| Finance | `(dashboard)/finance/page.tsx` | adminFetch | Loading text | Cards responsive | OK |

### Agent (PodClaw) — 8 sub-páginas
| Página | Path | Data Fetching | Loading | Responsive |
|---|---|---|---|---|
| Agent Home | `(dashboard)/agent/page.tsx` | React Query | Skeleton grid | grid 1→3→5 |
| Agent Session | `(dashboard)/agent/[id]/page.tsx` | Fetch GET | Loading state | OK |
| Agent Chat | `(dashboard)/agent/chat/page.tsx` | useSSE | Skeleton messages | Chat responsive |
| Agent Memory | `(dashboard)/agent/memory/page.tsx` | Fetch GET | Loading state | OK |
| Agent Errors | `(dashboard)/agent/errors/page.tsx` | React Query | Loading state | OK |
| Agent Metrics | `(dashboard)/agent/metrics/page.tsx` | React Query | Loading state | OK |
| Agent Schedule | `(dashboard)/agent/schedule/page.tsx` | React Query | Loading state | OK |
| Agent Soul | `(dashboard)/agent/soul/page.tsx` | Fetch GET/POST | Loading state | OK |

### Content & Marketing
| Página | Path | Data Fetching | Loading | Responsive |
|---|---|---|---|---|
| Blog | `(dashboard)/blog/page.tsx` | React Query | Loading state | OK |
| SEO | `(dashboard)/seo/page.tsx` | adminFetch | Loading text | Grid responsive |
| Translations | `(dashboard)/translations/page.tsx` | React Query | Loading state | OK |
| AB Tests | `(dashboard)/ab-tests/page.tsx` | React Query | Loading state | **"View Results" botón deshabilitado/no-op** |
| Branding | `(dashboard)/branding/page.tsx` | React Query | Loading state | OK |

### Legal & Compliance
| Página | Path | Data Fetching | Loading | Responsive |
|---|---|---|---|---|
| Legal List | `(dashboard)/legal/page.tsx` | React Query | Loading state | OK |
| Legal Editor | `(dashboard)/legal/[slug]/page.tsx` | Fetch GET/PUT | Loading state | OK |
| Legal Consents | `(dashboard)/legal/consents/page.tsx` | React Query | Loading state | OK |
| Legal Settings | `(dashboard)/legal/settings/page.tsx` | Fetch GET/PUT | Loading state | OK |

### Admin & Config
| Página | Path | Data Fetching | Loading | Responsive |
|---|---|---|---|---|
| Settings | `(dashboard)/settings/page.tsx` | Fetch GET/PUT | Loading state | max-w-md |
| Messaging | `(dashboard)/messaging/page.tsx` | adminFetch | Loading state | OK |
| Monitoring | `(dashboard)/monitoring/page.tsx` | adminFetch | Loading state | OK |
| Audit Log | `(dashboard)/audit/page.tsx` | adminFetch | Loading state | OK |

### Multi-Tenant
| Página | Path | Data Fetching | Loading | Responsive |
|---|---|---|---|---|
| Tenants List | `(dashboard)/tenants/page.tsx` | React Query | Loading state | OK |
| Tenant New | `(dashboard)/tenants/new/page.tsx` | Fetch POST | Loading state | OK |
| Tenant Edit | `(dashboard)/tenants/[id]/page.tsx` | Fetch GET/PATCH | Loading state | OK |

### Auth & Error
| Página | Path | Notas |
|---|---|---|
| Login | `login/page.tsx` | Rate limiting, max-w-md, responsive |
| Root Error | `error.tsx` | Error boundary con retry |
| Dashboard Error | `(dashboard)/error.tsx` | Error boundary con retry |
| Root 404 | `not-found.tsx` | Página no encontrada |
| Dashboard 404 | `(dashboard)/not-found.tsx` | Página no encontrada |

---

## 3. Responsive & UX — Estado Real

### Layout System
- **Route group `(dashboard)/`**: SÍ EXISTE (cambio vs audit Feb 23)
- **DashboardLayout**: Sidebar (hidden lg:block) + MobileSidebar (Sheet drawer) + TopBar + Breadcrumbs
- **Padding responsive**: `p-4 md:p-6 lg:p-8`
- **Sidebar**: Collapsible (w-16 collapsed, w-64 expanded), smooth 300ms transition
- **Touch targets**: min-h-[44px] en todos los nav items

### Breakpoints usados
- Base (375px): stack vertical, full-width
- `md:` (768px): 2 columnas, table view
- `lg:` (1024px): sidebar visible, 3-4 columnas
- `xl:` (1280px): gallery 4 columnas (designs)

### Desktop Table → Mobile Cards
| Página | Desktop Table | Mobile Cards | Status |
|---|---|---|---|
| Products | `hidden md:block` | Card view con botones full-width | OK |
| Orders | `hidden md:block` | Cards con checkbox + keyboard nav | Excelente |
| Customers | `hidden md:block` | Cards con hover, min-h-[88px] | OK |
| Analytics (margins) | `hidden md:block` | **SIN mobile fallback** | FALTA |
| Dashboard (orders) | `hidden md:block` | Mobile card view | OK |

### Loading States — Inconsistentes
| Tipo | Páginas | Calidad |
|---|---|---|
| Skeleton cards/rows | Dashboard, Products, Customers, Agent | Buena |
| Spinner (Loader2) | Designs | Aceptable |
| Texto "Loading..." | Orders, SEO, Analytics | **Pobre — necesita skeletons** |
| Sin loading state | Varias páginas menores | **Pobre** |

**Falta**: Componente `TableSkeleton` reutilizable

### Dark Mode
- CSS variables HSL funcionan en ambos modos
- ThemeToggle existe y funciona
- **Problema**: tokens hardcoded (`text-green-600`, `text-red-600`) no tienen variant dark

---

## 4. Design Token Violations — Exactas

| Archivo | Línea(s) | Token incorrecto | Corrección |
|---|---|---|---|
| `(dashboard)/page.tsx` | 67 | `text-green-600` / `text-red-600` | `text-success` / `text-destructive` |
| `(dashboard)/analytics/page.tsx` | 575, 583, 589-597, 610, 647-648, 729 | `text-green-600` / `text-red-600` | `text-success` / `text-destructive` |
| `(dashboard)/finance/page.tsx` | 20+ instancias | `text-green-600` / `text-red-600` | `text-success` / `text-destructive` |
| `(dashboard)/legal/consents/page.tsx` | Varias | `text-green-600` / `text-red-600` | `text-success` / `text-destructive` |
| `(dashboard)/tenants/[id]/page.tsx` | 1 instancia | `text-green-600 dark:text-green-400` | `text-success` |

**Total**: 5 archivos, ~25+ instancias de tokens prohibidos

---

## 5. Features — Qué funciona y qué NO

### FUNCIONA (verificado contra codebase)
- Dashboard con 5 queries React Query (stats, orders, revenue, products, acquisition)
- Sidebar collapsible + MobileSidebar Sheet
- Error boundaries (root + dashboard)
- Login con rate limiting (5 intentos/15min por IP)
- Orders con bulk actions, keyboard nav, pagination
- Products con CRUD, bulk publish, search
- Designs con moderation (approve/reject)
- Legal pages con versioning
- Audit log
- Monitoring con error_logs
- Keyboard shortcuts (Cmd+K, j/k nav)
- Command palette (GlobalSearch)
- Toast notifications (sonner)
- CSV export (analytics, finance)

### NO FUNCIONA / INCOMPLETO (VERIFICADO CONTRA CÓDIGO)
| Feature | Estado | Detalle | Archivo:Línea |
|---|---|---|---|
| AB Tests "View Results" | **NO-OP** | Botón renderiza pero sin onClick handler | `ab-tests/page.tsx:350-356` |
| Notifications auth | **ROTO** | Usa JSON.parse plain en vez de iron-session — siempre falla en cookies reales | `notifications/route.ts:4-14` |
| SSE auth | **ROTO** | Mismo patrón JSON.parse roto que notifications | `events/stream/route.ts:11-21` |
| Messaging test Telegram | **404** | Botón existe pero endpoint `/api/messaging/telegram/test` no existe | `messaging/page.tsx:75,219-226` |
| Messaging test WhatsApp | **404** | Botón existe pero endpoint `/api/messaging/whatsapp/test` no existe | `messaging/page.tsx:90,329-336` |
| Dev check-index | **SIN AUTH** | Endpoint de debug expuesto sin autenticación en producción | `dev/check-index/route.ts` |
| Password reset admin | **NO EXISTE** | No hay ruta /api/auth/forgot-password | — |
| MFA/TOTP | **NO EXISTE** | Ni UI ni backend | — |
| CSRF protection | **NO EXISTE** | Solo sameSite:lax parcial | — |
| Logout endpoint | **NO EXISTE** | No hay forma de invalidar sesión server-side | — |
| Session revocation | **NO EXISTE** | Cookie válida 7 días sin poder revocar | — |
| Security headers | **NO CONFIGURADOS** | HSTS, CSP, X-Frame-Options ausentes | — |

### SÍ FUNCIONA (VERIFICADO — corregido desde auditorías previas)
| Feature | Antes (Feb 23) | Ahora (Mar 6) | Verificación |
|---|---|---|---|
| Settings page | Stub (setTimeout) | **FUNCIONA** — adminFetch PUT real | `settings/page.tsx:80-103` |
| Branding save | No implementado | **FUNCIONA** — saveBrandConfig() + activateTheme() | `branding/page.tsx:88-133` |
| Translation write-back | Read-only | **FUNCIONA** — Edit inline + auto-translate | `translations/page.tsx:56-127` |
| Route group (dashboard) | No existía | **EXISTE** — layout compartido | `(dashboard)/layout.tsx` |
| Error boundaries | 0 | **2** — root + dashboard | `error.tsx`, `(dashboard)/error.tsx` |
| alert()/prompt() | 24 instancias | **0** — todo migrado a toast/Dialog | Grep confirma 0 hits |
| React Query | 1 página | **5+ páginas** — dashboard, products, orders, designs, customers | Verificado por agentes |
| Color violations | 67+ | **~25** — reducidas pero no eliminadas | 5 archivos con text-green/red-600 |
| SSE endpoint | No verificado | **EXISTE** — SSE real con heartbeat 30s | `events/stream/route.ts:23-80` |

---

## 6. Seguridad — Auditoría Completa contra Codebase

### Auth System
- **Mecanismo**: iron-session (cookie encriptada `admin-session`)
- **Archivo**: `admin/src/lib/session.ts` línea 39
- **Cookie**: httpOnly, sameSite:lax, secure:true (prod), TTL 7 días
- **Login**: bcrypt verify, rate limit 5/15min por IP
- **RBAC**: Fully implemented en `admin/src/lib/rbac.ts` — withPermission, requireAuth, hasPermission, isSuperAdmin

### CRITICAL: SESSION_SECRET Fallback
```typescript
// admin/src/lib/session.ts:39
password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_default_dev_only'
```
Si no se configura `SESSION_SECRET`, cualquiera puede forjar cookies de admin.

### CRITICAL: Middleware excluye /api/
```typescript
// admin/src/middleware.ts:7
if (pathname === '/login' || pathname.startsWith('/api/')) {
  return NextResponse.next();  // ← TODOS los /api/* pasan sin auth
}
```

### CRITICAL: Notifications auth rota
```typescript
// admin/src/app/api/admin/notifications/route.ts
const sessionData = JSON.parse(sessionCookie.value);  // ← iron-session es ENCRIPTADO, no JSON
```
Siempre falla → endpoint completamente desprotegido.

### Conteo Auth — VERIFICADO ruta por ruta (72 archivos route.ts)

| Categoría | Count | % |
|---|---|---|
| Protegidas correctamente (requireAuth/withPermission/getAdminSession/withAuth) | **10** | 13.9% |
| Iron-session directa (criptográfica, pero no usa lib compartida) | **9** | 12.5% |
| Cookie parse débil (JSON.parse forgeable) | **12** | 16.7% |
| Completamente DESPROTEGIDAS | **39** | 54.2% |
| Intencionalmente públicas (health, login) | **2** | 2.8% |
| **TOTAL** | **72** | — |

**Resolución de discrepancia anterior**: El agente inventario (Sección 8) listó auth en ~60+ rutas porque asumió que el patrón se aplicaba uniformemente. La verificación ruta-por-ruta muestra que **solo 10 usan la auth library correcta, 9 usan iron-session directa, 12 usan cookie parse trivialmente forgeable, y 39 no tienen auth alguno**.

### Tres niveles de auth (de más seguro a más débil)

**1. Auth library (requireAuth/withPermission/getAdminSession)** — 10 rutas
- `/api/dashboard/stats`, `recent-orders`, `revenue-trend` (requireAuth)
- `/api/products` (withPermission)
- `/api/orders` (requireAuth)
- `/api/customers` (getAdminSession)
- `/api/designs` (getAdminSession)

**2. Iron-session directa** — 9 rutas
- `/api/admin/settings` (getIronSession + role)
- `/api/agent/metrics`, `schedule`, `memory`, `chat/*`, `[...path]` (getIronSession via local checkAdminAuth)

**3. Cookie parse FORGEABLE** — 12 rutas
Usan `JSON.parse(cookie.value)` y verifican `role === 'admin'`. **Cualquiera puede forjar** la cookie `admin-session={"role":"admin"}`.
- `/api/admin/notifications`, `notifications/mark-all-read`
- `/api/admin/subscribers`, `credits/adjust`, `legal/consents`
- `/api/returns/*` (4 rutas)
- `/api/designs/[id]`, `messaging/config`, `events/stream`

### DESPROTEGIDAS — Clasificadas por severidad

**CRITICAL (datos financieros / mutaciones masivas)**:
- `/api/admin/finance/report` — P&L, ingresos, márgenes
- `/api/admin/finance/export` — Exporta CSV financiero
- `/api/admin/analytics/export` — Exporta analytics + RFM
- `/api/admin/orders/bulk` — Actualización masiva de status de pedidos
- `/api/products/bulk` — Actualización masiva de status de productos
- `/api/tenants/create` — Crear tenants (acceso multi-tenant)

**HIGH (PII, mutaciones, costes)**:
- `/api/customers/[email]/profile` — PII (nombre, email, teléfono)
- `/api/customers/[email]/orders` — Historial de pedidos
- `/api/blog/*` (GET+POST+DELETE) — Crear/borrar posts
- `/api/ab-tests/*` — Iniciar/parar experimentos (afecta conversión)
- `/api/admin/categories/*` — CRUD categorías
- `/api/admin/themes/*` + `/activate` — Activar temas (cambia aspecto de la tienda)
- `/api/admin/brand-config` — Configuración de marca
- `/api/admin/agent/soul` — Modificar personalidad del agente
- `/api/monitoring/errors` — Logs de errores (info para ataques)
- `/api/orders/[id]` — Detalle individual de pedido
- `/api/reviews/[id]` — Aprobar/rechazar reviews
- `/api/tenants/[id]`, `[id]/billing` — Datos y facturación de tenants
- `/api/audit` — Log de auditoría completo
- `/api/translations/auto-translate` — Dispara API Gemini (coste económico)
- `/api/dashboard/revenue-trend` — Tendencia de ingresos

**MEDIUM**:
- `/api/admin/seo`, `/api/admin/legal-pages/*`, `/api/admin/sitemap`
- `/api/analytics/rfm`, `demand`, `funnel`
- `/api/reviews` (list), `/api/translations`
- `/api/dashboard/top-products`, `customer-acquisition`, `activity-feed`

**LOW**: `/api/search`, `/api/task`, `/api/metrics`, `/api/tenants/check-slug`, `/api/dev/check-index`

### Falta por implementar
| Feature | Estado |
|---|---|
| MFA/TOTP | No existe |
| CSRF tokens | No existe (solo sameSite:lax) |
| Password reset | No existe |
| Session revocation | No existe |
| Logout endpoint | No existe |
| Rate limit distribuido | In-memory (se pierde en restart) |
| Security headers | No configurados (HSTS, CSP, X-Frame-Options) |
| Audit logging | Solo en 10/72 rutas protegidas |
| Permission caching | Queries DB cada request |

---

## 7. Componentes — Inventario

### Layout (5)
- `DashboardLayout.tsx` — Shell principal (sidebar + topbar + breadcrumbs)
- `Sidebar.tsx` — Nav desktop collapsible, badges, tooltips
- `MobileSidebar.tsx` — Sheet drawer mobile
- `TopBar.tsx` — Header sticky, notificaciones, user menu
- `Breadcrumbs.tsx` — Dual mode (back button mobile, trail desktop)

### Navigation (3)
- `GlobalSearch.tsx` — Wrapper Cmd+K
- `CommandPalette.tsx` — Actions palette
- `KeyboardShortcutsHelp.tsx` — Help modal

### Agent (6)
- `agent/ChatMessage.tsx` — Mensajes chat
- `agent/ToolCallCard.tsx` — Visualización tool calls
- `agent/WaterfallTimeline.tsx` — Timeline de ejecución
- `agent/artifacts/CodeBlock.tsx` — Syntax highlighting
- `agent/artifacts/DataTable.tsx` — Tablas en artifacts
- `agent/artifacts/MermaidDiagram.tsx` — Diagramas

### Dashboard (2)
- `ActivityFeed.tsx` — Timeline de actividad
- `QuickActions.tsx` — Botones rápidos

### Theme (3)
- `ThemeToggle.tsx` — Dark/light mode
- `ThemeEditorDialog.tsx` — Editor colores brand
- `OklchColorPicker.tsx` — Color picker OKLCH

### Error (1)
- `ErrorBoundary.tsx` — React error boundary

### Providers (2)
- `providers/QueryProvider.tsx` — React Query
- `providers/SSEProvider.tsx` — SSE connection

### shadcn/ui (24)
button, card, input, label, textarea, select, badge, table, dialog, sheet, tabs, dropdown-menu, checkbox, switch, alert-dialog, avatar, popover, tooltip, separator, scroll-area, progress, command, safe-markdown, sparkline

---

## 8. Rutas API — Inventario por categoría (AUTH VERIFICADA ruta por ruta)

**Leyenda auth**: `requireAuth` = lib auth correcta | `iron-session` = criptográfica directa | `cookie-parse` = JSON.parse forgeable | `NINGUNA` = sin auth

### Auth (1)
- `POST /api/auth/login` — Pública (pre-auth), CON rate limiting

### Dashboard (6)
- `GET /api/dashboard/stats` — `requireAuth`
- `GET /api/dashboard/recent-orders` — `withAuth`
- `GET /api/dashboard/revenue-trend` — NINGUNA
- `GET /api/dashboard/top-products` — NINGUNA
- `GET /api/dashboard/customer-acquisition` — NINGUNA
- `GET /api/dashboard/activity-feed` — NINGUNA

### Orders (4)
- `GET /api/orders` — `requireAuth`
- `GET|PATCH /api/orders/[id]` — NINGUNA
- `POST /api/admin/orders/[id]/retry` — NINGUNA
- `POST /api/admin/orders/bulk` — NINGUNA

### Products (3)
- `GET|POST /api/products` — `withPermission`
- `GET|PATCH|DELETE /api/products/[id]` — `withPermission`
- `POST /api/products/bulk` — NINGUNA (usa withValidation, NO auth)

### Designs (3)
- `GET /api/designs` — `getAdminSession`
- `GET /api/designs/[id]` — `cookie-parse` (forgeable)
- `PUT /api/designs/[id]/moderate` — `withPermission`

### Customers (3)
- `GET /api/customers` — `getAdminSession`
- `GET /api/customers/[email]/profile` — NINGUNA
- `GET /api/customers/[email]/orders` — NINGUNA

### Returns (4)
- `GET /api/returns` — `cookie-parse`
- `POST /api/returns/[id]/approve` — `cookie-parse`
- `POST /api/returns/[id]/receive` — `cookie-parse`
- `POST /api/returns/[id]/reject` — `cookie-parse`

### Reviews (2)
- `GET /api/reviews` — NINGUNA
- `PATCH|DELETE /api/reviews/[id]` — NINGUNA

### Blog (2)
- `GET|POST /api/blog` — NINGUNA
- `GET|PUT|DELETE /api/blog/[id]` — NINGUNA

### Translations (2)
- `GET|POST /api/translations` — NINGUNA
- `POST /api/translations/auto-translate` — NINGUNA (dispara Gemini API = coste)

### AB Tests (3)
- `GET|POST /api/ab-tests` — NINGUNA
- `POST /api/ab-tests/[id]/start` — NINGUNA
- `POST /api/ab-tests/[id]/stop` — NINGUNA

### Agent (10)
- `GET /api/agent/sessions` — `getAdminSession`
- `GET /api/agent/sessions/[id]/events` — NINGUNA
- `POST /api/agent/chat/stream` — `iron-session`
- `GET|POST /api/agent/chat/conversations` — `iron-session`
- `GET|DELETE /api/agent/chat/conversations/[id]` — `iron-session`
- `GET /api/agent/metrics` — `iron-session`
- `GET|POST /api/agent/schedule` — `iron-session`
- `GET /api/agent/memory` — `iron-session`
- `ALL /api/agent/[...path]` — `iron-session`
- `GET|POST /api/admin/agent/soul` — NINGUNA

### Admin Config (14)
- `GET|PUT /api/admin/settings` — `iron-session`
- `GET /api/admin/legal-settings` — Pública (GET); `iron-session` (PUT)
- `GET /api/admin/notifications` — `cookie-parse` (forgeable)
- `POST /api/admin/notifications/mark-all-read` — `cookie-parse`
- `GET|POST /api/admin/brand-config` — NINGUNA
- `GET|POST /api/admin/categories` — NINGUNA
- `GET|PATCH|DELETE /api/admin/categories/[id]` — NINGUNA
- `GET|POST /api/admin/seo` — NINGUNA
- `GET|POST /api/admin/sitemap` — NINGUNA
- `POST /api/admin/analytics/export` — NINGUNA
- `GET /api/admin/finance/report` — NINGUNA
- `POST /api/admin/finance/export` — NINGUNA
- `POST /api/admin/credits/adjust` — `cookie-parse`
- `GET /api/admin/subscribers` — `cookie-parse`

### Legal (5)
- `GET|POST /api/admin/legal-pages` — NINGUNA
- `GET|PUT|DELETE /api/admin/legal-pages/[slug]` — NINGUNA
- `GET /api/admin/legal-pages/[slug]/versions` — NINGUNA
- `GET /api/admin/legal/consents` — `cookie-parse`

### Themes (3)
- `GET|POST /api/admin/themes` — NINGUNA
- `GET|PUT|DELETE /api/admin/themes/[id]` — NINGUNA
- `POST /api/admin/themes/[id]/activate` — NINGUNA

### Tenants (5)
- `GET /api/tenants` — NINGUNA
- `POST /api/tenants/create` — NINGUNA
- `GET|PATCH|DELETE /api/tenants/[id]` — NINGUNA
- `GET|POST /api/tenants/[id]/billing` — NINGUNA
- `POST /api/tenants/check-slug` — Pública (por diseño)

### Utility (9)
- `GET /api/health` — Pública (por diseño)
- `GET /api/audit` — NINGUNA
- `GET /api/search` — NINGUNA
- `POST /api/task` — NINGUNA
- `GET /api/metrics` — NINGUNA
- `GET /api/events/stream` — `cookie-parse`
- `GET /api/monitoring/errors` — NINGUNA
- `GET /api/messaging/config` — `cookie-parse`
- `GET /api/dev/check-index` — NINGUNA

### Analytics (3)
- `GET /api/analytics/rfm` — NINGUNA
- `GET /api/analytics/demand` — NINGUNA
- `GET /api/analytics/funnel` — NINGUNA

---

---

## 9. Gaps Priorizados — Resumen Ejecutivo

### P0 — Seguridad (BLOQUEANTE para producción)
| # | Gap | Detalle | Esfuerzo |
|---|---|---|---|
| P0-1 | 39/72 rutas API completamente desprotegidas | Incluye finance report/export, orders bulk, tenants create, customer PII, audit log | 4-6h |
| P0-2 | 12 rutas con cookie-parse forgeable | JSON.parse(cookie.value) trivialmente falsificable — migrar a getAdminSession() | 2h |
| P0-3 | SESSION_SECRET fallback hardcoded | Si no se configura, cualquiera forja cookies. Debe throw en producción | 15min |
| P0-4 | Middleware excluye /api/ de auth | `pathname.startsWith('/api/')` → NextResponse.next(). Todo /api/ pasa sin verificar | 1h |
| P0-5 | Dev endpoint sin auth | `/api/dev/check-index` expuesto — eliminar o proteger | 15min |

### P0 — Migración Printify→Printful
| # | Gap | Detalle | Esfuerzo |
|---|---|---|---|
| PF-5 | 14 referencias "Printify" en 9 archivos admin | Terminología incorrecta post-migración (ver Sección 9 tabla detallada) | 1h |
| PF-2 | Finance usa costes HARDCODED (45% producción) | `totalRevenue * 0.45` NO es el coste real de Printful — márgenes ficticios | 3h |

### P1 — Correcciones funcionales
| # | Gap | Detalle | Esfuerzo |
|---|---|---|---|
| P1-1 | Messaging test endpoints no existen | Botones Telegram/WhatsApp test → 404 (`/api/messaging/telegram/test` no existe) | 2h |
| P1-2 | AB Tests "View Results" sin handler | Botón renderiza pero sin onClick — no muestra resultados del experimento | 3h |
| P1-3 | Rate limiter in-memory | Se pierde en restart. Redis ya en stack — migrar | 2h |
| P1-4 | Password reset admin | No existe endpoint ni UI | 3h |
| P1-5 | Logout endpoint | No hay forma de invalidar sesión server-side, cookie válida 7 días | 1h |
| PF-1 | Products list sin info de proveedor | No muestra provider_product_id, sync status, pod_provider | 2h |
| PF-3 | Sin dashboard de sync status | No hay visibilidad de qué productos están synced con Printful | 3h |
| PF-6 | Tracking de envío solo en detalle | Lista de pedidos no muestra tracking — hay que abrir cada uno | 1h |

### P1 — Mejoras UX/Responsive
| # | Gap | Detalle | Esfuerzo |
|---|---|---|---|
| P1-6 | Design token violations (5 archivos, ~25 instancias) | text-green/red-600 → text-success/destructive en dashboard, analytics, finance, consents, tenants | 1h |
| P1-7 | Loading states inconsistentes | Mezcla de skeletons, spinners, "Loading..." texto, y sin loading state. Crear TableSkeleton reutilizable | 3h |
| P1-8 | Analytics Product Margins table sin mobile view | `hidden md:block` sin fallback card en mobile | 1h |
| P1-9 | Dark mode: tokens hardcoded | Se resuelve con P1-6 al migrar a tokens semánticos | 0h |
| PF-4 | Sin breakdown costes por producto | No hay vista de coste real Printful vs precio venta por producto | 2h |

### P2 — Mejoras arquitecturales
| # | Gap | Detalle | Esfuerzo |
|---|---|---|---|
| P2-1 | Migrar páginas restantes a React Query | ~15 páginas aún usan useEffect+fetch (SEO, analytics, finance, legal, settings, etc.) | 4-6h |
| P2-2 | Paginación server-side | audit, agent errors, blog cargan todo de una vez | 2h |
| P2-3 | CSRF tokens en endpoints de mutación | Solo sameSite:lax parcial actualmente | 2h |
| P2-4 | Security headers | HSTS, CSP, X-Frame-Options — configurar en next.config.ts o Caddy | 1h |
| P2-5 | Permission caching en RBAC | Queries DB cada request — añadir TTL cache | 2h |
| P2-6 | Audit logging universal | Solo 10/72 rutas tienen audit logging | 2h |
| P2-7 | Consolidar patrones auth | 3 mecanismos distintos (lib, iron-session directa, cookie parse) — unificar en uno | 3h |
| P2-8 | Session TTL reducir | 7 días → 24h con inactivity timeout | 1h |
| P2-9 | MFA/TOTP para admin | Ni UI ni backend, requiere flujo completo | 4h |

### Migración Printify→Printful en Admin (PENDIENTE)

**Contexto**: La tienda migró de Printify a Printful como proveedor POD. El frontend ya usa columnas provider-agnostic (`provider_product_id`, `external_order_id`, `pod_provider`, etc.). Sin embargo, el **admin sigue referenciando "Printify"** en terminología, costes y un endpoint.

**El admin NO llama a ninguna API POD directamente** — todo se lee de Supabase. El flujo real es: Printful → webhooks frontend → Supabase → Admin lee.

#### Lo que YA usa columnas provider-agnostic (OK)
- Order detail: `external_order_id`, `provider_status`, `pod_provider` — `orders/[id]/page.tsx:39-41,466-480`
- Order timeline: "Submitted to [provider]" con external ID — `orders/[id]/page.tsx:88-94`
- Retry button: Lee `provider_status === 'failed'` — `orders/[id]/page.tsx:438`
- Retry endpoint: Queries `provider_product_id`, `external_variant_id` — `retry/route.ts:66`

#### Referencias Printify a migrar — MAPA EXACTO (14 hits en 9 archivos)

| Archivo | Línea | Código actual | Acción |
|---|---|---|---|
| `analytics/page.tsx` | 30 | `printifyCosts: number` (tipo) | Renombrar a `podCosts` o `productionCosts` |
| `analytics/page.tsx` | 582 | `"Printify Costs"` (label UI) | → `"Production Costs"` |
| `analytics/page.tsx` | 584 | `report.profitAndLoss.breakdown.printifyCosts` | → `.productionCosts` |
| `finance/page.tsx` | 37 | `printifyCosts: number` (tipo) | → `productionCosts` |
| `finance/page.tsx` | 319 | `"Printify Production Costs"` (label UI) | → `"Production Costs"` |
| `finance/page.tsx` | 321 | `report.profitAndLoss.breakdown.printifyCosts` | → `.productionCosts` |
| `finance/report/route.ts` | 76 | Comentario: "after Printify costs" | → "after production costs" |
| `finance/report/route.ts` | 134 | `totalRevenue * 0.65` — costes hardcoded | **P1: Reemplazar con pod_cost_cents real** |
| `finance/report/route.ts` | 152 | `printifyCosts: (totalRevenue * 0.45) / 100` | → `productionCosts` + usar datos reales |
| `finance/export/route.ts` | 40 | `"Printify Production Costs"` en CSV | → `"Production Costs"` |
| `analytics/export/route.ts` | 33 | `"Printify Costs"` en CSV | → `"Production Costs"` |
| `designs/[id]/page.tsx` | 364 | `"Printify Template"` (label) | → `"Provider Template"` o `"Printful Template"` |
| `agent/chat/page.tsx` | 251 | `"Supabase, Stripe, and Printify"` | → `"Supabase, Stripe, and Printful"` |
| `agent/ToolCallCard.tsx` | 11 | `printify: 'bg-warning/10...'` (color map) | → `printful:` (o `pod:`) |
| `orders/[id]/retry/route.ts` | 81 | `retry-printify-orders` (endpoint call) | → `retry-pod-orders` (requiere renombrar endpoint en frontend) |

#### Gaps funcionales Printful

| # | Gap | Impacto | Esfuerzo |
|---|---|---|---|
| PF-1 | Products list NO muestra provider info (sync status, provider_product_id) | Admin no sabe si producto está synced con Printful | 2h |
| PF-2 | Finance usa costes **HARDCODED** (45% producción, 3% Stripe, 17% ops) — NO usa `pod_cost_cents` de Supabase | Márgenes mostrados son ficticios, no reflejan costes reales | 3h |
| PF-3 | No hay dashboard de sync status (qué productos están synced, cuáles failed, última sync) | No hay visibilidad de salud del catálogo | 3h |
| PF-4 | No hay breakdown de costes por producto (coste real Printful vs precio venta) | No se puede optimizar pricing por producto | 2h |
| PF-5 | 14 refs "Printify" en 9 archivos (ver tabla arriba) — terminología incorrecta | Confusión, incoherente con proveedor actual | 1h |
| PF-6 | No hay tracking de envío visible en lista de pedidos (solo en detalle individual) | Admin debe abrir cada pedido para ver tracking | 1h |

#### Datos disponibles en Supabase para Printful (ya poblados por webhooks frontend)

Según la Printful API (ver `docs/reference/printful-api-*.md`), estos datos llegan via webhooks:

| Dato | Columna Supabase | Usado en admin? |
|---|---|---|
| Order status (draft→confirmed→processing→shipped→completed) | `provider_status` | Sí — order detail |
| Order external ID | `external_order_id` | Sí — order detail |
| Provider name | `pod_provider` | Sí — order detail |
| Tracking number | `tracking_number` (orders) | Solo en order detail, no en list |
| Tracking URL | `tracking_url` (orders) | Solo en order detail |
| Carrier name | `carrier` (orders) | No |
| Production cost | `pod_cost_cents` (orders) | **NO** — admin usa hardcoded 45% |
| Shipping cost (provider) | `shipping_cost_cents` | **NO** |
| Product sync ID | `provider_product_id` (products) | **NO** en UI productos |
| Variant sync ID | `external_variant_id` (product_variants) | Solo retry endpoint |
| Sync status | `synced_at` / `sync_status` | **NO** — no hay columna dedicada |

#### Datos Printful API que NO llegan actualmente (requieren implementación)

| Dato | Endpoint Printful | Impacto |
|---|---|---|
| Costes reales por item | `GET /orders/{id}` → `costs.subtotal/shipping/total` | Sin esto, finance es ficticia |
| Stock availability | `GET /sync/products` → `variant.in_stock` | Sin esto, no hay alertas de stock |
| Estimated delivery | `POST /shipping/rates` | Sin esto, no hay ETA en orders |
| Product mockup preview | `GET /mockup-generator/printfiles/{id}` | Sin esto, admin muestra imagen plana |

---

## 10. Discrepancias entre agentes — Resolución FINAL

### Auth count: RESUELTO
- **Agente seguridad (round 1)**: 16/81 protegidas
- **Agente inventario (round 1)**: ~50+ con auth
- **Verificación ruta por ruta (round 2)**: **10 con auth library correcta + 9 iron-session + 12 cookie-parse + 39 sin auth + 2 públicas** = 72 total
- **Resolución**: El agente inventario asumió que los patrones de auth se aplicaban uniformemente basándose en imports. La verificación ruta por ruta reveló la realidad: solo 10 rutas usan la auth library compartida correctamente. La Sección 8 ahora refleja auth VERIFICADA para cada ruta.

### Notifications: RESUELTO
- **Resolución**: JSON.parse plain confirmado — NO usa iron-session. Trivialmente forgeable.

### Dashboard routes: RESUELTO
- **Agente inventario**: Listó todas como "requireAuth"
- **Verificación**: Solo `stats` (requireAuth) y `recent-orders` (withAuth) están protegidas. Las otras 4 (revenue-trend, top-products, customer-acquisition, activity-feed) están completamente desprotegidas.

---

## 12. Sección /designs — Auditoría Completa

### 12.1 Estado actual de datos

**Tabla `designs`** — 80 registros, TODOS approved, 0 pending, 0 rejected

| Columna | Tipo | Uso actual | Notas |
|---|---|---|---|
| `id` | uuid | PK | — |
| `product_id` | uuid FK | Todos NULL | Ningún diseño vinculado a producto |
| `user_id` | uuid FK | Todos NULL | Todos generados por sistema, no por usuarios |
| `prompt` | text | Sí | Prompt de generación |
| `style` | text | Sí | 65 estilos distintos (line art, watercolor, groovy 70s, etc.) |
| `model` | text | Sí | 4 valores: gemini-3-pro-image, gemini-3-pro-image-preview, sourced-pixabay, null |
| `image_url` | text | Sí | URL pública del bucket `designs/` |
| `thumbnail_url` | text | Todos NULL | **NUNCA se generan thumbnails** |
| `width` / `height` | int | Sí | Rango: 640-2048px |
| `moderation_status` | text | Sí | Todos "approved" — 0 pending/rejected |
| `moderation_notes` | text | Algunos | Notas de moderación automática |
| `quality_score` | int | Todos 10 | Siempre máximo, no hay scoring real |
| `quality_issues` | jsonb | Vacío | Nunca poblado |
| `source_type` | text | Sí | "gemini" o "sourced-pixabay" |
| `source_url` | text | Todos NULL | No se guarda URL de origen |
| `bg_removed_url` | text | ~50% | URL del diseño sin fondo |
| `bg_removed_at` | timestamp | ~50% | Fecha de procesamiento |
| `privacy_level` | text | Todos "public" | — |
| `needs_upscale` | bool | Todos false | — |
| `tenant_id` | uuid | Todos mismo valor | Single-tenant actual |
| `printify_upload_id` | text | Todos NULL | **LEGACY** — de Printify, no migrado |
| `printify_image_url` | text | Todos NULL | **LEGACY** — de Printify |
| `provider_upload_id` | text | Todos NULL | **NUEVO** — de Phase 3, nunca poblado |
| `pod_upload_url` | text | Todos NULL | **NUEVO** — de Phase 3, nunca poblado |
| `parent_design_id` | uuid | Todos NULL | Para variantes de diseño |
| `expires_at` | timestamp | Todos NULL | Para diseños temporales |
| `generation_time_ms` | int | Todos NULL | Nunca se mide tiempo de generación |
| `moderated_by` | text | Todos NULL | Nunca se registra quién modera |
| `moderated_at` | timestamp | Todos NULL | Nunca se registra cuándo se modera |

### 12.2 Storage — Bucket `designs/` (verificado via `storage.objects`)

**Resumen global**: 862 objetos, 781 MB total

| Ubicación | Archivos | Tamaño |
|---|---|---|
| **Raíz** (sin carpeta) | 207 | 500 MB |
| **En carpetas** | 655 | 281 MB |
| **Total** | **862** | **781 MB** |

**Archivos raíz — Desglose por patrón**:
| Patrón | Count | Tamaño | Descripción |
|---|---|---|---|
| `nobg-*.png` | 106 | 282 MB | Diseños con fondo removido (3-6 MB cada uno) |
| `gemini_generate_image-*.jpg` | 74 | 189 MB | Generaciones Gemini crudas (2-4 MB cada uno) |
| Named designs (ej: `cherry-blossom-*`, `feminist-*`) | 25 | 29 MB | Diseños con nombre descriptivo |
| `test-*.png` | 2 | 603 KB | Archivos de test |

**16 Carpetas**:
| Carpeta | Files | Tamaño | Propósito |
|---|---|---|---|
| `mockups/` | 531 | 244 MB | **Mockups de productos** — 29 subcarpetas por slug de producto |
| `e2e-test/` | 5 | 13 MB | Imágenes de test |
| `uploads/` | 8 | 11 MB | Uploads directos |
| `designs/` | 15 | 6 MB | Diseños organizados (subcarpetas mockups/ y new-wave-crewneck/) |
| `printful-migration/` | 22 | 3 MB | Archivos de migración Printify→Printful |
| `brand/` | 14 | 1.2 MB | Assets de marca |
| `dtg-sources/` | 4 | 857 KB | Fuentes DTG originales |
| `embroidery-sources/` | 23 | 575 KB | Fuentes de bordado por diseño |
| `hats/` | 5 | 421 KB | Diseños para gorras |
| `redesigns/` | 4 | 375 KB | Rediseños |
| `printfiles/` | 3 | 356 KB | Archivos de impresión |
| `coming-soon/` | 8 | 179 KB | Previews coming-soon (.webp) |
| `printful-uploads/` | 3 | 156 KB | Uploads a Printful |
| `think-maze/` | 1 | 87 KB | Diseño individual |
| `branding/` | 6 | 78 KB | Wordmarks, labels, sleeves |
| `printful-branding/` | 3 | 66 KB | Branding para Printful |

**Mockups — Top 10 productos** (de 29 carpetas):
| Producto | Mockups | Tamaño |
|---|---|---|
| shadow-tee | 38 | 20 MB |
| under-where | 36 | 18 MB |
| just-for-you | 36 | 18 MB |
| three-models | 36 | 18 MB |
| strawberry-count | 33 | 17 MB |
| dangerous-flag | 33 | 17 MB |
| option-two | 31 | 16 MB |
| next-line | 31 | 15 MB |
| scope-creep | 30 | 16 MB |
| prism-tee | 25 | 10 MB |

**Segundo bucket**: `product-images/` — 12 objetos, 1 MB (mockups generados por Printful, poco usado)

**Problemas de organización**:
1. **207 archivos en la raíz** sin estructura (64% del tamaño total del bucket)
2. **106 archivos `nobg-*`** con nombres hash — no se sabe a qué diseño corresponden sin cruzar con DB
3. **74 archivos `gemini_*`** con nombres hash — generaciones crudas sin catalogar
4. No hay thumbnails (campo `thumbnail_url` siempre NULL) — grid carga full-size 2-6 MB
5. Mezcla de propósitos: diseños AI, mockups de productos, branding, e2e tests, todo en un bucket
6. `mockups/` (244 MB) son imágenes de **productos**, no de diseños — deberían estar en `product-images/`

### 12.2b Descubrimiento crítico: Designs ↔ Products están COMPLETAMENTE desconectados

**Dos sistemas independientes**:

| Sistema | Almacena en | Vinculado a |
|---|---|---|
| **Tabla `designs`** (80 rows) | Bucket `designs/` raíz (archivos gemini_*, nobg-*) | Nada — `product_id` NULL en los 80 |
| **Tabla `products`** (27 activos) | JSONB `images` → `designs/mockups/{slug}/` | Printful via `design_templates` JSONB |

**0/80 diseños vinculados a productos**. `product_id` es NULL en TODOS.

**Estructura `images` JSONB** (cada producto tiene array de objetos):
```json
[
  { "alt": "Origin - White", "src": "https://...supabase.co/storage/v1/object/public/designs/mockups/origin/white-front.png?v=..." },
  { "alt": "Origin - Black", "src": "https://...supabase.co/storage/v1/object/public/designs/mockups/origin/black-front.png?v=..." }
]
```

**Estructura `design_templates` JSONB** (data de Printful por variante):
```json
{
  "version": 100,
  "templates": {
    "47694": {
      "image_url": "https://files.cdn.printful.com/m/templates/medium/inside_label_2.5x2.5.png",
      "print_area_top": 182,
      "print_area_left": 251,
      "print_area_width": 228,
      "print_area_height": 228,
      "template_width": 728,
      "template_height": 728,
      "background_color": "#080808",
      "is_template_on_front": false
    }
  }
}
```

- 27/27 productos activos tienen `images` JSONB
- 25/27 productos activos tienen `design_templates` JSONB
- Las keys del templates object son IDs de variante de Printful
- `background_color` varía por variante (ej: `#080808` negro, `#ffffff` blanco, `#98b7ee` azul)

**Implicación para admin**: La sección Designs gestiona un **banco de arte** (tabla `designs`) que NO está conectado a los productos reales. Los productos obtienen sus imágenes de un flujo completamente separado (sync Printful → JSONB). Admin necesita gestionar AMBOS sistemas o unificarlos

### 12.3 Tablas relacionadas (todas vacías) y datos de productos

**Tablas del Design Studio frontend** (schema existe, 0 datos):
| Tabla | Registros | Creada por migración | RLS |
|---|---|---|---|
| `design_sessions` | 0 | 20260228200000 | Sí (owner + service) |
| `ai_generations` | 0 | 20260228200300 | Sí (owner + service) |
| `user_design_assets` | 0 | 20260228200500 | Sí (owner + service) |
| `design_compositions` | 0 | 20260228200700 | Sí (owner + service) |
| `personalizations` | 0 | 20260228100000 | — |

**Datos reales de productos** (la fuente de verdad para imágenes/diseños):
| Dato | Productos activos |
|---|---|
| Total activos | 27 |
| Con `images` JSONB | 27/27 (100%) |
| Con `design_templates` JSONB | 25/27 (93%) |
| Con mockups en storage | 29 carpetas en `designs/mockups/` |
| Vinculados a tabla `designs` | 0/27 (0%) |

### 12.4 Código admin actual — Análisis

**Páginas** (2):
- `(dashboard)/designs/page.tsx` — Galería con grid responsive, filtro por tabs (all/pending/approved/rejected), paginación, moderación inline (approve/reject con Dialog)
- `(dashboard)/designs/[id]/page.tsx` — Detalle con imagen, metadata, botón "Create Product from Design"

**API Routes** (3):
- `GET /api/designs` — Lista con paginación, filtro status/search. Auth: `getAdminSession` (correcta)
- `GET|PATCH /api/designs/[id]` — Detalle + update. Auth: `cookie-parse` (forgeable)
- `PUT /api/designs/[id]/moderate` — Moderación. Auth: `withPermission('designs','moderate')` (correcta)

**Hook**: `useDesigns.ts` — React Query con staleTime 30s, paginación, filtro status/search

### 12.5 Problemas del admin actual

| # | Problema | Severidad | Detalle |
|---|---|---|---|
| D-1 | **"Printify Template" en pipeline preview** | P0 (migración) | `designs/[id]/page.tsx:364` — dice "Printify Template" |
| D-2 | **Auth inconsistente** | P0 (seguridad) | GET/PATCH `designs/[id]` usa cookie-parse forgeable, mientras moderate usa withPermission |
| D-3 | **Todos los diseños approved** | Funcional | 80/80 approved → el tab system es inútil, no hay workflow de moderación real |
| D-4 | **0 diseños de usuarios** | Funcional | Todos user_id=NULL → la galería solo muestra diseños del sistema |
| D-5 | **Create Product dialog desconectado** | P1 | Categorías hardcoded (t-shirts, hoodies, mugs, posters, phone-cases, tote-bags) — no coinciden con categorías reales de DB |
| D-6 | **0 thumbnails** | P1 (UX) | thumbnail_url siempre NULL → carga imágenes full-size (2-4MB) en el grid, muy lento |
| D-7 | **Sin búsqueda visual** | P1 (UX) | Solo search por texto (prompt/style), no por color, dimensiones, modelo |
| D-8 | **Sin bulk actions** | P1 (UX) | No hay approve/reject en masa — uno por uno |
| D-9 | **Sin tags/categorías** | P1 (UX) | Los estilos (65 distintos) no están organizados ni son filtrables |
| D-10 | **Sin estadísticas** | P2 | No hay dashboard de: total por modelo, por estilo, uso de storage, diseños sin fondo |
| D-11 | **Sin gestión de storage** | P2 | No se puede ver/organizar el bucket desde admin, 207 archivos caóticos en raíz |
| D-12 | **Sin vinculación a productos** | P2 | 0/80 diseños vinculados a productos — product_id siempre NULL |
| D-13 | **quality_score siempre 10** | P2 | No hay scoring real, quality_issues nunca poblado |
| D-14 | **moderated_by/moderated_at nunca poblados** | P2 | No se registra quién ni cuándo se moderó |
| D-15 | **generation_time_ms nunca poblado** | P3 | No se mide performance de generación |
| D-16 | **Detail page usa useEffect+fetch** | P2 | `designs/[id]/page.tsx` NO usa React Query (inconsistente con list que sí lo usa) |

### 12.6 Frontend — Design Studio (17 componentes, NO conectado al admin)

El frontend tiene un **Design Studio completo** que el admin NO gestiona:

**Componentes** (`frontend/src/components/design-studio/`):
- `DesignStudioPage.tsx` — Página principal del editor
- `CanvasWorkspace.tsx` — Workspace con canvas
- `CanvasToolbar.tsx` — Barra de herramientas
- `CanvasProperties.tsx` — Panel de propiedades
- `EditorHeader.tsx` — Header del editor
- `LayersPanel.tsx` — Panel de capas
- `TemplatesPanel.tsx` — Panel de templates
- `ClipartPanel.tsx` — Panel de clipart
- `PanelSwitcher.tsx` — Switch entre paneles
- `PreviewMockupModal.tsx` — Preview de mockup
- `EmbroideryConstraints.tsx` — Restricciones de bordado
- Tools: `ColorPicker`, `FontPicker`, `GradientEditor`, `ImageTool`, `ShadowControl`, `TextTool`

**API Routes Frontend** (`frontend/src/app/api/designs/`):
- `generate/route.ts` — Genera diseños con AI
- `ai-generate/route.ts` + `refine/route.ts` — Generación AI + refinamiento
- `remove-bg/route.ts` — Quitar fondo (rembg)
- `estimate/route.ts` — Estimación de costes
- `mockup/route.ts` — Generar mockups
- `compose/route.ts` + `compose-v2/route.ts` — Composición de diseños
- `composition/[id]/route.ts` — CRUD composiciones
- `history/route.ts` — Historial
- `[id]/create-product/route.ts` — Crear producto desde diseño

**Desde admin NO se puede**:
1. Ver sesiones del Design Studio (tabla vacía pero existe)
2. Ver/gestionar generaciones AI (tabla vacía pero existe)
3. Ver/gestionar assets de usuarios (tabla vacía pero existe)
4. Ver/gestionar composiciones (tabla vacía pero existe)
5. Ver/gestionar personalizaciones (tabla vacía)
6. Gestionar el Design Studio (configurar templates, presets, límites)

### 12.7 Propuesta de mejora — Gestión de Diseños End-to-End

#### Decisión arquitectónica previa: Unificar o separar

Actualmente hay **dos sistemas de imágenes independientes** que el admin debería gestionar:

| Sistema | Qué contiene | Dónde vive | Admin actual |
|---|---|---|---|
| **Art Bank** | 80 diseños AI (Gemini, fal, sourced) | tabla `designs` + bucket raíz | Sí (básico) |
| **Product Images** | 531 mockups de 27 productos | JSONB `images` + `designs/mockups/{slug}/` | **NO** |
| **Design Templates** | Templates Printful por variante | JSONB `design_templates` | **NO** |
| **Design Studio** | Editor canvas, composiciones, AI gen | 5 tablas + 17 componentes + 12 API routes | **NO** |

**Opción A — Unificar**: Vincular `designs.product_id` a productos, que las mockups se generen desde diseños. Requiere refactor de flujo de creación de productos.

**Opción B — Separar explícitamente**: Admin gestiona Art Bank Y Product Images como secciones distintas. Más simple, no rompe flujo existente.

**Recomendación**: Opción B a corto plazo (no romper nada), migrar gradualmente a Opción A.

#### Nivel 1 — P0 Correcciones inmediatas (seguridad + migración)

| Cambio | Archivo | Detalle |
|---|---|---|
| Unificar auth | `api/designs/[id]/route.ts` | Reemplazar `JSON.parse(cookie)` por `getAdminSession` |
| Migrar terminología | `designs/[id]/page.tsx:364` | "Printify Template" → "Printful Template" |
| Validar PATCH body | `api/designs/[id]/route.ts` | Añadir schema validation (actualmente acepta todo) |
| Generar thumbnails | Migration + trigger | Campo `thumbnail_url` → auto-generate 300px on upload (reduce grid de 500MB→~15MB) |

#### Nivel 2 — P1 UX profesional para Art Bank

| Feature | Detalle |
|---|---|
| **Filtros avanzados** | Por modelo (gemini/fal/sourced), estilo (65 valores), dimensiones, con/sin bg_removed, quality_score |
| **Bulk actions** | Checkboxes + approve/reject/delete en masa |
| **Grid optimizado** | Thumbnails 300px, lazy loading, infinite scroll o paginación mejorada |
| **Tags/categorías** | Nueva columna `tags text[]` o tabla `design_tags` — agrupar por tema (animals, Easter, feminist, groovy, etc.) |
| **Detail panel mejorado** | Split view: imagen izq + metadata derecha, comparar original vs nobg, dimensiones, storage size |
| **Stats dashboard** | Cards: total por modelo, por estilo, storage total, con/sin fondo, ratio de uso en productos |

#### Nivel 3 — P1 Gestión de Product Images (NUEVO)

Sección nueva en admin para gestionar mockups de productos:

| Feature | Detalle |
|---|---|
| **Product image gallery** | Grid de productos con sus mockups (del JSONB `images`), por producto |
| **Mockup management** | Ver/reordenar/eliminar mockups por producto, subir nuevos |
| **Storage browser** | Navegar `designs/mockups/{slug}/` — ver 531 archivos organizados por producto |
| **Template viewer** | Visualizar `design_templates` JSONB — preview de áreas de impresión por variante (Printful) |
| **Image health check** | Detectar mockups rotos (URLs inválidas), productos sin mockups, duplicados |

#### Nivel 4 — P2 Gestión completa

| Feature | Detalle |
|---|---|
| **Storage cleanup** | Reorganizar 207 archivos de raíz en carpetas (por modelo/fecha/categoría) |
| **Uploader directo** | Subir diseños desde admin sin pasar por frontend Design Studio |
| **Design→Product link** | Vincular diseños a productos (poblar `product_id`), ver qué diseños se usan dónde |
| **Design Studio admin** | Configurar templates, presets, límites de generación AI, precios de créditos |
| **Audit trail** | Poblar `moderated_by`, `moderated_at`, historial de cambios de estado |
| **Quality scoring** | Implementar scoring real (resolución, contraste, complejidad), quality_issues JSONB |
| **Métricas** | generation_time_ms, cost tracking por generación, ratio uso/generación |

#### Estimación de esfuerzo

| Nivel | Archivos nuevos | Archivos modificados | Migraciones | Complejidad |
|---|---|---|---|---|
| 1 (P0) | 0 | 3 | 1 (thumbnails) | Baja — 1-2 días |
| 2 (P1 Art Bank) | 2-3 componentes | 4-5 | 1 (tags) | Media — 3-5 días |
| 3 (P1 Product Images) | 4-5 páginas nuevas | 2-3 API routes | 0 | Media-Alta — 5-7 días |
| 4 (P2) | 6-8 | 5-6 | 2-3 | Alta — 7-10 días |

---

## 13. Documentación de referencia generada

Los siguientes documentos de referencia fueron generados como parte de esta auditoría y están disponibles en `docs/reference/`:

### Printful API (4 docs)
- `printful-api-overview.md` — Auth, rate limits (120 req/min), response format, error handling
- `printful-api-orders.md` — Order lifecycle (draft→confirmed→processing→shipped→completed), endpoints, cost structures, tracking
- `printful-api-products.md` — Sync products CRUD, variant management, file placements, pricing
- `printful-api-catalog.md` — Catálogo público, size guides, técnicas de impresión, availability

### Responsive & Adaptive (4 docs)
- `responsive-material-design.md` — Material Design 3 breakpoints, navigation patterns, adaptive layouts
- `shadcn-data-table.md` — shadcn DataTable patterns, column visibility, mobile handling
- `tanstack-table-responsive.md` — TanStack Table column visibility API, responsive strategies
- `nextjs-route-groups.md` — Next.js route group layout patterns, organization

Estos documentos sirven como referencia para el desarrollo futuro del admin — no son documentación oficial sino resúmenes extraídos.

---

## 14. Inventario completo del admin actual

### 14.1 Librerías instaladas (package.json)

| Librería | Versión | Uso actual |
|---|---|---|
| `@tanstack/react-table` | 8.21.3 | **INSTALADA PERO NO USADA** — tables usan shadcn/ui Table crudo |
| `@tanstack/react-query` | 5.75.5 | Sí — hooks useOrders, useProducts, useDesigns, useCustomers |
| `recharts` | 2.15.3 | Sí — Dashboard charts (revenue trend, top products, acquisition) |
| `sonner` | 2.0.3 | Sí — Toast notifications |
| `xlsx` | 0.18.5 | Sí — Export CSV/Excel en analytics |
| `mermaid` | 11.12.3 | Sí — Diagramas en agent visualization |
| `stripe` | 20.3.1 | Parcial — importado pero no integrado end-to-end |
| `zod` | 4.3.6 | Parcial — solo moderate endpoint lo usa |
| `pino` | 10.3.1 | Sí — Logger |
| `iron-session` | 8.0.4 | Sí — Auth sessions |
| `react-markdown` | 10.1.0 | Sí — Render markdown en blog/legal |
| `bcryptjs` | 3.0.3 | Sí — Password hashing |

### 14.2 Componentes compartidos

**26 primitivos shadcn/ui**: alert-dialog, avatar, badge, button, card, checkbox, command, dialog, dropdown-menu, input, label, popover, progress, safe-markdown, scroll-area, select, separator, sheet, sparkline, switch, table, tabs, textarea, tooltip

**Layout/Navigation**:
- `DashboardLayout.tsx` — Layout wrapper principal
- `Sidebar.tsx` — Sidebar desktop (colapsable, 5 secciones: Operations, Content, AI & Agents, Marketing, System)
- `MobileSidebar.tsx` — Drawer mobile
- `TopBar.tsx` — Header con logo, search, user menu, theme toggle
- `Breadcrumbs.tsx` — Navegación breadcrumb

**Funcionalidad avanzada**:
- `CommandPalette.tsx` — Cmd+K con navegación, búsqueda global, acciones rápidas
- `GlobalSearch.tsx` — Search across all data
- `KeyboardShortcutsHelp.tsx` — Dialog de atajos (?)
- `ThemeToggle.tsx` — Light/dark/system
- `ThemeEditorDialog.tsx` — OKLCH color picker para temas custom
- `ActivityFeed.tsx` — Timeline de actividad reciente
- `QuickActions.tsx` — Botones de acción rápida
- `ErrorBoundary.tsx` — Error boundary

**Agent visualization**:
- `agent/ChatMessage.tsx`, `ToolCallCard.tsx`, `CodeBlock.tsx`, `DataTable.tsx`, `MermaidDiagram.tsx`, `WaterfallTimeline.tsx`

**Providers**:
- `providers/QueryProvider.tsx` — React Query
- `providers/SSEProvider.tsx` — Server-Sent Events

### 14.3 Hooks

**Query hooks**: `useProducts()`, `useOrders()`, `useCustomers()`, `useDesigns()` — React Query con paginación, search, filtros
**Mutation hooks**: `useProductMutations()` — bulk update, archive
**Custom hooks**: `useKeyboardShortcuts()` (j/k nav), `usePodClawChat()` (SSE stream), `useSidebarCollapsed()` (persist state)

### 14.4 Lib

**Core**: `admin-api.ts` (adminFetch wrapper), `auth.ts`, `auth-middleware.ts`, `session.ts`, `rbac.ts`
**Data**: `supabase.ts`, `supabase-admin.ts`, `audit.ts`, `export-utils.ts`
**Security**: `rate-limit.ts`, `validation.ts`
**Monitoring**: `logger.ts` (pino), `sse-emitter.ts`, `artifact-detector.ts`

### 14.5 Todas las páginas dashboard — Estado verificado

| Página | Ruta | Datos reales | Search | Filter | Pagination | Bulk actions | Mobile responsive |
|---|---|---|---|---|---|---|---|
| Dashboard | `/` | Sí (stats cards, 4 recharts, activity feed, subscription metrics) | — | — | — | — | Sí |
| Products | `/products` | Sí | Debounced | Status/Category | Prev/Next | Publish/Archive (checkboxes) | Card view |
| Orders | `/orders` | Sí | Sí | Status buttons | Prev/Next | Ship/Deliver/Cancel (checkboxes) | Card view |
| Customers | `/customers` | Sí | Debounced | — | Prev/Next | — | Button cards |
| Returns | `/returns` | Sí | — | Tab status (all/pending/approved/rejected/completed) | — | Approve/Reject dialogs | Cards |
| Designs | `/designs` | Sí | — | Tab status | Prev/Next | Approve/Reject | Grid |
| Reviews | `/reviews` | Sí | — | Status dropdown | Sí | Approve/Reject con notes | Cards |
| Categories | `/categories` | Sí | — | Active/Inactive tabs | — | Toggle active | — |
| Analytics | `/analytics` | Sí (RFM, funnel, demand forecast, P&L, margins) | — | — | — | CSV export | — |
| Blog | `/blog` | Sí | — | — | — | CRUD | — |
| Agent Monitor | `/agent` | Sí (Bridge API) | — | — | — | — | — |
| Agent Sessions | `/agent/[id]` | Sí | — | — | — | — | — |
| Agent Chat | `/agent/chat` | Sí (SSE stream) | — | — | — | — | — |
| Agent Errors | `/agent/errors` | Sí | — | Filterable | — | — | — |
| Agent Memory | `/agent/memory` | Sí | — | — | — | — | — |
| Agent Metrics | `/agent/metrics` | Sí | — | — | — | — | — |
| Agent Schedule | `/agent/schedule` | Sí | — | — | — | — | — |
| Agent Soul | `/agent/soul` | Sí | — | — | — | — | — |
| Tenants | `/tenants` | Sí | — | — | — | CRUD | — |
| Tenant Create | `/tenants/new` | Form | — | — | — | — | — |
| Tenant Detail | `/tenants/[id]` | Sí | — | — | — | — | — |
| Settings | `/settings` | Sí | — | — | — | Save | — |
| Legal | `/legal` | Sí | — | — | — | — | — |
| Legal Pages | `/legal/[slug]` | Sí | — | — | — | Markdown editor | — |
| Messaging | `/messaging` | Sí | — | — | — | — | — |
| Branding | `/branding` | Sí | — | — | — | — | — |
| Monitoring | `/monitoring` | Sí | — | — | — | — | — |
| Translations | `/translations` | Sí | — | — | — | Auto-translate | — |
| A/B Tests | `/ab-tests` | Sí | — | — | — | Start/Stop | — |
| Audit | `/audit` | Sí | — | Filters | — | — | — |
| SEO | `/seo` | Sí | — | — | — | — | — |

### 14.6 Todas las API routes — Por dominio

**Dashboard** (6): stats, recent-orders, revenue-trend, top-products, customer-acquisition, activity-feed
**Products** (6): list, bulk, get/[id], put/[id], patch/[id], delete/[id]
**Orders** (4): list, bulk, get/[id], put/[id], returns/[id]
**Customers** (3): list, profile/[email], orders/[email]
**Returns** (4): list, approve/[id], reject/[id], receive/[id]
**Designs** (3): list, moderate/[id], get/[id]
**Reviews** (2): list, moderate/[id]
**Analytics** (4): finance/report, export, rfm, demand, funnel
**Categories** (2): list, toggle/[id]
**Blog** (5): list, create, get/[id], update/[id], delete/[id]
**Legal** (5): pages list, page/[slug], update/[slug], versions/[slug], settings, consents
**Tenants** (6): list, create, get/[id], update/[id], billing/[id], check-slug
**Agent** (16): status, agents list, run/pause/resume/stop, metrics, sessions, events, memory, heartbeat, health, chat stream, conversations CRUD
**Themes** (5): list, create, get/[id], update/[id], activate/[id]
**Translations** (3): get, update, auto-translate
**Admin** (6): settings get/put, sitemap, seo/[locale] get/put, credits/adjust, agent/soul
**Notifications** (2): list, mark-all-read
**Messaging** (1): config
**Utilities** (6): health, dev/check-index, audit, search, task, events/stream, monitoring/errors

**Total**: 72 API routes verificadas

---

## 15. Feature Proposal — Experiencia completa de gestión

> Cruce del inventario real (Sección 14) con mejores prácticas de Shopify Polaris, Medusa Admin v2, Retool, y patrones documentados de e-commerce POD.
>
> **Principio**: Gestiones de terceros (Stripe dashboard, creación de productos en Printful) permanecen externas. Mejoramos **observabilidad** de esos sistemas.

### 15.1 M1 — Seguridad & Auth (P0)

| # | Feature | Estado actual | Cambio necesario |
|---|---|---|---|
| M1.1 | Auth unificada en todas las rutas | 39 sin auth + 12 forgeable | Migrar TODAS las rutas a `withAuth()` / `withPermission()` |
| M1.2 | RBAC granular | Existe en `rbac.ts` pero sin usar | Roles: super_admin, admin, editor, viewer. Permisos por resource:action |
| M1.3 | SESSION_SECRET sin fallback | Fallback hardcoded | Eliminar fallback — forzar env var en producción |
| M1.4 | Audit trail en writes | Tabla `audit_log` existe | Cada write crea entrada: who, what, when, old_value, new_value |

### 15.2 M2 — DataTable reutilizable (P1)

TanStack Table v8.21.3 está en `package.json` pero NINGUNA página la usa. Mayor ROI: 1 componente → 9 páginas mejoradas.

| # | Feature | Detalle |
|---|---|---|
| M2.1 | `<DataTable>` component | Wrapper TanStack: sorting, filtering, pagination, column visibility, row selection, sticky headers |
| M2.2 | Column visibility toggle | Botón "Columns" — persiste en localStorage |
| M2.3 | Saved views | Guardar filter+sort como vistas nombradas |
| M2.4 | Inline cell editing | Click celda → editar → auto-save (precio, status, título) |
| M2.5 | Responsive card fallback | Patrón Orders aplicado uniformemente a TODAS las tablas |
| M2.6 | Data export universal | Botón "Export" en cada tabla: CSV, Excel |
| M2.7 | Empty states diseñados | Ilustración + call-to-action contextual por tabla vacía |

### 15.3 M3 — Observabilidad (P1)

No gestionamos Printful/Stripe/Supabase. Solo surfaceamos su estado.

| # | Feature | Detalle |
|---|---|---|
| M3.1 | System health dashboard | Semáforo: Printful API, Stripe API, Supabase, Redis, PodClaw. Polling 30s |
| M3.2 | Webhook event log | Lista scrollable: timestamp, type, status, payload preview expandible |
| M3.3 | Cron job monitor | sync-pod, abandoned-cart, drip, cleanup, retry-orders: last/next run, status, duración |
| M3.4 | Sync status por producto | Badge: Synced (verde), Pending (amarillo), Error (rojo), Not Published (gris) |
| M3.5 | Provider response times | Sparkline latencia P50/P95 últimas 24h |
| M3.6 | Printful product link | Link directo al dashboard Printful por producto |
| M3.7 | Data integrity checks | Productos sin imágenes, variantes sin precio, órdenes sin items |

### 15.4 M4 — Orders mejoradas (P1)

| # | Feature | Detalle |
|---|---|---|
| M4.1 | Order timeline | Cronología visual: created → paid → sent to provider → in production → shipped → delivered |
| M4.2 | Order notes internas | Notas admin-only por orden |
| M4.3 | Fulfillment tracking board | Kanban: Received → In Production → Shipped → Delivered |
| M4.4 | Fraud indicators | Flags: billing/shipping mismatch, high-risk countries, pagos fallidos |
| M4.5 | Shipping label viewer | Link a etiqueta de envío de Printful |
| M4.6 | Invoice / packing slip PDF | PDF descargable por orden |

### 15.5 M5 — Products mejorados (P1)

| # | Feature | Detalle |
|---|---|---|
| M5.1 | Product detail mejorado | Tabs: General, Variants, Images, SEO, GPSR. Contextual Save Bar sticky |
| M5.2 | Variant matrix visual | Grid color × size con precio/stock por celda. Edición inline |
| M5.3 | Product image gallery | Reordenar (drag&drop), set primary, bulk upload, preview mockups |
| M5.4 | Price bulk editor | Vista spreadsheet para múltiples productos/variantes |
| M5.5 | Product health scorecard | Views, conversion, revenue, margin, return rate, rating — en una card |
| M5.6 | Product duplication | Clonar producto como punto de partida |
| M5.7 | GPSR compliance dashboard | Status compliance por producto. Bulk GPSR editor |
| M5.8 | Margin calculator real | Retail - base cost (Printful) - shipping - Stripe fee = margin. Alert <35% |

### 15.6 M6 — Customers mejorados (P1)

| # | Feature | Detalle |
|---|---|---|
| M6.1 | Customer detail page | Full profile: órdenes, spend, RFM segment, wishlist, communication log |
| M6.2 | Customer tags/labels | VIP, wholesale, influencer. Filtrar por tags |
| M6.3 | CLV (Customer Lifetime Value) | CLV calculado, trend, por fuente de adquisición |
| M6.4 | Customer export | CSV con filtros aplicados |
| M6.5 | Account actions | Disable account, reset password link |

### 15.7 M7 — Designs end-to-end (P1)

| # | Feature | Detalle |
|---|---|---|
| M7.1 | Thumbnails 300px | Auto-generate on upload. Grid pasa de 500MB→15MB |
| M7.2 | Design-to-product mapping | Qué diseños en qué productos. Detectar huérfanos |
| M7.3 | Design asset browser | Navegar bucket con carpetas, preview, metadata |
| M7.4 | Tags/categorías | Agrupar por tema (animals, Easter, feminist, groovy) |
| M7.5 | Bulk actions | Approve/reject/delete en masa |
| M7.6 | Filtros avanzados | Por modelo, estilo, dimensiones, con/sin fondo |
| M7.7 | Uploader directo | Subir diseños desde admin |
| M7.8 | Mockup generation status | Productos con/sin mockups, pending, fallidos |

### 15.8 M8 — Analytics & Finance mejorados (P2)

| # | Feature | Detalle |
|---|---|---|
| M8.1 | Revenue by geography | Revenue y órdenes por país/región |
| M8.2 | Cohort retention | % clientes mes X que regresan en X+1, X+2 |
| M8.3 | Abandoned cart analytics | Recovery rate, recovery revenue, top abandoned products |
| M8.4 | Shipping & fulfillment metrics | Avg fulfillment time, on-time %, shipping cost vs paid |
| M8.5 | Comparison periods | This week vs last week, this month vs last month |
| M8.6 | Custom date range | Selector global para todas las analytics |
| M8.7 | Real-time sales ticker | SSE feed: "Order #X — Product Y — EUR Z" |
| M8.8 | Stripe payment health | Success rate, failed payments log, dispute tracker |

### 15.9 M9 — Content management (P2)

| # | Feature | Detalle |
|---|---|---|
| M9.1 | Rich text editor blog | Tiptap/BlockNote con image upload, embeds |
| M9.2 | Blog multi-language | Posts en EN/ES/DE con switcher |
| M9.3 | Post scheduling | Publish date futuro, auto-publish via cron |
| M9.4 | Email template editor | Ver/editar templates transaccionales, preview, test send |
| M9.5 | Email delivery log | Emails enviados, delivered, opened (Resend) |
| M9.6 | Translation completeness | % por idioma, missing keys highlighted, side-by-side editing |
| M9.7 | SEO audit dashboard | Missing meta tags, duplicate titles, broken links |
| M9.8 | Redirect manager | 301/302 redirects para URLs cambiadas |

### 15.10 M10 — Notification Center (P1)

| # | Feature | Detalle |
|---|---|---|
| M10.1 | Bell icon en TopBar | Dropdown: unread notifications, grouped, mark-as-read |
| M10.2 | Real-time via SSE | Multiplexar: new order, sync error, webhook failed, margin alert |
| M10.3 | Notification rules | Configurar qué eventos notifican: orders >€100, sync failures, low margin |

### 15.11 M11 — UX patterns faltantes (P2)

| # | Feature | Detalle |
|---|---|---|
| M11.1 | Contextual Save Bar | Sticky Save/Discard al editar cualquier recurso |
| M11.2 | Loading skeletons | Extender a Products, Customers, Designs, Orders |
| M11.3 | Confirmation dialogs | AlertDialog en TODAS las operaciones destructivas |
| M11.4 | Keyboard nav global | `g d` (dashboard), `g o` (orders), `g p` (products) |
| M11.5 | Sticky table headers | Headers visibles al scrollear |
| M11.6 | Undo toast | Después de bulk action: "Undo" button por 10s |
| M11.7 | Date range picker | Componente reutilizable para analytics, orders, audit |

### 15.12 M12 — Arquitectura & Escalabilidad (P2)

| # | Feature | Detalle |
|---|---|---|
| M12.1 | `<PageLayout>` estandarizado | Breadcrumbs → Title + Actions → Filters → Content → Pagination |
| M12.2 | Hooks por módulo | useCustomers, useDesigns, useSyncStatus, useWebhooks, useCronJobs |
| M12.3 | `usePersistedState` | localStorage para column visibility, sort, filters, sidebar |
| M12.4 | SSE multiplexado | Single endpoint → NotificationCenter, ActivityFeed, Dashboard |
| M12.5 | API rate limiting | Verificar que TODAS las rutas lo usan |

### 15.13 M13 — Printify→Printful Migration (P0)

| # | Feature | Detalle |
|---|---|---|
| M13.1 | Migrar 14 refs Printify | 9 archivos (ver Sección 8 para tabla exacta) |
| M13.2 | Costes reales de Printful | Finance usa 45% margen ficticio → datos reales de Printful API |
| M13.3 | Create Product dialog | "Printify Template" → "Printful Template", categorías dinámicas |

### 15.14 Resumen por prioridad

| Prioridad | Módulos | Features | Impacto |
|---|---|---|---|
| **P0** | M1 (Security), M13 (Migration) | 7 | Bloquea producción |
| **P1** | M2 (DataTable), M3 (Observability), M4 (Orders), M5 (Products), M6 (Customers), M7 (Designs), M10 (Notifications) | 38 | Operación diaria eficiente |
| **P2** | M8 (Analytics), M9 (Content), M11 (UX), M12 (Architecture) | 23 | Calidad y escalabilidad |
| **Total** | **13 módulos** | **68 features** | Admin completo y competitivo |

### 15.15 Arquitectura recomendada

**Patrón de página estándar**:
```
<PageLayout title="Products" actions={<Button>New Product</Button>}>
  <FilterBar filters={[status, category, dateRange]} onExport={exportCSV} />
  <DataTable columns={productColumns} data={products}
    enableColumnVisibility enableRowSelection enableSorting
    savedViews={savedViews} emptyState={<EmptyProducts />} />
</PageLayout>
```

**Real-time**: SSE (no WebSocket) — unidireccional server→client. Un endpoint `/api/admin/events` que despacha a NotificationCenter, ActivityFeed, Dashboard.

**Caching**:
| Capa | Tool | TTL |
|---|---|---|
| Client | React Query | 30s-5min |
| Server | Redis | 1-10min (analytics) |
| Persist | localStorage | Indefinido (UI state) |

### 15.16 Fuentes consultadas

- Shopify Polaris Design System (Index Tables, Contextual Save Bar, Resource pages)
- Medusa Admin v2 (Widget system, UI Routes, Bulk editor)
- Retool (Inline editing, data sync patterns)
- TanStack Table docs (column visibility, virtual scroll)
- Hookdeck (Webhook health monitoring)
- E-Commerce KPIs 2026 (Shopify, ThoughtSpot)
- POD KPIs for 90%+ Gross Margin (FinancialModelsLab)
- SSE vs WebSockets (Dev.to)
- Material Design 3 responsive patterns
- Admin Dashboard UI/UX Best Practices 2025

---

*Auditoría y feature proposal verificados contra codebase real. Última actualización: 2026-03-06.*
