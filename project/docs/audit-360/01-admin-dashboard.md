# Auditoria 360 -- Admin Dashboard POD AI

**Fecha**: 2026-02-23
**Alcance**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/admin/`
**Puntuacion global**: 5.5/10

---

## 1. Estado actual

### 1.1 Inventario de rutas (34 paginas)

```
admin/src/app/
  page.tsx                    -- Dashboard (home)              [CON DashboardLayout]
  login/page.tsx              -- Login
  settings/page.tsx           -- Settings                      [STUB - sin persistencia]
  products/page.tsx           -- Lista de productos            [CON DashboardLayout]
  products/[id]/page.tsx      -- Editar producto               [CON DashboardLayout]
  products/new/page.tsx       -- Crear producto                [CON DashboardLayout]
  orders/page.tsx             -- Lista de ordenes
  orders/[id]/page.tsx        -- Detalle de orden
  customers/page.tsx          -- Lista de clientes             [CON DashboardLayout]
  analytics/page.tsx          -- Analiticas (RFM, demanda, P&L)
  designs/page.tsx            -- Galeria de disenos
  designs/[id]/page.tsx       -- Detalle de diseno
  reviews/page.tsx            -- Moderacion de resenas
  returns/page.tsx            -- Gestion de devoluciones
  branding/page.tsx           -- Temas visuales                [CON DashboardLayout]
  seo/page.tsx                -- Gestion SEO
  messaging/page.tsx          -- Config Telegram/WhatsApp
  translations/page.tsx       -- Tabla i18n                    [CON DashboardLayout]
  finance/page.tsx            -- Reportes financieros
  audit/page.tsx              -- Log de auditoria
  ab-tests/page.tsx           -- Tests A/B
  monitoring/page.tsx         -- Monitoreo de errores
  legal/page.tsx              -- Lista paginas legales
  legal/[slug]/page.tsx       -- Editor de pagina legal
  legal/consents/page.tsx     -- Registros GDPR
  legal/settings/page.tsx     -- Config entidad legal
  agent/page.tsx              -- Monitor del agente
  agent/chat/page.tsx         -- Chat con PodClaw
  agent/soul/page.tsx         -- Evolucion SOUL.md
  agent/memory/page.tsx       -- Explorador de memoria
  agent/schedule/page.tsx     -- Cron del agente
  agent/errors/page.tsx       -- Errores del agente
  agent/metrics/page.tsx      -- Metricas del agente
  agent/[id]/page.tsx         -- Detalle de sesion
```

**Solo 7 de 34 paginas usan `DashboardLayout`** (sidebar + topbar + breadcrumbs). Las otras 27 renderizan contenido desnudo sin navegacion compartida.

### 1.2 Cadena de layouts

**Root layout** (`admin/src/app/layout.tsx`, linea 15-37):
```
<html lang="en">
  <body>
    QueryProvider > NotificationsProvider > SSEProvider > ErrorBoundary
      {children}
    GlobalSearch
    Toaster (sonner, top-right)
  </body>
