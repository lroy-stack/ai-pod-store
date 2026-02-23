# Plan 04 — Frontend Ecommerce & Storefront

**Prioridad**: P1
**Estimacion**: 40-50h
**Dependencias**: Ninguna (puede empezar en paralelo con seguridad)
**Bloquea**: SEO indexing, conversion rate, trust del usuario

---

## 1. Objetivo

Convertir el storefront de un MVP funcional a una tienda ecommerce competitiva: SSR para SEO, paginas criticas faltantes, performance optimizada, links funcionales, y UX a la par de Gymshark/Glossier/MVMT.

## 2. Estado Actual (Validado)

| Area | Score | Evidencia |
|------|-------|-----------|
| Homepage SSR | 0/10 | `(landing)/page.tsx` es `'use client'` — sin `generateMetadata`, sin JSON-LD |
| Shop SSR | 0/10 | `(app)/shop/page.tsx` es `'use client'` — sin metadata SSR |
| Product Detail | 8/10 | SSR con `generateMetadata`, JSON-LD, OG tags — correcto |
| Paginas faltantes | 0/10 | `/about`, `/contact`, `/faq`, `/blog`, `/size-guide`, `/shop/category/[slug]` — todas 404 |
| Footer links | 2/10 | 3 links a paginas inexistentes, social media generico (facebook.com, twitter.com) |
| Sitemap | 2/10 | Solo 9 URLs estaticas, sin productos dinamicos |
| Loading states | 4/10 | Solo 4 `loading.tsx` (profile, cart, shop, checkout); faltan orders, wishlist, designs |
| Error boundaries | 1/10 | Solo 1 `error.tsx` global en `[locale]/error.tsx` |
| Performance | 4/10 | Sin Suspense boundaries, sin ISR, MetaballsBackground sin gate mobile |
| Legal pages XSS | 3/10 | 4 paginas usan `ReactMarkdown` raw (privacy, terms, returns, shipping) en vez de `SafeMarkdown` |
| Breadcrumbs | 2/10 | Componente `ui/breadcrumb.tsx` existe pero no se usa en shop pages |
| Profile collision | 3/10 | `(app)/profile/page.tsx` + `[locale]/profile/notifications/page.tsx` (fuera de route group) |

### Inventario actual:
- **30 paginas**, **111 componentes**, **90+ API routes**
- **23 componentes shadcn/ui** instalados
- **3 locales**: en, es, de (next-intl)
- **Chat**: always-mounted con CSS visibility toggle en StorefrontLayout — FUNCIONAL

## 3. Gap Estructural

El frontend fue construido priorizando funcionalidad sobre SEO y conversion. Las dos paginas mas importantes para acquisition (homepage y shop) son 100% client-side, lo que significa que Google ve una pagina vacia antes del hydration. El sitemap no incluye productos individuales, por lo que los crawlers nunca descubren el catalogo. Los links rotos en el footer (3 paginas 404) y las URLs sociales genericas erosionan la confianza del usuario. Las 4 paginas legales usan `ReactMarkdown` sin sanitizar cuando existe `SafeMarkdown` con DOMPurify — riesgo de XSS si el contenido legal en DB es comprometido. La falta de `loading.tsx` y `error.tsx` por ruta genera pantallas en blanco durante navegacion y errores sin recovery.

## 4. Decision Arquitectonica

### Homepage: Refactor a Server Component hibrido (NO rewrite completo)

**Justificacion**:
- Extraer las secciones que no necesitan interactividad (hero text, product showcase, trust signals) a Server Components
- Mantener `MetaballsBackground`, carousel y CTA como Client Components con `'use client'`
- `generateMetadata()` + JSON-LD Organization en el Server Component wrapper
- Estimacion: 6h vs 20h+ de rewrite completo — mismo beneficio SEO

### Shop: Server Component wrapper + Client interactivity

**Justificacion**:
- Wrapper server con `generateMetadata()` que renderiza `<ShopClient />` para filtros/paginacion
- El producto detail (`shop/[id]`) YA es SSR correcto — no tocar
- Anadir ISR con `revalidate: 3600` para caching de 1 hora

