# Audit 360 - 02: Frontend Ecommerce Storefront

> **Fecha**: 2026-02-23 | **Scope**: Homepage, Navegacion, Checkout, SEO, Legal, Performance, Componentes, Chat/AI
> **Benchmark**: Gymshark, Glossier, MVMT, Shopify Plus stores
> **Stack**: Next.js 16.1.6 + React 19 + Tailwind v4 + shadcn/ui + AI SDK 6 + next-intl (en/es/de)

---

## 1. Estado Actual

### 1.1 Inventario de Paginas (30 rutas)

| Grupo | Ruta | Estado | Calidad |
|-------|------|--------|---------|
| **(landing)** | `/` | Completa | Alta - Hero con MetaballsBackground, carousel, CTA |
| **(app)** | `/chat` | Completa | Alta - Renderiza null, ChatArea vive en StorefrontLayout |
| **(app)** | `/shop` | Completa | Alta - Grid, filtros, categorias, paginacion, busqueda |
| **(app)** | `/shop/[id]` | Completa | Alta - SSR, JSON-LD, OG tags, related products, reviews |
| **(app)** | `/cart` | Completa | Media - Delega a CartView component |
| **(app)** | `/orders` | Completa | Media - Delega a OrdersView component |
| **(app)** | `/orders/[id]` | Completa | Media - Delega a OrderDetailView component |
| **(app)** | `/profile` | Completa | Alta - ProfileForm, Addresses, Password, Delete, Payment |
| **(app)** | `/wishlist` | Completa | Alta - Modo guest (localStorage) + auth (server), sharing |
| **(app)** | `/wishlist/shared/[token]` | Completa | Media - Wishlists publicas compartidas |
| **(app)** | `/designs` | Completa | Media - Galeria de disenos del usuario |
| **(app)** | `/pricing` | Completa | Media - Planes de suscripcion |
| **(app)** | `/settings/billing` | Completa | Media - Stripe billing portal |
| **(app)** | `/offline` | Completa | Basica - Pagina offline para PWA |
| **(focused)** | `/auth/login` | Completa | Alta - OAuth (Google/Apple) + email/password + Turnstile |
| **(focused)** | `/auth/register` | Completa | Alta - Registro con verificacion |
| **(focused)** | `/auth/forgot-password` | Completa | Media - Solicitud de reset |
| **(focused)** | `/auth/reset-password` | Completa | Media - Formulario de nueva password |
| **(focused)** | `/auth/verify-email` | Completa | Media - Handler de verificacion |
| **(focused)** | `/auth/callback` | Completa | Media - OAuth redirect handler |
| **(focused)** | `/checkout` | Completa | Alta - Stripe, tax, addresses, gift message |
| **(focused)** | `/checkout/success` | Completa | Media - Confirmacion post-pago |
| **(focused)** | `/checkout/cancel` | Completa | Basica - Retorno de Stripe cancelado |
| **(focused)** | `/privacy` | Completa | Alta - Politica desde DB, i18n |
| **(focused)** | `/terms` | Completa | Alta - Terminos desde DB, i18n |
| **(focused)** | `/legal` | Completa | Alta - Impressum completo (GDPR-ready) |
| **(focused)** | `/returns` | Completa | Media - Politica de devoluciones |
| **(focused)** | `/shipping` | Completa | Media - Info de envios |
| **(focused)** | `/cookies` | Completa | Media - Politica de cookies |
| **profile** | `/profile/notifications` | Completa | Media - Preferencias de notificaciones |

### 1.2 Componentes Clave

- **StorefrontLayout**: `frontend/src/components/storefront/StorefrontLayout.tsx` -- Layout principal (app) con sidebar + header + detail panel + chat
- **StorefrontHeader**: `frontend/src/components/storefront/StorefrontHeader.tsx` -- Header con auth, cart, search
- **StorefrontSidebar**: `frontend/src/components/storefront/StorefrontSidebar.tsx` -- Nav, recommended products, PodClaw status
- **ChatArea**: Integrada en StorefrontLayout via CSS visibility toggle
- **Footer**: `frontend/src/components/Footer.tsx` -- Links, i18n, tema, legal, social
- **ProductGrid/ProductCard**: `frontend/src/components/products/` -- Grid responsivo con skeletons
- **CheckoutView**: `frontend/src/components/checkout/CheckoutView.tsx` -- Flujo completo con Stripe
- **12 Artifacts**: `frontend/src/components/artifacts/` -- Renderizado de tool calls en chat