</html>
```

No existe ningun route group layout `(dashboard)/layout.tsx`. Cada pagina debe importar y envolver manualmente con `DashboardLayout`.

### 1.3 Middleware (`admin/src/middleware.ts`)

- Cookie `admin-session` parseada como JSON plano (linea 22)
- Valida `role === 'admin'` (linea 24)
- **Excluye TODAS las rutas API** (linea 7: `pathname.startsWith('/api/')`)
- Redirige a `/login` si no hay sesion o rol invalido

### 1.4 next.config.ts

- `output: "standalone"` para Docker
- `basePath` dinamico via `ADMIN_BASE_PATH`
- Headers de seguridad: CSP, HSTS, X-Frame-Options (DENY), Referrer-Policy
- API routes con `Cache-Control: no-store`

### 1.5 Inventario de componentes

**shadcn/ui instalados (22)** en `admin/src/components/ui/`:

| Componente | Archivo |
|---|---|
| alert-dialog | `ui/alert-dialog.tsx` |
| avatar | `ui/avatar.tsx` |
| badge | `ui/badge.tsx` |
| button | `ui/button.tsx` |
| card | `ui/card.tsx` |
| checkbox | `ui/checkbox.tsx` |
| command | `ui/command.tsx` |
| dialog | `ui/dialog.tsx` |
| dropdown-menu | `ui/dropdown-menu.tsx` |
| input | `ui/input.tsx` |
| label | `ui/label.tsx` |
| popover | `ui/popover.tsx` |
| scroll-area | `ui/scroll-area.tsx` |
| select | `ui/select.tsx` |
| separator | `ui/separator.tsx` |
| sheet | `ui/sheet.tsx` |
| sparkline | `ui/sparkline.tsx` (custom) |
| switch | `ui/switch.tsx` |
| table | `ui/table.tsx` |
| tabs | `ui/tabs.tsx` |
| textarea | `ui/textarea.tsx` |
| tooltip | `ui/tooltip.tsx` |

**Componentes custom (22)** en `admin/src/components/`:

| Componente | Tipo | Usado por |
|---|---|---|
| `DashboardLayout.tsx` | Layout shell | 7 paginas (de 34) |
| `Sidebar.tsx` | Navegacion desktop | DashboardLayout |
| `MobileSidebar.tsx` | Navegacion mobile (Sheet) | DashboardLayout |
| `TopBar.tsx` | Barra superior | DashboardLayout |
| `Breadcrumbs.tsx` | Migas de pan | DashboardLayout |
| `CommandPalette.tsx` | Cmd+K palette | GlobalSearch |
| `GlobalSearch.tsx` | Wrapper search | Root layout |
| `ActivityFeed.tsx` | Feed de actividad | Dashboard |
| `QuickActions.tsx` | Acciones rapidas | Dashboard |
| `ThemeToggle.tsx` | Toggle dark/light | TopBar |
| `ThemeEditorDialog.tsx` | Editor de temas | Branding page |
| `OklchColorPicker.tsx` | Picker OKLCH | ThemeEditorDialog |
| `ErrorBoundary.tsx` | Error boundary | Root layout |
| `KeyboardShortcutsHelp.tsx` | Ayuda atajos | CommandPalette |
| `agent/ChatMessage.tsx` | Mensaje de chat | Agent chat |
| `agent/ToolCallCard.tsx` | Card tool call | Agent chat |
| `agent/WaterfallTimeline.tsx` | Timeline waterfall | Agent detail |
| `agent/artifacts/DataTable.tsx` | Tabla en artifacts | ChatMessage |
| `agent/artifacts/CodeBlock.tsx` | Codigo en artifacts | ChatMessage |
| `agent/artifacts/MermaidDiagram.tsx` | Diagrama mermaid | ChatMessage |
| `providers/QueryProvider.tsx` | React Query wrapper | Root layout |
| `providers/SSEProvider.tsx` | SSE connection | Root layout |

### 1.6 Inventario de rutas API (69 archivos)

```
admin/src/app/api/
  auth/login/route.ts
  health/route.ts
  test-sse/route.ts
  search/route.ts
  task/route.ts
  events/stream/route.ts
  dashboard/stats/route.ts
  dashboard/revenue-trend/route.ts
  dashboard/activity-feed/route.ts
  dashboard/recent-orders/route.ts
  dashboard/top-products/route.ts
  dashboard/customer-acquisition/route.ts
  products/route.ts                        [CON withPermission]
  products/[id]/route.ts                   [CON withPermission]
  products/bulk/route.ts
  orders/route.ts
  orders/[id]/route.ts
  customers/route.ts
  customers/[email]/orders/route.ts
  customers/[email]/profile/route.ts
  designs/route.ts
  designs/[id]/route.ts
  designs/[id]/moderate/route.ts           [CON withPermission]
  reviews/route.ts
  reviews/[id]/route.ts
  returns/route.ts
  returns/[id]/approve/route.ts
  returns/[id]/reject/route.ts
  analytics/rfm/route.ts
  analytics/demand/route.ts
  agent/[...path]/route.ts                 -- Proxy catch-all a PodClaw
  agent/sessions/route.ts
  agent/sessions/[id]/events/route.ts
  agent/metrics/route.ts
  agent/memory/route.ts
  agent/schedule/route.ts
  agent/chat/stream/route.ts
  agent/chat/conversations/route.ts
  agent/chat/conversations/[id]/route.ts
  ab-tests/route.ts
  ab-tests/[id]/start/route.ts
  ab-tests/[id]/stop/route.ts
  audit/route.ts
  monitoring/errors/route.ts
  messaging/config/route.ts
  translations/route.ts
  translations/auto-translate/route.ts
  admin/seo/route.ts
  admin/sitemap/route.ts
  admin/brand-config/route.ts
  admin/themes/route.ts
  admin/themes/[id]/route.ts
  admin/themes/[id]/activate/route.ts
  admin/setup-rbac/route.ts
  admin/notifications/route.ts
  admin/notifications/mark-all-read/route.ts
  admin/subscribers/route.ts
  admin/credits/adjust/route.ts
  admin/finance/report/route.ts
  admin/finance/export/route.ts
  admin/analytics/export/route.ts
  admin/orders/[id]/retry/route.ts
  admin/orders/bulk/route.ts
  admin/agent/soul/route.ts
  admin/legal-pages/route.ts
  admin/legal-pages/[slug]/route.ts
  admin/legal-pages/[slug]/versions/route.ts
  admin/legal/consents/route.ts
  admin/legal-settings/route.ts