### Paginas faltantes: Route group `(focused)` para /about, /contact, /faq

**Justificacion**:
- Estas paginas no necesitan sidebar/header de StorefrontLayout
- Consistente con el patron existente de privacy, terms, returns, shipping
- Server Components puros con `generateMetadata()` — SEO desde dia 1

### Legal pages: Migrar a SafeMarkdown (NO crear nuevo componente)

**Justificacion**:
- `SafeMarkdown` ya existe en `frontend/src/components/common/SafeMarkdown.tsx` con DOMPurify
- Solo requiere cambiar el import en 4 archivos — 30 minutos de trabajo
- Elimina vector XSS sin overhead adicional

## 5. Plan de Implementacion

### Bloque A: SEO Critico — Homepage & Shop SSR (10h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| A1 | Crear server wrapper para homepage con `generateMetadata()` | `frontend/src/app/[locale]/(landing)/page.tsx` → split en `page.tsx` (server) + `LandingClient.tsx` (client) | 3h | SEO-01 |
| A2 | Anadir JSON-LD `Organization` + `WebSite` schema en homepage | `frontend/src/app/[locale]/(landing)/page.tsx` (server part) | 1h | SEO-02 |
| A3 | Crear server wrapper para shop con `generateMetadata()` | `frontend/src/app/[locale]/(app)/shop/page.tsx` → split en `page.tsx` (server) + `ShopClient.tsx` (client) | 3h | SEO-03 |
| A4 | Anadir JSON-LD `ItemList` schema en shop page | `frontend/src/app/[locale]/(app)/shop/page.tsx` (server part) | 1h | SEO-04 |
| A5 | Anadir ISR `revalidate: 3600` en product detail pages | `frontend/src/app/[locale]/(app)/shop/[id]/page.tsx` | 30min | PERF-01 |
| A6 | Gate MetaballsBackground en mobile: deshabilitar canvas en pantallas < 768px o dispositivos sin WebGL | `frontend/src/components/landing/MetaballsBackground.tsx` | 1.5h | PERF-02 |

### Bloque B: Sitemap Dinamico (3h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| B1 | Refactorizar `sitemap.ts` para generar sitemap index con referencia a sitemaps por locale | `frontend/src/app/sitemap.ts` | 1h | SEO-05 |
| B2 | Crear `sitemap-[locale].xml` dinamico que incluya TODOS los productos de Supabase | Nuevo: `frontend/src/app/sitemap-[locale]/route.ts` (o usar `generateSitemaps()` de Next.js) | 1.5h | SEO-06 |
| B3 | Incluir paginas estaticas en sitemaps por locale (/about, /contact, /faq, /privacy, /terms, etc.) | Mismo archivo que B2 | 30min | SEO-07 |

### Bloque C: Paginas Faltantes (8h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| C1 | Crear `/about` — historia de marca, mision, equipo con `generateMetadata()` | Nuevo: `frontend/src/app/[locale]/(focused)/about/page.tsx` | 1.5h | PAGE-01 |
| C2 | Crear `/contact` — formulario de contacto con validacion, info de soporte, mapa | Nuevo: `frontend/src/app/[locale]/(focused)/contact/page.tsx` | 2h | PAGE-02 |
| C3 | Crear `/faq` — Accordion con preguntas frecuentes, busqueda, categorias | Nuevo: `frontend/src/app/[locale]/(focused)/faq/page.tsx` | 1.5h | PAGE-03 |
| C4 | Crear `/blog` — listado de posts placeholder (estructura para futuro CMS) | Nuevo: `frontend/src/app/[locale]/(focused)/blog/page.tsx` | 1h | PAGE-04 |
| C5 | Crear `/size-guide` — guia de tallas standalone con tablas por producto | Nuevo: `frontend/src/app/[locale]/(focused)/size-guide/page.tsx` | 1h | PAGE-05 |
| C6 | Crear `/shop/category/[slug]` — landing page por categoria con `generateMetadata()` dinamico | Nuevo: `frontend/src/app/[locale]/(app)/shop/category/[slug]/page.tsx` | 1h | PAGE-06 |