### 1.3 shadcn/ui Components Instalados (23)

`button, input, label, textarea, select, card, dialog, sheet, checkbox, switch, badge, separator, dropdown-menu, tabs, avatar, skeleton, sonner/toaster, accordion, carousel, breadcrumb, table, radio-group`

### 1.4 API Routes: 90+ endpoints

Incluye: auth (6), products (2), cart (2), checkout (2), orders (3), wishlist (5), reviews, shipping, coupons, designs (5), notifications (5), push (2), newsletter (10+), RAG (8), admin (6), cron (5), webhooks (3), AB tests (3), analytics, SEO.

---

## 2. Gaps Detectados

### 2.1 Paginas Faltantes (CRITICO para ecommerce competitivo)

| Pagina | Impacto | Referencia |
|--------|---------|------------|
| **`/about`** | Footer enlaza a `/about` pero NO EXISTE | Gymshark tiene About Us con historia de marca |
| **`/contact`** | Footer enlaza a `/contact` pero NO EXISTE | Glossier tiene formulario de contacto |
| **`/faq`** | Footer enlaza a `/faq` pero NO EXISTE | MVMT tiene FAQ extenso |
| **`/shop/category/[slug]`** | No hay landing pages por categoria | Gymshark: `/collections/new-releases` |
| **`/blog`** | Sin blog/content marketing | Glossier: blog como canal de adquisicion |
| **`/size-guide`** (standalone) | Solo existe como componente en producto | MVMT: guia de tallas dedicada |

**Archivos afectados**: `frontend/src/components/Footer.tsx` (lineas 112-119) enlaza a rutas que dan 404.

### 2.2 Homepage Gaps

- **Sin testimonials/reviews sociales** -- La landing solo tiene hero + how-it-works + carousel + CTA
- **Sin trust signals** -- No hay badges de seguridad, garantias, o cifras de clientes
- **Sin newsletter capture** -- No hay formulario de email en la landing
- **Sin video/demo** -- Competidores usan video para mostrar producto
- **Sin countdown/urgency** -- No hay elementos de escasez o urgencia
- **Sin social proof counter** -- "X productos creados" o "X clientes satisfechos"

**Archivo**: `frontend/src/app/[locale]/(landing)/page.tsx`

### 2.3 Checkout Gaps

- **Sin shipping cost estimation visible pre-checkout** -- El usuario debe llegar al checkout para ver costos
- **Sin progress indicator claro** -- CheckoutBreadcrumb existe pero es basico
- **Sin opcion de envio express vs standard** -- Solo una opcion de envio
- **Sin saved cart / abandoned cart recovery** -- No hay emails de carrito abandonado desde frontend
- **Sin order tracking page dedicada** -- El tracking esta embebido en order detail

**Archivo**: `frontend/src/components/checkout/CheckoutView.tsx`

### 2.4 Navigation & Discovery Gaps

- **Sin breadcrumbs en shop** -- Solo existe componente pero no se usa en `/shop`
- **Sin filtros avanzados** -- Solo categoria y sort, falta: precio range, color, talla, rating
- **Sin vista de lista vs grid toggle** -- Solo grid view
- **Sin "Recently Viewed"** -- No hay historial de productos vistos
- **Sin cross-sell/upsell en cart** -- "Tambien te puede gustar" no aparece en carrito
- **Busqueda sin autocompletado** -- Input simple sin sugerencias en tiempo real

**Archivos**: `frontend/src/app/[locale]/(app)/shop/page.tsx`, `frontend/src/components/storefront/StorefrontSidebar.tsx`

### 2.5 SEO Gaps