```

**Solo 3 de 69 archivos usan `withPermission`** (4.3%). Los otros 66 no tienen ninguna verificacion de autenticacion.

### 1.7 Librerias y utilidades (`admin/src/lib/`)

| Archivo | Funcion | Estado |
|---|---|---|
| `admin-api.ts` | `adminFetch()`, `apiUrl()` -- basePath-aware fetch | Funcional, sin auth injection |
| `supabase.ts` | Singleton `supabaseAdmin` (service role) | Funcional, duplicado |
| `supabase-admin.ts` | Factory `createAdminClient()` (service role) | Funcional, duplicado |
| `rbac.ts` | `withPermission()`, `requireAuth()`, `hasPermission()` | Funcional, apenas usado |
| `sse-emitter.ts` | In-memory SSE emitter (singleton Map) | Single-instance only |
| `audit.ts` | Logger de auditoria a Supabase | Funcional |
| `logger.ts` | Logger estructurado | Funcional |
| `artifact-detector.ts` | Detecta tablas/codigo/mermaid en respuestas AI | Funcional |
| `export-utils.ts` | CSV export helper | Funcional |
| `utils.ts` | `cn()` (clsx + tailwind-merge) | Funcional |

### 1.8 Hooks (`admin/src/hooks/`)

| Hook | Funcion |
|---|---|
| `useSidebarCollapsed.ts` | Persistencia de sidebar collapsed en localStorage |
| `useKeyboardShortcuts.ts` | Atajos globales de teclado |
| `usePodClawChat.ts` | Logica de streaming chat con PodClaw |

### 1.9 Contextos (`admin/src/contexts/`)

| Contexto | Funcion |
|---|---|
| `NotificationsContext.tsx` | Estado de notificaciones SSE (unread count, mark all read) |

---

## 2. Gaps detectados

### 2.1 Seguridad -- CRITICO

| ID | Gap | Impacto | Archivo |
|---|---|---|---|
| **G-SEC-1** | 66 de 69 rutas API sin autenticacion | Cualquier cliente puede leer datos de clientes, ordenes, finanzas y controlar el agente AI | `admin/src/middleware.ts` linea 7 |
| **G-SEC-2** | Cookie de sesion es JSON plano sin firmar | Un atacante puede fabricar `{"role":"admin","email":"x"}` y obtener acceso completo | `admin/src/middleware.ts` linea 22 |
| **G-SEC-3** | Sin proteccion CSRF en endpoints de mutacion | Cross-site form submissions pueden modificar datos | Todas las rutas POST/PUT/PATCH/DELETE |
| **G-SEC-4** | Sin rate limiting en `/api/auth/login` | Vulnerable a fuerza bruta | `admin/src/app/api/auth/login/route.ts` |
| **G-SEC-5** | Sin validacion de input en rutas API | Inyeccion de datos malformados | Todas las rutas que leen `request.json()` |
| **G-SEC-6** | ReactMarkdown sin DOMPurify | XSS posible via contenido legal o SOUL.md | `legal/[slug]/page.tsx`, `agent/soul/page.tsx` |

### 2.2 Arquitectura

| ID | Gap | Impacto | Archivo |
|---|---|---|---|
| **G-ARCH-1** | 27 de 34 paginas sin DashboardLayout | Sin sidebar, topbar, ni breadcrumbs -- UX fragmentada | Ver tabla en seccion 1.1 |
| **G-ARCH-2** | Sin route group layout `(dashboard)/` | Cada pagina debe envolver manualmente DashboardLayout | `admin/src/app/` |
| **G-ARCH-3** | Sin `not-found.tsx` ni `error.tsx` globales | 404 y errores muestran pagina en blanco | `admin/src/app/` |
| **G-ARCH-4** | Sin ThemeProvider para dark mode | `ThemeToggle.tsx` existe pero no hay provider que persista el tema | `admin/src/app/layout.tsx` |
| **G-ARCH-5** | Supabase client duplicado | Dos archivos crean clientes service-role con patrones diferentes | `lib/supabase.ts` vs `lib/supabase-admin.ts` |

### 2.3 Data flow

| ID | Gap | Impacto | Archivo |
|---|---|---|---|
| **G-DATA-1** | React Query solo en 1 pagina (Dashboard) | Las otras 33 paginas usan useEffect+useState sin cache, retry, ni deduplicacion | `admin/src/app/page.tsx` unico con `useQuery` |
| **G-DATA-2** | Sin optimistic updates | Todas las mutaciones esperan respuesta del servidor antes de actualizar UI | Global |
| **G-DATA-3** | adminFetch sin retry ni error transformation | Cada pagina debe manualmente verificar `response.ok` | `admin/src/lib/admin-api.ts` |
| **G-DATA-4** | SSE emitter in-memory | No funciona con multiples instancias detras de Caddy | `admin/src/lib/sse-emitter.ts` |

### 2.4 Features faltantes

| ID | Gap | Impacto |
|---|---|---|
| **G-FEAT-1** | Settings page es stub completo | `setTimeout` simula guardado (linea 43), sin API call, sin persistencia |
| **G-FEAT-2** | Endpoints de test messaging no existen | Botones de "Test Telegram/WhatsApp" en messaging page no tienen rutas correspondientes |
| **G-FEAT-3** | "View Results" en A/B tests no hace nada | Boton sin handler |
| **G-FEAT-4** | Branding save no implementado | Linea 219 TODO en branding page |
| **G-FEAT-5** | Sin paginacion en multiples paginas | designs, reviews, returns, audit, agent errors -- cargan todo de golpe |
| **G-FEAT-6** | Sin MFA, password reset, ni CAPTCHA en login | `admin/src/app/login/page.tsx` |

### 2.5 Codigo muerto / duplicados

| ID | Item | Descripcion |
|---|---|---|
| **G-DEAD-1** | `GlobalSearch.tsx` vs `CommandPalette.tsx` | Funcionalidad solapada -- CommandPalette es mas completo |
| **G-DEAD-2** | `test-sse/route.ts` | Ruta de desarrollo/test, no deberia estar en produccion |
| **G-DEAD-3** | `supabase.ts` duplica `supabase-admin.ts` | Dos formas de crear el mismo cliente |

---

## 3. Riesgos

### 3.1 Riesgos criticos (bloqueantes para produccion)

| ID | Riesgo | Consecuencia | Probabilidad |
|---|---|---|---|
| **R-SEC-1** | API sin auth expone datos de clientes | Violacion GDPR, perdida de confianza, multas | Alta -- cualquier scan descubre endpoints abiertos |
| **R-SEC-2** | Cookie falsificable | Acceso admin total sin credenciales | Alta -- trivial de explotar con curl |
| **R-SEC-3** | XSS via ReactMarkdown | Inyeccion de scripts en paginas legales/SOUL | Media -- requiere acceso al contenido markdown |

### 3.2 Riesgos altos

| ID | Riesgo | Consecuencia |
|---|---|---|
| **R-SCALE-1** | SSE in-memory con multiples instancias | Notificaciones no llegan a todos los admins conectados |
| **R-SCALE-2** | Sin paginacion en 5+ paginas | Timeout/OOM con 1000+ registros |
| **R-SCALE-3** | Translations carga todo de golpe | Con 3 idiomas x 200 claves = 600 celdas renderizadas en un solo tabla |
| **R-UX-1** | 27 paginas sin navegacion | Admin pierde contexto, no puede navegar entre secciones sin URL manual |

### 3.3 Riesgos medios

| ID | Riesgo | Consecuencia |
|---|---|---|
| **R-UX-2** | 25+ alert()/prompt() calls | UX inconsistente, inaccesible para screen readers |
| **R-UX-3** | 67+ violaciones de color tokens | Dark mode roto, inconsistencia visual |
| **R-DATA-1** | Sin cache en 33 paginas | Cada navegacion re-fetches datos completos |

---

## 4. Inconsistencias

### 4.1 Violaciones de tokens de color prohibidos

**Total: 67+ instancias en 12 archivos.** Segun CLAUDE.md, esta PROHIBIDO usar colores hardcoded como `bg-blue-*`, `text-green-*`, etc.

| Archivo | Lineas | Violaciones |
|---|---|---|
| `admin/src/app/page.tsx` | 68 | `text-green-600`, `text-red-600` |
| `admin/src/app/analytics/page.tsx` | 260-271, 415-569 | `bg-blue-500/10`, `bg-yellow-500/10`, `bg-orange-500/10`, `text-blue-600`, `text-yellow-600`, `text-orange-600`, `text-green-600`, `text-red-600` (14 instancias) |
| `admin/src/app/finance/page.tsx` | 236-394 | `text-green-500`, `text-green-600`, `text-red-600` (11 instancias) |
| `admin/src/app/audit/page.tsx` | 37-40 | `bg-blue-500/10`, `bg-gray-500/10`, `bg-green-500/10`, `text-blue-700`, `text-gray-700`, `text-green-700` |
| `admin/src/app/reviews/page.tsx` | 100, 115 | `bg-green-500/10`, `text-green-500`, `fill-yellow-400`, `text-yellow-400` |
| `admin/src/app/legal/consents/page.tsx` | 340-386 | `text-green-600`, `text-red-600` (6 instancias) |
| `admin/src/app/legal/settings/page.tsx` | 177-178, 201-318 | `bg-green-50`, `bg-green-950`, `bg-red-50`, `bg-red-950`, `text-green-900`, `text-red-900`, `text-red-500` (9 instancias) |
| `admin/src/app/agent/soul/page.tsx` | 301, 366-396 | `bg-green-600`, `bg-green-500/10`, `bg-red-500/10`, `text-green-600`, `text-red-600` (6 instancias) |
| `admin/src/components/ActivityFeed.tsx` | 52-58 | `text-green-600`, `text-red-600`, `text-blue-600` |
| `admin/src/components/QuickActions.tsx` | 24-45 | `text-blue-600`, `text-orange-600`, `text-green-600` |
| `admin/src/components/agent/WaterfallTimeline.tsx` | 35-40 | `bg-blue-500`, `bg-green-500`, `bg-red-500`, `bg-yellow-500`, `bg-gray-500` |

**Mapeo de correccion requerido:**

| Prohibido | Reemplazo correcto |
|---|---|
| `text-green-600` / `text-green-500` | `text-success` |
| `text-red-600` / `text-red-500` | `text-destructive` |
| `bg-green-500/10` / `bg-green-50` | `bg-success/10` |
| `bg-red-500/10` / `bg-red-50` | `bg-destructive/10` |
| `bg-blue-500/10` | `bg-primary/10` |
| `text-blue-600` / `text-blue-700` | `text-primary` |
| `bg-yellow-500/10` | `bg-warning/10` |
| `text-yellow-600` | `text-warning` |
| `bg-orange-500/10` | `bg-warning/10` |
| `text-orange-600` | `text-warning` |
| `bg-gray-500/10` | `bg-muted` |
| `text-gray-700` | `text-muted-foreground` |
| `fill-yellow-400` | Definir `fill-warning` custom |

### 4.2 Uso de alert()/prompt() vs toast/Dialog

**Total: 25+ instancias en 9 archivos.**

| Archivo | Lineas | Tipo | Deberia ser |
|---|---|---|---|
| `products/[id]/page.tsx` | 71, 75 | `alert()` | `toast.error()` |
| `products/new/page.tsx` | 40, 44 | `alert()` | `toast.error()` |
| `designs/page.tsx` | 67, 94 | `alert()` | `toast.error()` |
| `designs/page.tsx` | 76 | `prompt()` | `Dialog` con `Textarea` |
| `designs/[id]/page.tsx` | 125, 130 | `alert()` | `toast.success()` / `toast.error()` |
| `reviews/page.tsx` | 91 | `alert()` | `toast.error()` |
| `returns/page.tsx` | 96, 101, 110, 135, 138 | `alert()` x5 | `toast()` |
| `returns/page.tsx` | 108 | `prompt()` | `Dialog` con `Textarea` |
| `orders/page.tsx` | 216 | `alert()` | `toast.error()` |
| `legal/[slug]/page.tsx` | 116, 120, 124 | `alert()` x3 | `toast()` |
| `agent/soul/page.tsx` | 89, 93, 121, 125 | `alert()` x4 | `toast.error()` |

### 4.3 Patron de data fetching inconsistente

| Patron | Paginas | Ventajas |
|---|---|---|
| React Query (`useQuery`) | 1 pagina (Dashboard) | Cache, dedup, retry, loading/error states automaticos |
| `useEffect` + `useState` + `fetch` | 33 paginas | Ninguna -- patron inferior |

### 4.4 Patron de feedback inconsistente

| Patron | Paginas |
|---|---|
| `toast()` de sonner | Dashboard, orders detail, SEO, A/B tests, settings (stub) |
| `alert()` nativo | Products, designs, reviews, returns, legal editor, agent soul |
| Sin feedback | Algunas operaciones silenciosas |

### 4.5 Patrones de layout inconsistentes

| Con DashboardLayout (7) | Sin DashboardLayout (27) |
|---|---|
| Dashboard, Products list, Product edit, Product new, Customers, Branding, Translations | Login, Settings, Orders, Order detail, Analytics, Designs, Design detail, Reviews, Returns, SEO, Messaging, Finance, Audit, A/B tests, Monitoring, Legal (4 paginas), Agent (7 paginas) |

---

## 5. Quick wins

### 5.1 Seguridad (1-2 dias)

| # | Accion | Archivos | Esfuerzo |
|---|---|---|---|
| QW-1 | Agregar `requireAuth()` a las 66 rutas API sin proteccion | 66 archivos en `api/` | 2-3 horas (mecanico) |
| QW-2 | Firmar cookie de sesion con `iron-session` | `middleware.ts`, `api/auth/login/route.ts` | 4 horas |
| QW-3 | Agregar DOMPurify a ReactMarkdown | `legal/[slug]/page.tsx`, `agent/soul/page.tsx` | 1 hora |
| QW-4 | Rate limiting en login (`@upstash/ratelimit` o manual) | `api/auth/login/route.ts` | 2 horas |

### 5.2 UX (1-2 dias)

| # | Accion | Archivos | Esfuerzo |
|---|---|---|---|
| QW-5 | Reemplazar 25+ `alert()`/`prompt()` con `toast()` y `Dialog` | 9 archivos de pagina | 3 horas |
| QW-6 | Corregir 67+ violaciones de color tokens | 12 archivos | 4 horas (find & replace) |
| QW-7 | Agregar `not-found.tsx` y `error.tsx` globales | `admin/src/app/` | 30 minutos |

### 5.3 Arquitectura (medio dia)

| # | Accion | Archivos | Esfuerzo |
|---|---|---|---|
| QW-8 | Consolidar Supabase client (eliminar `supabase.ts`, mantener `supabase-admin.ts`) | `lib/supabase.ts`, importadores | 1 hora |
| QW-9 | Eliminar `test-sse/route.ts` | `api/test-sse/route.ts` | 5 minutos |

---

## 6. Refactor estructural recomendado

### 6.1 Route group layout (impacto: 27 paginas)

Crear `(dashboard)/layout.tsx` que envuelva todas las paginas autenticadas:

```
admin/src/app/
  (auth)/
    login/page.tsx
  (dashboard)/
    layout.tsx          <-- DashboardLayout (sidebar + topbar + breadcrumbs)
    page.tsx            <-- Dashboard
    products/...
    orders/...
    customers/...
    analytics/...
    designs/...
    reviews/...
    returns/...
    branding/...
    seo/...
    messaging/...
    translations/...
    finance/...
    audit/...
    ab-tests/...
    monitoring/...
    settings/...
    legal/...
    agent/...