### Bloque D: Loading States & Error Boundaries (5h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| D1 | Crear `loading.tsx` para orders | Nuevo: `frontend/src/app/[locale]/(app)/orders/loading.tsx` | 30min | UX-01 |
| D2 | Crear `loading.tsx` para wishlist | Nuevo: `frontend/src/app/[locale]/(app)/wishlist/loading.tsx` | 30min | UX-02 |
| D3 | Crear `loading.tsx` para designs | Nuevo: `frontend/src/app/[locale]/(app)/designs/loading.tsx` | 30min | UX-03 |
| D4 | Crear `loading.tsx` para paginas nuevas (about, contact, faq, blog, size-guide) | 5 archivos nuevos en `(focused)/*/loading.tsx` | 30min | UX-04 |
| D5 | Crear `error.tsx` para `(app)` route group | Nuevo: `frontend/src/app/[locale]/(app)/error.tsx` | 30min | UX-05 |
| D6 | Crear `error.tsx` para `(focused)` route group | Nuevo: `frontend/src/app/[locale]/(focused)/error.tsx` | 30min | UX-06 |
| D7 | Crear `error.tsx` para `(landing)` route group | Nuevo: `frontend/src/app/[locale]/(landing)/error.tsx` | 30min | UX-07 |
| D8 | Anadir Suspense boundaries en homepage para streaming de secciones pesadas (carousel, products) | `frontend/src/app/[locale]/(landing)/page.tsx` | 1h | PERF-03 |
| D9 | Anadir Suspense boundaries en shop para streaming de ProductGrid | `frontend/src/app/[locale]/(app)/shop/page.tsx` | 30min | PERF-04 |

### Bloque E: Links Rotos & Navegacion (4h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| E1 | Actualizar social media links en Footer con URLs reales (configurables via env o constantes) | `frontend/src/components/Footer.tsx:67-77` | 30min | LINK-01 |
| E2 | Verificar que links del Footer apuntan a las nuevas paginas creadas en Bloque C | `frontend/src/components/Footer.tsx:112-119` | 15min | LINK-02 |
| E3 | Anadir breadcrumbs en shop page (Home > Shop > [Categoria]) usando componente existente `ui/breadcrumb.tsx` | `frontend/src/app/[locale]/(app)/shop/page.tsx` (o `ShopClient.tsx` post-refactor) | 1h | UX-08 |
| E4 | Anadir breadcrumbs en product detail page (Home > Shop > [Categoria] > [Producto]) | `frontend/src/components/products/ProductDetailClient.tsx` | 1h | UX-09 |
| E5 | Anadir breadcrumbs en category landing page | `frontend/src/app/[locale]/(app)/shop/category/[slug]/page.tsx` | 30min | UX-10 |
| E6 | Anadir links a `/designs`, `/pricing` en StorefrontSidebar si faltan | `frontend/src/components/storefront/StorefrontSidebar.tsx` | 30min | NAV-01 |

### Bloque F: Seguridad Legal Pages + Profile Collision (3h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| F1 | Migrar `/privacy` de `ReactMarkdown` a `SafeMarkdown` | `frontend/src/app/[locale]/(focused)/privacy/page.tsx:4` | 15min | SEC-01 |
| F2 | Migrar `/terms` de `ReactMarkdown` a `SafeMarkdown` | `frontend/src/app/[locale]/(focused)/terms/page.tsx` | 15min | SEC-02 |
| F3 | Migrar `/returns` de `ReactMarkdown` a `SafeMarkdown` | `frontend/src/app/[locale]/(focused)/returns/page.tsx` | 15min | SEC-03 |
| F4 | Migrar `/shipping` de `ReactMarkdown` a `SafeMarkdown` | `frontend/src/app/[locale]/(focused)/shipping/page.tsx` | 15min | SEC-04 |
| F5 | Resolver profile namespace collision: mover `[locale]/profile/notifications/page.tsx` dentro de `(app)/profile/notifications/page.tsx` | `frontend/src/app/[locale]/profile/notifications/page.tsx` → `frontend/src/app/[locale]/(app)/profile/notifications/page.tsx` | 1h | STRUCT-01 |
| F6 | Eliminar directorio huerfano `frontend/src/app/[locale]/profile/` despues de mover | `frontend/src/app/[locale]/profile/` | 15min | STRUCT-02 |
| F7 | Verificar que `<button>` raw en wishlist (linea ~249) use `<Button>` de shadcn | `frontend/src/app/[locale]/(app)/wishlist/page.tsx` o componente delegado | 30min | STRUCT-03 |