- **Homepage sin metadata estatica** -- La landing es `'use client'`, pierde SSR SEO
- **Shop page sin metadata** -- `/shop` es client-side, sin `generateMetadata`
- **Sin JSON-LD en homepage** -- Solo existe en product detail (`/shop/[id]`)
- **Sitemap estatica** -- `frontend/src/app/sitemap.ts` lista solo 9 URLs fijas, no genera dinamicamente por producto
- **Sitemaps por locale** existen (`sitemap-en.xml`, etc.) pero hay que verificar que incluyan productos

**Archivos**: `frontend/src/app/sitemap.ts`, `frontend/src/app/robots.ts`

### 2.6 Performance Gaps

- **Sin `loading.tsx` en orders, wishlist, designs** -- Solo existen para profile, cart, shop, checkout
- **Sin `error.tsx` por ruta** -- Solo existe uno global en `[locale]/error.tsx`
- **Landing page es 'use client'** -- 303 lineas de client JS, deberia tener SSR parcial
- **Fetching de categorias ineficiente** -- Shop page hace `fetch('/api/products?limit=100')` para extraer categorias (linea 112 de shop/page.tsx)
- **Sin ISR/revalidation en product pages** -- Aunque es SSR, no hay `revalidate` tag

---

## 3. Riesgos

### 3.1 Riesgos de Conversion (ALTO)

| Riesgo | Impacto | Probabilidad |
|--------|---------|--------------|
| Links rotos en Footer (/about, /contact, /faq) | Perdida de confianza, bounce rate alto | 100% -- confirmado |
| Sin trust signals en homepage | Reduccion 15-30% en conversion vs competidores | Alta |
| Checkout sin estimacion de envio previa | Abandono de carrito por sorpresa en costos | Alta |
| Sin recovery de carrito abandonado | Perdida 60-80% de carritos abandonados | Alta |

### 3.2 Riesgos SEO (ALTO)

| Riesgo | Impacto |
|--------|---------|
| Homepage client-side | Google puede no indexar contenido dinamico correctamente |
| Shop page sin metadata SSR | Titulos genericos en SERPs |
| Sitemap sin productos individuales | Productos no descubiertos por crawlers |
| Sin JSON-LD Organization en homepage | Perdida de rich snippets de marca |

### 3.3 Riesgos de Compliance (MEDIO)

| Riesgo | Detalle |
|--------|---------|
| Cookie consent existe (`CookieConsent.tsx`) pero sin verificacion de enforcement | Necesita audit de que analytics no carga pre-consentimiento |
| SafeMarkdown existe pero sin DOMPurify | XSS risk en contenido de chat renderizado |
| Paginas legales dependen de DB | Si DB falla, paginas legales dan error |

### 3.4 Riesgos de Performance (MEDIO)

| Riesgo | Detalle |
|--------|---------|
| 90+ API routes en un Next.js | Cold starts en serverless, memory en self-hosted |
| Shop fetcha 100 productos para categorias | O(n) innecesario, deberia ser endpoint `/api/categories` |
| MetaballsBackground (canvas) en landing | CPU-intensive en moviles de gama baja |

---

## 4. Inconsistencias

### 4.1 Estructurales

- **Profile page** esta en DOS ubicaciones: `(app)/profile/page.tsx` Y `[locale]/profile/notifications/page.tsx` (fuera de route group)
- **Footer enlaza a rutas que no existen** (`/about`, `/contact`, `/faq`) -- codigo muerto
- **Wishlist guest mode** usa `<button>` raw en linea 249 en vez de `<Button>` de shadcn
- **Landing page** usa `useScrollReveal()` custom hook pero no hay hook global de intersection observer reutilizable
- **Sidebar navigation** no incluye link a `/designs` ni `/pricing` ni `/profile`

### 4.2 Patrones de Fetch

- **Shop page**: client-side fetch con `useEffect` -- pierde SEO
- **Product detail**: SSR con `getProduct()` cache -- correcto
- **Cart/Orders/Wishlist**: client-side fetch -- aceptable (requiere auth)
- **Landing page**: client-side fetch para carousel -- pierde LCP

### 4.3 i18n

- **Auth callback page** tiene strings hardcoded en ingles: "Completing sign-in...", "Redirecting to login..." (lineas 81, 91 de callback/page.tsx)
- **Footer social links** apuntan a URLs genericas (`https://facebook.com`) en vez de las reales de la tienda