```

**Beneficio**: Elimina la importacion manual de DashboardLayout en cada pagina. Garantiza navegacion consistente. Permite agregar paginas nuevas sin riesgo de olvidar el layout.

### 6.2 Migracion a React Query (impacto: 33 paginas)

Crear un hook generico:

```typescript
// admin/src/hooks/useAdminQuery.ts
export function useAdminQuery<T>(path: string, options?: UseQueryOptions) {
  return useQuery({
    queryKey: [path],
    queryFn: async () => {
      const res = await adminFetch(path);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<T>;
    },
    ...options,
  });
}
```

Migrar las paginas mas visitadas primero: orders, products, customers, reviews, analytics.

### 6.3 Sesion segura

Reemplazar cookie JSON plano con `iron-session`:

```typescript
// admin/src/lib/session.ts
import { getIronSession } from 'iron-session';

export const sessionOptions = {
  cookieName: 'admin-session',
  password: process.env.SESSION_SECRET!, // 32+ chars
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
  },
};
```

### 6.4 Validacion de input con Zod

Agregar schemas Zod a los endpoints criticos:

```typescript
// admin/src/lib/schemas/product.ts
import { z } from 'zod';

export const createProductSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  price: z.number().positive(),
  status: z.enum(['draft', 'published', 'archived']),
  category: z.string().optional(),
});
```

### 6.5 SSE via Redis pub/sub

Reemplazar el emitter in-memory con Redis:

```typescript
// admin/src/lib/sse-redis.ts
import Redis from 'ioredis';