### Bloque G: Endpoint de Categorias & Optimizaciones (4h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| G1 | Crear endpoint `/api/categories` dedicado que consulte categorias unicas de Supabase (sin traer 100 productos) | Nuevo: `frontend/src/app/api/categories/route.ts` | 1.5h | PERF-05 |
| G2 | Actualizar shop page para usar `/api/categories` en vez de extraer categorias del fetch de productos | `frontend/src/app/[locale]/(app)/shop/page.tsx` (ShopClient post-refactor) | 1h | PERF-06 |
| G3 | Anadir `Cache-Control` headers al endpoint de categorias (5 min stale-while-revalidate) | `frontend/src/app/api/categories/route.ts` | 30min | PERF-07 |
| G4 | Optimizar next/image loader config para imagenes de Printify (remotePatterns en next.config) | `frontend/next.config.ts` | 30min | PERF-08 |
| G5 | Corregir strings hardcoded en auth callback (usar next-intl) | `frontend/src/app/[locale]/(focused)/auth/callback/page.tsx` | 30min | I18N-01 |

## 6. Orden de Ejecucion

```
Bloque F (3h) ──────────────────────────────────────────→ (quick wins, bajo riesgo)
                                                          ↓
Bloque A (10h) ──→ Bloque B (3h) ──→ Bloque E (4h)      │
                                         ↓                │
Bloque C (8h) ──→ Bloque D (5h) ──→ Bloque G (4h)       │
                                                          ↓
                                                      Validacion
```

- **F primero**: los 4 cambios de ReactMarkdown → SafeMarkdown y el profile fix son cambios minimos con alto impacto de seguridad (30 min total para los 4 imports)
- **A y C en paralelo**: SSR refactor y creacion de paginas no tienen dependencias cruzadas
- **B depende de A**: el sitemap dinamico necesita que las nuevas paginas existan para incluirlas
- **D depende de C**: los loading.tsx de paginas nuevas necesitan que las paginas existan
- **E depende de A y C**: los breadcrumbs van en las paginas refactorizadas/creadas
- **G independiente**: el endpoint de categorias puede hacerse en cualquier momento

## 7. Validaciones Tecnicas

| # | Validacion | Criterio de Exito |
|---|-----------|-------------------|
| V1 | Homepage SSR | `curl -s localhost:3000/en \| grep '<title>'` devuelve titulo real (no vacio) |
| V2 | Homepage JSON-LD | `curl -s localhost:3000/en \| grep 'application/ld+json'` contiene `Organization` |
| V3 | Shop metadata | `curl -s localhost:3000/en/shop \| grep '<meta name="description"'` devuelve descripcion |
| V4 | Sitemap productos | `curl -s localhost:3000/sitemap-en.xml \| grep '/shop/'` lista productos individuales |
| V5 | Paginas no-404 | `curl -s -o /dev/null -w '%{http_code}' localhost:3000/en/about` → 200 (y /contact, /faq, /blog, /size-guide) |
| V6 | Loading states | Navegar a `/orders` con throttle 3G muestra skeleton antes de datos |
| V7 | Error boundaries | Simular error en `(app)` route → muestra error.tsx local, no el global |
| V8 | SafeMarkdown legal | `grep -r 'ReactMarkdown' frontend/src/app/[locale]/(focused)/{privacy,terms,returns,shipping}/` → 0 resultados |
| V9 | Profile collision | `ls frontend/src/app/[locale]/profile/` → directorio no existe |
| V10 | Breadcrumbs shop | Navegar a producto → breadcrumb visible con Home > Shop > Categoria > Producto |
| V11 | MetaballsBackground mobile | Lighthouse mobile en homepage → no hay canvas rendering en viewport < 768px |
| V12 | ISR product pages | Segundo request a `/shop/[id]` en < 50ms (cache hit) |
| V13 | Categories endpoint | `curl localhost:3000/api/categories` → JSON con array de categorias sin traer productos completos |
| V14 | Social links | `grep 'facebook.com/podai' frontend/src/components/Footer.tsx` → URLs reales de la tienda |