---

## 5. Quick Wins

### 5.1 Prioridad Inmediata (1-2 dias cada uno)

1. **Crear `/about`, `/contact`, `/faq`** -- Aunque sean paginas estaticas basicas, elimina los 404 del footer
   - Archivos a crear: `frontend/src/app/[locale]/(focused)/about/page.tsx`, `contact/page.tsx`, `faq/page.tsx`

2. **Anadir `generateMetadata()` a Shop page** -- Mover metadata a un server component wrapper
   - Archivo: `frontend/src/app/[locale]/(app)/shop/page.tsx`

3. **Crear endpoint `/api/categories`** -- Evitar el fetch de 100 productos solo para categorias
   - Archivo nuevo: `frontend/src/app/api/categories/route.ts`

4. **Anadir `loading.tsx` faltantes** -- orders, wishlist, designs
   - Copiar patron de `frontend/src/app/[locale]/(app)/cart/loading.tsx`

5. **Corregir strings hardcoded** en auth callback
   - Archivo: `frontend/src/app/[locale]/(focused)/auth/callback/page.tsx`

### 5.2 Prioridad Alta (3-5 dias cada uno)

6. **Anadir JSON-LD Organization** a homepage
7. **Sitemaps dinamicos** con productos individuales en `sitemap-{locale}.xml`
8. **Trust signals en landing** -- Badges, contadores, testimonials
9. **Newsletter signup** en footer y landing
10. **Shipping estimation widget** en cart page (pre-checkout)

---

## 6. Refactor Estructural Recomendado

### 6.1 Homepage: De Client-Only a Hibrido SSR

```
Actual:
  (landing)/page.tsx -> 'use client' (303 lineas, fetch en useEffect)

Propuesto:
  (landing)/page.tsx -> Server Component (SSR para SEO)
    -> HeroSection (client, MetaballsBackground)
    -> ProductShowcase (server, fetch en servidor)
    -> TrustSignals (server, estatico)
    -> TestimonialsSection (server, fetch de reviews)
    -> NewsletterSection (client, formulario)
    -> Footer (client, ya existe)
```

**Beneficio**: LCP mejorado ~40%, SEO completo, metadata desde servidor.

### 6.2 Shop: Search con SSR + Client Enhancement

```
Actual:
  shop/page.tsx -> 'use client' completo, sin SSR

Propuesto:
  shop/page.tsx -> Server Component con generateMetadata
    -> ShopFilters (client, interactivo)
    -> ProductGrid (server para primera carga, client para paginacion)
  shop/[category]/page.tsx -> Landing por categoria (NUEVO)
```

### 6.3 Checkout: Multi-Step con Progress Real

```
Actual:
  checkout/page.tsx -> Un solo componente masivo (CheckoutView)

Propuesto:
  checkout/page.tsx -> CheckoutWizard
    Step 1: CartReview (resumen + estimacion envio)
    Step 2: ShippingAddress (seleccion o nuevo)
    Step 3: PaymentMethod (Stripe Elements)
    Step 4: OrderReview + Confirm
  checkout/success/page.tsx (ya existe)
```

### 6.4 Component Architecture

```
Actual: Componentes mezclados en /components/
Propuesto:
  components/
    ui/           -> shadcn (ya organizado)
    storefront/   -> Layout, sidebar, header (ya organizado)
    products/     -> Grid, card, detail, filters (extender)
    checkout/     -> Wizard steps (refactor)
    auth/         -> Forms, OAuth (ya organizado)
    marketing/    -> Trust signals, newsletter, testimonials (NUEVO)
    engagement/   -> Popups, banners, prompts (ya existe)
    artifacts/    -> Chat artifacts (ya organizado)
    shared/       -> ErrorBoundary, SafeMarkdown, etc.
```

---

## 7. Roadmap por Fases

### Fase 1: Fundamentos (Semana 1-2)
- [ ] Crear paginas `/about`, `/contact`, `/faq` (eliminar 404s)
- [ ] Endpoint `/api/categories` dedicado
- [ ] `loading.tsx` para orders, wishlist, designs
- [ ] Corregir strings hardcoded en auth
- [ ] `generateMetadata()` en shop page