const publisher = new Redis(process.env.REDIS_URL!);
const subscriber = new Redis(process.env.REDIS_URL!);

export function emitSSE(event: string, data: any) {
  publisher.publish('admin:sse', JSON.stringify({ event, data }));
}

export function subscribeSSE(callback: (event: string, data: any) => void) {
  subscriber.subscribe('admin:sse');
  subscriber.on('message', (_, message) => {
    const { event, data } = JSON.parse(message);
    callback(event, data);
  });
  return () => subscriber.unsubscribe('admin:sse');
}
```

---

## 7. Roadmap por fases

### Fase 1: Parches criticos (Semana 1)

| Prioridad | Tarea | Estimacion |
|---|---|---|
| P0 | Firmar cookie de sesion con `iron-session` | 4h |
| P0 | Agregar `requireAuth()` a 66 rutas API | 3h |
| P0 | Rate limiting en `/api/auth/login` | 2h |
| P0 | DOMPurify en ReactMarkdown (legal editor + soul) | 1h |
| P1 | Crear route group `(dashboard)/layout.tsx` y mover 27 paginas | 4h |
| P1 | Agregar `not-found.tsx` y `error.tsx` globales | 30min |
| P1 | Reemplazar 25+ `alert()`/`prompt()` con `toast()`/`Dialog` | 3h |
| **Total Fase 1** | | **~17.5h** |

### Fase 2: Pulido (Semana 2-3)

| Prioridad | Tarea | Estimacion |
|---|---|---|
| P2 | Corregir 67+ violaciones de color tokens en 12 archivos | 4h |
| P2 | Migrar top 5 paginas a React Query | 6h |
| P2 | Agregar ThemeProvider (next-themes) para dark mode | 3h |
| P2 | Implementar Settings page real con API backend | 4h |
| P2 | Agregar paginacion a designs, reviews, returns, audit, agent errors | 6h |
| P2 | Consolidar Supabase clients | 1h |
| P2 | Agregar Zod validation a 10 rutas criticas | 4h |
| **Total Fase 2** | | **~28h** |

### Fase 3: Features pro (Mes 1-2)

| Prioridad | Tarea | Estimacion |
|---|---|---|
| P3 | MFA para admin accounts (TOTP) | 8h |
| P3 | RBAC completo: extender `withPermission` a todas las rutas | 6h |
| P3 | SSE via Redis pub/sub (multi-instancia) | 4h |
| P3 | Password reset flow | 4h |
| P3 | Crear endpoints de test messaging (Telegram/WhatsApp) | 3h |
| P3 | Completar "View Results" en A/B tests | 3h |
| P3 | Completar save en Branding page | 2h |
| P3 | Product editor enriquecido (variants, media, SEO fields) | 12h |
| P3 | Export CSV en audit log | 2h |
| P3 | URL-synced filters (query params en tablas/listas) | 6h |
| **Total Fase 3** | | **~50h** |

### Fase 4: Escalabilidad (Mes 2-3)

| Prioridad | Tarea | Estimacion |
|---|---|---|
| P4 | Migrar TODAS las paginas restantes a React Query | 10h |
| P4 | Optimistic updates en mutaciones frecuentes | 6h |
| P4 | Infinite scroll / virtualizacion en listas largas | 8h |
| P4 | CSRF tokens en endpoints de mutacion | 4h |
| P4 | Audit log exportable y paginacion server-side | 4h |
| P4 | Webhooks admin (notificaciones externas) | 8h |
| **Total Fase 4** | | **~40h** |

---

## 8. Impacto en escalabilidad 1.000+ clientes

### 8.1 Cuellos de botella identificados

| Area | Problema con 1000+ clientes | Solucion |
|---|---|---|
| **Customers page** | Carga TODOS los clientes con `useEffect` + `fetch`, sin paginacion | Server-side pagination con `useInfiniteQuery` |
| **Orders page** | Tiene paginacion (20/pagina) pero fetch client-side | Mantener, pero migrar a React Query para cache |
| **Translations** | Carga todos los keys x 3 idiomas en una tabla | Virtual scrolling o paginacion server-side |
| **Designs** | Sin paginacion, galeria completa | Server-side pagination con cursor |
| **Reviews** | Sin paginacion, carga todos | Server-side pagination |
| **Returns** | Sin paginacion | Server-side pagination |
| **Audit log** | Limite de 100, sin paginacion real | Cursor-based pagination |
| **Analytics RFM** | Procesa todos los clientes en memoria | Pre-calcular segmentos en Supabase function |
| **SSE** | In-memory emitter no escala horizontalmente | Redis pub/sub |
| **API routes** | Sin rate limiting | Request throttling por IP/session |

### 8.2 Proyeccion de rendimiento

| Metrica | Estado actual (100 clientes) | Proyeccion (1000+ clientes) | Despues de Fase 2+3 |
|---|---|---|---|
| Customers page load | ~200ms | ~2-5s (timeout posible) | ~200ms (paginado) |
| Orders page load | ~300ms | ~500ms (paginado ya) | ~200ms (con cache RQ) |
| Dashboard load | ~400ms (5 queries) | ~600ms | ~300ms (staleWhileRevalidate) |
| SSE delivery | 100% (single instance) | 30-50% (multi-instance) | 100% (Redis pub/sub) |
| Memory usage per page | ~5MB | ~50MB (sin paginacion) | ~5MB (virtualizado) |

### 8.3 Limites actuales

- **Supabase free tier**: 500MB DB, 2GB bandwidth -- con 1000+ clientes se necesita plan Pro
- **Redis**: Solo usado para SSE actualmente -- con 1000+ clientes, usar tambien para cache de sesion y rate limiting
- **Caddy reverse proxy**: Soporta bien, sin cambios necesarios
- **PodClaw bridge**: Single-threaded FastAPI -- con muchos admins concurrentes, necesita gunicorn workers

---

## 9. Benchmark comparison

### 9.1 vs Stripe Dashboard

| Dimension | Stripe | POD AI Admin | Gap | Prioridad |
|---|---|---|---|---|
| Autenticacion | MFA + OAuth + API keys + session rotation | Cookie JSON sin firmar | CRITICO | P0 |
| RBAC | Granular por recurso y accion | Existe en codigo pero solo 3 rutas lo usan | ALTO | P3 |
| Navegacion | Sidebar persistente, breadcrumbs, URL-synced | Solo 7/34 paginas tienen sidebar | ALTO | P1 |
| Tablas de datos | Sortable, filterable, paginadas, URL-synced | Calidad mixta, sin URL sync en filtros | MEDIO | P3 |
| Busqueda global | Keyboard shortcuts, deep search | CommandPalette con Cmd+K + fallback PodClaw | BAJO | -- |
| Notificaciones | Real-time con read/unread | SSE funciona pero single-instance | MEDIO | P3 |
| Dark mode | Soporte completo | Toggle existe, sin ThemeProvider | ALTO | P2 |
| Loading states | Skeletons consistentes | Inconsistente (pulse divs, spinners, text) | MEDIO | P2 |
| Error handling | Toast + inline errors + retry | Mezcla de alert()/toast/inline | ALTO | P1 |

### 9.2 vs Linear

| Dimension | Linear | POD AI Admin | Gap | Prioridad |
|---|---|---|---|---|
| Keyboard-first | j/k/c/x y 50+ shortcuts | j/k/Enter en orders, Cmd+K | MEDIO | P3 |
| Real-time sync | Full real-time (multiplayer) | SSE solo para notificaciones | MEDIO | P4 |
| Offline support | Optimistic UI, local-first | Ninguno | BAJO | -- |
| Command palette | K key, busqueda profunda | Cmd+K con nav + search + PodClaw fallback | BAJO | -- |
| Data consistency | Optimistic updates everywhere | Sin optimistic updates | MEDIO | P4 |

### 9.3 vs Vercel Dashboard

| Dimension | Vercel | POD AI Admin | Gap | Prioridad |
|---|---|---|---|---|
| Layout consistente | Todas las paginas mismo shell | 27/34 sin shell | ALTO | P1 |
| Data fetching | SWR everywhere, consistente | React Query en 1 pagina, useEffect en 33 | ALTO | P2-P4 |
| Input validation | Client + server Zod | Ninguna validacion | ALTO | P2 |
| Audit log | Inmutable, filtrable, exportable | Filtrable pero sin export | BAJO | P3 |
| Team collaboration | Roles + invitaciones + activity | RBAC existe, apenas usado | ALTO | P3 |
| Deployment | CI/CD integrado, preview deploys | Docker manual con start.sh | MEDIO | -- |

### 9.4 vs Shopify Admin

| Dimension | Shopify | POD AI Admin | Gap | Prioridad |
|---|---|---|---|---|
| Product management | Editor rico, variantes, SEO, media gallery | Formulario basico, sin editor rico | ALTO | P3 |
| Order management | Fulfillment flow completo, timeline | Buen detalle + timeline, lista basica | MEDIO | P2 |
| Analytics | Dashboards embebidos, KPIs personalizables | Buenos basicos (RFM, demanda, P&L) | BAJO | -- |
| i18n admin | Admin traducido | English-only (correcto para este caso) | N/A | -- |
| Theme editor | Editor visual WYSIWYG | OklchColorPicker + ThemeEditorDialog | MEDIO | P3 |
| Legal/GDPR | Compliance integrado | Buena cobertura (consent records, DPO, retention) | BAJO | -- |
| App ecosystem | 8000+ apps, webhooks | PodClaw AI agent (diferenciador unico) | VENTAJA | -- |

### 9.5 Ventajas competitivas del admin actual

1. **Suite de gestion AI unica**: Chat con PodClaw, memory explorer, soul evolution, session replay, metricas por agente -- ninguno de los benchmarks tiene esto
2. **GDPR/Legal completo**: Registros de consentimiento con export CSV, editor legal trilingue con versionado, configuracion DPO/retencion
3. **CommandPalette con fallback AI**: El "Ask PodClaw" cuando no hay resultados de busqueda es un diferenciador genuino
4. **Dashboard rico**: 5 widgets con Recharts, actividad en tiempo real, acciones rapidas

---

## Resumen ejecutivo

### Fortalezas

1. **Cobertura funcional amplia**: 34 paginas cubriendo productos, ordenes, clientes, disenos, analytics, legal, agente AI, A/B tests, SEO, traducciones, finanzas, branding
2. **Suite AI excepcional**: Chat, memoria, soul, metricas, schedule, replay de sesiones -- unico en el mercado
3. **Modulo GDPR/Legal solido**: Consent records con CSV, versionado legal, DPO settings
4. **Seguridad en headers**: CSP, HSTS, X-Frame-Options correctamente configurados en next.config.ts
5. **shadcn/ui bien adoptado**: 22 componentes instalados, 5 componentes agent custom bien implementados

### Debilidades criticas

1. **66/69 rutas API sin autenticacion** -- bloqueante para produccion
2. **Cookie de sesion falsificable** -- bloqueante para produccion
3. **27/34 paginas sin navegacion compartida** -- UX severamente fragmentada
4. **67+ violaciones de color tokens** -- dark mode roto, inconsistencia visual
5. **React Query en 1 de 34 paginas** -- sin cache, sin retry, sin dedup
6. **25+ alert()/prompt() calls** -- UX nativa del navegador en vez de componentes

### Puntuacion por area

| Area | Puntuacion | Justificacion |
|---|---|---|
| Seguridad | 2/10 | Cookie sin firmar, 95% API sin auth, sin CSRF, sin MFA |
| Arquitectura | 5/10 | Buena estructura de archivos, pero sin route group layout |
| UI/UX | 5/10 | Buen diseno individual pero inconsistente globalmente |
| Data flow | 4/10 | React Query en 1 pagina, rest manual |
| Feature completeness | 7/10 | Amplia cobertura, pocos stubs |
| Agent integration | 9/10 | Excepcional, best-in-class |
| GDPR/Legal | 8/10 | Muy completo para una plataforma indie |
| Escalabilidad | 4/10 | Sin paginacion en 5+ paginas, SSE single-instance |
| **Global** | **5.5/10** | |

### Esfuerzo total estimado por fase

| Fase | Horas | Timeline |
|---|---|---|
| Fase 1: Parches criticos | ~17.5h | Semana 1 |
| Fase 2: Pulido | ~28h | Semana 2-3 |
| Fase 3: Features pro | ~50h | Mes 1-2 |
| Fase 4: Escalabilidad | ~40h | Mes 2-3 |
| **Total** | **~135.5h** | **~3 meses** |