## 8. Validaciones de Negocio

- Google puede indexar homepage y shop page sin ejecutar JavaScript (SSR completo)
- Un usuario que llega desde Google ve metadata correcta en SERPs (titulo, descripcion, rich snippets)
- Ningun link del footer devuelve 404 — todas las paginas existen y cargan
- Las paginas legales estan protegidas contra XSS (SafeMarkdown con DOMPurify)
- El sitemap incluye TODOS los productos activos — los crawlers descubren el catalogo completo
- La experiencia en mobile no se degrada por animaciones pesadas (MetaballsBackground desactivado)
- Navegacion entre paginas muestra skeletons inmediatos (no pantalla en blanco)
- Los errores de red muestran UI de recovery (boton de reintentar) en vez de pantalla rota

## 9. Metricas de Exito

| Metrica | Antes | Despues |
|---------|-------|---------|
| Paginas con SSR/metadata | 1 (product detail) | 8+ (homepage, shop, about, contact, faq, blog, size-guide, categories) |
| Links rotos en footer | 3 (/about, /contact, /faq) | 0 |
| Social media URLs funcionales | 0 (genericas) | 3+ (URLs reales de la tienda) |
| Paginas con JSON-LD | 1 (product detail) | 3+ (homepage, shop, product detail) |
| URLs en sitemap | 9 (estaticas) | 9 + N productos + 6 paginas nuevas por locale |
| loading.tsx files | 4 | 12+ |
| error.tsx files | 1 (global) | 4 (global + app + focused + landing) |
| Legal pages con SafeMarkdown | 0/4 | 4/4 |
| Profile namespace collisions | 1 | 0 |
| Lighthouse Performance (mobile) | ~65 (estimado, MetaballsBackground + client-only) | ~85+ (SSR + canvas gate) |
| Lighthouse SEO score | ~70 (sin metadata en homepage/shop) | ~95+ |

## 10. Estimacion Total

| Bloque | Horas | Paralelizable |
|--------|-------|---------------|
| A — SEO Homepage & Shop SSR | 10h | Si (con C, F) |
| B — Sitemap Dinamico | 3h | No (depende de A) |
| C — Paginas Faltantes | 8h | Si (con A, F) |
| D — Loading & Error Boundaries | 5h | Parcial (depende de C) |
| E — Links & Navegacion | 4h | No (depende de A, C) |
| F — Legal XSS & Profile Fix | 3h | Si (con A, C) |
| G — Categorias & Optimizaciones | 4h | Si (independiente) |
| **Total** | **37h** | — |

**Esfuerzo con 2 agentes paralelos**: ~22h elapsed (A+C+F en paralelo fase 1, luego B+D+G fase 2, luego E fase 3)

**Buffer de contingencia** (refactors inesperados en split server/client): +5-8h → **42-45h rango realista**

---

*Plan derivado de audit-360 validado. Hallazgos SEO-01 a SEO-07, PAGE-01 a PAGE-06, PERF-01 a PERF-08, SEC-01 a SEC-04, STRUCT-01 a STRUCT-03 confirmados contra codigo fuente real 2026-02-23.*