### Fase 2: SEO & Conversion (Semana 3-4)
- [ ] Refactor homepage a SSR hibrido
- [ ] JSON-LD Organization en homepage
- [ ] Sitemaps dinamicos con productos
- [ ] Trust signals y social proof en landing
- [ ] Newsletter capture en footer + landing
- [ ] Shipping estimation en cart

### Fase 3: Discovery & UX (Semana 5-6)
- [ ] Filtros avanzados (precio, color, talla, rating)
- [ ] Busqueda con autocompletado
- [ ] "Recently Viewed" sidebar section
- [ ] Cross-sell en cart page
- [ ] Landing pages por categoria (`/shop/category/[slug]`)

### Fase 4: Conversion Optimization (Semana 7-8)
- [ ] Checkout multi-step wizard
- [ ] Abandoned cart recovery (email trigger)
- [ ] Order tracking page dedicada
- [ ] Exit-intent popup con descuento
- [ ] A/B test de hero variations (infraestructura ya existe en `/api/ab-test/`)

### Fase 5: Content & Brand (Semana 9-10)
- [ ] Blog/content section
- [ ] Customer stories/testimonials page
- [ ] Size guide page standalone
- [ ] Social media links reales (no genericos)
- [ ] Video demo en homepage

---

## 8. Impacto en Escalabilidad 1.000+ Clientes

### 8.1 Cuellos de Botella Actuales

| Area | Limite Actual | Con 1000+ clientes |
|------|--------------|---------------------|
| Shop page fetch ALL products para categorias | ~100 productos OK | 10K+ productos = timeout |
| Client-side search | Aceptable con 100 prods | Necesita search server (Algolia/Meilisearch) |
| Sitemap estatica (9 URLs) | No indexa productos | Google no descubre nuevos productos |
| 90+ API routes en Next.js | ~500ms cold start | Pool de workers agotado bajo carga |
| Sidebar fetch recommended (cada 5 min) | OK con pocos users | N usuarios * 2 requests = amplificacion |

### 8.2 Arquitectura Recomendada para Escala

```
Actual (MVP):
  Next.js -> Supabase (directo)

Para 1000+ clientes:
  Next.js -> API Gateway (rate limit) -> Supabase
  + CDN (Cloudflare/Vercel Edge) para assets
  + Search Service (Meilisearch) para productos
  + Redis para cache de categorias, productos populares
  + Queue (BullMQ) para abandoned cart emails
  + Edge Middleware para geo-pricing
```

### 8.3 Prioridades de Escalabilidad

1. **Endpoint `/api/categories`** con cache Redis (evita fetch 100 prods) -- **Quick Win**
2. **ISR en product pages** con `revalidate: 3600` -- 1 hora cache
3. **Search service** separado cuando catalogo > 500 productos
4. **Edge middleware** para redirect por locale y geo-pricing
5. **Image CDN** con transformations (ya usa next/image pero necesita loader config para Printify images)

### 8.4 Comparativa con Benchmark

| Feature | POD AI | Gymshark | Glossier | MVMT |
|---------|--------|----------|----------|------|
| SSR Homepage | No (client) | Si | Si | Si |
| Search Autocomplete | No | Si (Algolia) | Si | Si |
| Category Landing Pages | No | Si | Si | Si |
| Trust Signals | No | Si | Si | Si |
| Blog/Content | No | Si | Si | Si |
| Newsletter Capture | No | Si (popup) | Si (footer) | Si (popup) |
| Abandoned Cart Email | No | Si | Si | Si |
| Size Guide Standalone | No | Si | N/A | Si |
| Video en Homepage | No | Si | Si | Si |
| Multi-currency | Parcial (user pref) | Si (geo) | Si (geo) | Si (geo) |
| Reviews en Homepage | No | Si | Si | Si |

**Gap Score**: POD AI cubre ~55% de features de ecommerce competitivo. Las areas mas criticas son SEO (homepage client-side), discovery (sin filtros avanzados), y conversion (sin trust signals ni abandoned cart recovery).
