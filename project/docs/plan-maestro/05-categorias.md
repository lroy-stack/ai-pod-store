# Plan 05 — Sistema de Categorias Relacional

**Prioridad**: P1
**Estimacion**: 25-30h
**Dependencias**: Plan 03 (Database Schema) — requiere auth sync y migration cleanup completados
**Bloquea**: Plan 10 (Growth — landing pages por vertical), Plan 11 (Multi-tenant — categorias por tenant)

---

## 1. Objetivo

Reemplazar el sistema de categorias basado en VARCHAR libre por una arquitectura relacional normalizada con tabla dedicada, FK en productos, API propia, landing pages SEO-ready, navegacion en sidebar, breadcrumbs, y gestion CRUD desde el admin panel. Preparar el schema para jerarquia (parent_id) sin implementar UI de arbol todavia.

## 2. Estado Actual (Validado)

| Area | Score | Evidencia |
|------|-------|-----------|
| Schema de categorias | 1/10 | `products.category VARCHAR(100)` — texto libre, sin FK, sin tabla dedicada |
| Normalizacion | 3/10 | `frontend/src/lib/categories.ts` tiene 18 categorias canonicas con aliases, pero es client-side |
| API de categorias | 0/10 | No existe endpoint `/api/categories`; shop page hace `fetch('/api/products?limit=100')` para derivar categorias |
| Landing pages | 0/10 | No existe `/shop/category/[slug]`; solo `?category=X` como query param (no crawleable) |
| Sidebar | 0/10 | `StorefrontSidebar.tsx` no tiene navegacion por categorias |
| Breadcrumbs | 1/10 | Componente breadcrumb existe pero no integra categorias |
| Admin CRUD | 0/10 | No hay gestion de categorias en el admin panel |
| SEO por categoria | 0/10 | Sin metadata, sin structured data, sin URLs canonicas por categoria |
| i18n de categorias | 4/10 | Traducciones en `messages/{locale}.json` bajo `shop.category.*` (18 keys), pero hardcoded |
| Jerarquia | 0/10 | Sin parent_id, sin subcategorias, estructura plana |

### Datos concretos verificados:

- **18 categorias canonicas** en `frontend/src/lib/categories.ts`: apparel, accessories, drinkware, t-shirts, hoodies, stickers, phone-cases, posters, bags, hats, mugs, wall-art, stationery, sweatshirts, kitchen, kids, games, home-decor
- **Aliases de normalizacion**: 6 variantes adicionales (home & living, home and living, home, home-living, hogar, casa, clothing, ropa, cups)
- **i18n keys**: 18 categorias + "all" + "uncategorized" en `messages/en.json`, `messages/es.json`, `messages/de.json`
- **Footer**: 3 categorias hardcoded (apparel, accessories, home-decor) en `Footer.tsx`
- **Shop page** (`frontend/src/app/[locale]/(app)/shop/page.tsx`): fetch de 100 productos para extraer categorias con conteo O(n)
- **Producto individual**: ruta actual `/shop/[id]`, sin breadcrumb de categoria
- **Index existente**: `idx_products_category_status ON products (category, status)` — sobre VARCHAR

## 3. Gap Estructural

El sistema de categorias fue disenado como campo de texto auxiliar, no como entidad de primer nivel. Las consecuencias:

1. **Sin integridad referencial**: Cualquier string puede escribirse en `products.category`. Printify sync, admin, y chat pueden escribir formatos diferentes ("Home & Living", "home-decor", "Hogar") sin constraint que lo impida.

2. **Normalizacion fragil**: La funcion `normalizeCategory()` en frontend mapea variantes a slugs canonicos, pero solo funciona en el cliente. Si el admin o PodClaw escriben una categoria no mapeada, el sistema no la reconoce.

3. **Fetch O(n) insostenible**: Para mostrar chips de categorias con conteo, la shop page descarga 100 productos y cuenta en JS. Con 1.000+ productos esto es un timeout; con 10.000+ es inaceptable.

4. **Sin SEO**: Las categorias solo existen como query params (`?category=apparel`), no como URLs (`/shop/category/apparel`). Google no puede indexar colecciones, no hay metadata por categoria, no hay structured data ItemList.

5. **Sin navegacion estructurada**: La sidebar — punto principal de navegacion — no ofrece browsing por categorias. El usuario depende de chips en la shop page o del buscador.

6. **Sin gestion administrativa**: Anadir, renombrar, reordenar, o desactivar una categoria requiere editar codigo y desplegar.

## 4. Decision Arquitectonica

### 4.1 Tabla `categories` con i18n por columna (NO tabla de traducciones separada)

**Justificacion**:
- Con 3 locales (en/es/de) y <100 categorias, columnas `name_en`, `name_es`, `name_de` son mas simples y performantes que un JOIN a tabla de traducciones
- Patrón consistente con el resto de la plataforma (product_translations ya usa columnas por locale)
- Si se necesitan mas locales en el futuro, una migracion `ALTER TABLE ADD COLUMN` es trivial
- Evita complejidad de tabla N:M de traducciones que requiere JOINs en cada query

### 4.2 FK simple en products (NO relacion N:M)

**Justificacion**:
- El audit propone `product_categories` (N:M), pero la realidad actual es que cada producto tiene exactamente UNA categoria
- Printify asigna un blueprint type por producto — la relacion es 1:N natural
- Implementar N:M ahora anade complejidad sin caso de uso real
- El schema queda preparado: si se necesita N:M en el futuro, se crea `product_categories` y se migra `category_id` como primary
- Pragmatismo > purismo: resolver el problema actual (VARCHAR libre) con la solucion minima correcta

### 4.3 Landing pages con ruta `/[locale]/shop/category/[slug]` (NO `/shop/[category]`)

**Justificacion**:
- `/shop/[id]` ya existe para productos individuales — `/shop/[category]` colisionaria con el catch-all
- `/shop/category/[slug]` es explicito, no ambiguo, y sigue el patron de Shopify (`/collections/[handle]`)
- Permite futura expansion a `/shop/category/[slug]/[subcategory]` sin refactor

### 4.4 API en frontend (NO en admin ni en PodClaw bridge)

**Justificacion**:
- Las categorias se consumen primariamente en el storefront (sidebar, shop page, landing pages)
- El frontend ya tiene Supabase client configurado con RLS
- El admin consumira la misma API o su propia ruta con service_role para CRUD
- Evita dependencia circular entre servicios

## 5. Plan de Implementacion

### Bloque A: Migracion SQL — Tabla y Seed (5h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| A1 | Crear tabla `categories` con schema completo | `supabase/migrations/20260224000000_create_categories_table.sql` | 1h |
| A2 | Seed: INSERT de 18 categorias existentes con traducciones en/es/de, iconos, sort_order | `supabase/migrations/20260224000001_seed_categories.sql` | 1.5h |
| A3 | ALTER `products`: ADD COLUMN `category_id UUID REFERENCES categories(id)` | `supabase/migrations/20260224000002_add_category_id_to_products.sql` | 30min |
| A4 | Data migration: UPDATE `products` SET `category_id` = match por VARCHAR → slug | `supabase/migrations/20260224000002_add_category_id_to_products.sql` (mismo archivo) | 1h |
| A5 | RLS policies: SELECT publico para categorias activas, ALL para service_role | `supabase/migrations/20260224000000_create_categories_table.sql` (mismo archivo) | 30min |
| A6 | Indices: `idx_categories_slug`, `idx_categories_parent`, `idx_categories_active_order`, `idx_products_category_id` | `supabase/migrations/20260224000000_create_categories_table.sql` (mismo archivo) | 30min |

**Schema de tabla `categories`**:
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name_en VARCHAR(200) NOT NULL,
  name_es VARCHAR(200),
  name_de VARCHAR(200),
  description_en TEXT,
  description_es TEXT,
  description_de TEXT,
  icon VARCHAR(50),              -- Nombre de icono Lucide
  image_url TEXT,                -- Imagen hero de categoria
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',   -- SEO title, SEO description, accent_color, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Nota sobre `metadata JSONB`**: Almacena campos SEO (`seo_title_en`, `seo_description_en`, etc.) y visuales (`accent_color`, `hero_gradient`) como JSON. Evita explosion de columnas para datos que no se consultan con WHERE.

### Bloque B: API de Categorias (4h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| B1 | Crear endpoint `GET /api/categories` con conteo de productos, i18n por locale | `frontend/src/app/api/categories/route.ts` | 1.5h |
| B2 | Crear type definitions para Category | `frontend/src/types/category.ts` | 30min |
| B3 | Crear hook `useCategories()` con SWR/cache | `frontend/src/hooks/useCategories.ts` | 1h |
| B4 | Refactorizar shop page: reemplazar fetch de 100 productos por `useCategories()` | `frontend/src/app/[locale]/(app)/shop/page.tsx` | 1h |

**Query del endpoint**:
```sql
SELECT
  c.id, c.slug, c.parent_id, c.icon, c.image_url, c.sort_order,
  c.name_en, c.name_es, c.name_de,
  c.metadata,
  COUNT(p.id) FILTER (WHERE p.status = 'active') AS product_count
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
WHERE c.is_active = true
GROUP BY c.id
ORDER BY c.sort_order, c.name_en;
```

### Bloque C: Landing Pages por Categoria (6h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| C1 | Crear page component con SSR + `generateMetadata()` | `frontend/src/app/[locale]/(app)/shop/category/[slug]/page.tsx` | 2h |
| C2 | Crear `generateStaticParams()` para pre-render de categorias activas | `frontend/src/app/[locale]/(app)/shop/category/[slug]/page.tsx` (mismo) | 30min |
| C3 | Hero banner con imagen, nombre i18n, descripcion, conteo de productos | `frontend/src/components/storefront/CategoryHero.tsx` | 1h |
| C4 | Grid de productos filtrados por `category_id` con paginacion | `frontend/src/app/[locale]/(app)/shop/category/[slug]/page.tsx` (reusa `ProductGrid`) | 1h |
| C5 | JSON-LD structured data (ItemList + CollectionPage) | `frontend/src/app/[locale]/(app)/shop/category/[slug]/page.tsx` | 30min |
| C6 | Anadir URLs de categorias al sitemap dinamico | `frontend/src/app/sitemap.ts` | 1h |

### Bloque D: Navegacion — Sidebar y Breadcrumbs (4h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| D1 | Agregar seccion "Categorias" colapsable en sidebar con iconos y conteos | `frontend/src/components/storefront/StorefrontSidebar.tsx` | 1.5h |
| D2 | Crear componente Breadcrumb reutilizable para categorias | `frontend/src/components/storefront/CategoryBreadcrumb.tsx` | 1h |
| D3 | Integrar breadcrumbs en landing page de categoria | `frontend/src/app/[locale]/(app)/shop/category/[slug]/page.tsx` | 30min |
| D4 | Integrar breadcrumbs en pagina de producto individual (Home > Categoria > Producto) | `frontend/src/app/[locale]/(app)/shop/[id]/page.tsx` | 30min |
| D5 | Actualizar Footer para generar links de categorias dinamicamente (reemplazar hardcoded) | `frontend/src/components/Footer.tsx` | 30min |

### Bloque E: Admin — CRUD de Categorias (5h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| E1 | Crear pagina de lista de categorias con tabla, ordenacion, toggle activo/inactivo | `admin/src/app/categories/page.tsx` | 1.5h |
| E2 | Crear dialog de crear/editar categoria (nombre i18n, slug, icono, imagen, parent, sort_order, metadata SEO) | `admin/src/app/categories/page.tsx` (dialog inline) | 1.5h |
| E3 | API routes admin: GET/POST/PUT/DELETE categorias con validacion Zod | `admin/src/app/api/categories/route.ts`, `admin/src/app/api/categories/[id]/route.ts` | 1.5h |
| E4 | Agregar link "Categorias" en sidebar del admin | `admin/src/app/layout.tsx` (nav items) | 15min |
| E5 | Actualizar selector de categoria en producto nuevo/editar para usar tabla en vez de texto libre | `admin/src/app/products/new/page.tsx`, `admin/src/app/products/[id]/page.tsx` | 15min |

### Bloque F: Limpieza y Compatibilidad (2h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| F1 | Deprecar `frontend/src/lib/categories.ts` — marcar como legacy, redirigir imports a hook | `frontend/src/lib/categories.ts` | 15min |
| F2 | Actualizar Printify sync para escribir `category_id` en vez de VARCHAR | `frontend/src/lib/printify-sync.ts` | 30min |
| F3 | Actualizar traducciones i18n si hay nuevas keys necesarias (breadcrumbs, landing page) | `frontend/messages/en.json`, `frontend/messages/es.json`, `frontend/messages/de.json` | 30min |
| F4 | Eliminar fetch de 100 productos para categorias — confirmar que no queda ninguna referencia | `frontend/src/app/[locale]/(app)/shop/page.tsx` | 15min |
| F5 | Crear migracion futura (sin ejecutar) que dropea `products.category` VARCHAR despues de validar que `category_id` funciona | `supabase/migrations/20260224100000_drop_category_varchar.sql` (comentado, solo referencia) | 30min |

## 6. Orden de Ejecucion

```
Bloque A (5h) ──→ Bloque B (4h) ──→ Bloque C (6h) ──→ Bloque F (2h)
                       ↓
                  Bloque D (4h)
                       ↓
                  Bloque E (5h)
```

- **A es prerequisito absoluto** — sin tabla `categories` y FK no se puede hacer nada
- **B depende de A** — la API consulta la nueva tabla
- **C y D dependen de B** — landing pages y sidebar consumen la API; son paralelizables entre si
- **E depende de A** — el admin escribe directamente a la tabla; puede ejecutarse en paralelo con C/D
- **F va al final** — limpieza y deprecaciones solo cuando todo lo nuevo funciona

**Camino critico**: A → B → C → F = 17h secuenciales
**Con paralelismo** (C+D en paralelo, E en paralelo con C/D): ~15h elapsed

## 7. Validaciones Tecnicas

| # | Validacion | Criterio de Exito |
|---|-----------|-------------------|
| V1 | Tabla `categories` existe con 18 rows | `SELECT count(*) FROM categories` = 18, todas con `name_en`, `name_es`, `name_de` poblados |
| V2 | FK funciona | `INSERT INTO products (category_id) VALUES ('uuid-inexistente')` → error FK violation |
| V3 | Migracion de datos completa | `SELECT count(*) FROM products WHERE category_id IS NULL AND category IS NOT NULL` = 0 |
| V4 | API retorna categorias con conteo | `GET /api/categories?locale=es` → JSON con 18 categorias, cada una con `product_count` >= 0 |
| V5 | Landing page renderiza | `GET /es/shop/category/apparel` → HTTP 200 con metadata y productos filtrados |
| V6 | Landing page 404 para slug invalido | `GET /en/shop/category/no-existe` → HTTP 404 |
| V7 | Sidebar muestra categorias | Abrir storefront → sidebar tiene seccion "Categorias" con iconos y conteos |
| V8 | Breadcrumbs funcionan | Pagina de producto muestra Home > Apparel > Nombre Producto |
| V9 | Admin CRUD funciona | Crear categoria en admin → aparece en API → aparece en sidebar |
| V10 | SEO metadata correcto | `view-source` de landing page muestra `<title>` y `<meta description>` desde tabla categories |
| V11 | JSON-LD presente | Landing page incluye `<script type="application/ld+json">` con `@type: CollectionPage` |
| V12 | RLS activo | Query con anon key: solo ve categorias con `is_active = true`; no puede INSERT/UPDATE/DELETE |
| V13 | Shop page no hace fetch masivo | Network tab: shop page llama `/api/categories`, NO `/api/products?limit=100` para categorias |
| V14 | Sitemap incluye categorias | `/sitemap.xml` contiene URLs `/en/shop/category/apparel`, `/es/shop/category/apparel`, etc. |

## 8. Validaciones de Negocio

- Un usuario puede navegar por categorias desde la sidebar sin pasar por la pagina de shop
- Un usuario que llega desde Google a `/shop/category/hoodies` ve una pagina dedicada con descripcion, productos, y breadcrumbs — no una pagina generica con filtro
- Un administrador puede crear una nueva categoria desde el panel admin y verla reflejada en el storefront sin tocar codigo ni desplegar
- Las categorias aparecen traducidas segun el locale del usuario (en/es/de)
- El footer muestra categorias dinamicas en vez de las 3 hardcoded
- La pagina de shop carga significativamente mas rapido (ya no descarga 100 productos solo para contar categorias)

## 9. Metricas de Exito

| Metrica | Antes | Despues |
|---------|-------|---------|
| Tabla `categories` dedicada | No existe | 18+ rows con i18n, iconos, metadata |
| FK en productos | VARCHAR libre | `category_id UUID REFERENCES categories(id)` |
| API `/api/categories` | No existe | Endpoint con conteo, i18n, cache-ready |
| Landing pages por categoria | 0 | 18 paginas SSR con SEO metadata |
| Categorias en sidebar | 0 | 18 con iconos y conteo |
| Breadcrumbs con categoria | 0 | En landing pages y paginas de producto |
| Admin CRUD de categorias | No existe | Lista + crear/editar/eliminar/reordenar |
| URLs crawleables por categoria | 0 | 18 x 3 locales = 54 URLs en sitemap |
| Fetch para derivar categorias | 100 productos (O(n)) | 1 query GROUP BY (O(1) con indice) |
| Schema listo para jerarquia | No | `parent_id` presente, sin UI de arbol todavia |

## 10. Estimacion Total

| Bloque | Horas | Paralelizable |
|--------|-------|---------------|
| A — Migracion SQL (tabla + seed + FK + data) | 5h | No (primer paso) |
| B — API de Categorias | 4h | No (depende de A) |
| C — Landing Pages | 6h | Si (con D y E) |
| D — Sidebar y Breadcrumbs | 4h | Si (con C y E) |
| E — Admin CRUD | 5h | Si (con C y D) |
| F — Limpieza y Compatibilidad | 2h | No (ultimo paso) |
| **Total** | **26h** | — |

**Esfuerzo con 2 agentes paralelos**: ~17h elapsed (A → B secuencial, luego C+D+E en paralelo, F al final)

**Riesgo principal**: La migracion de datos (A4) puede encontrar categorias en `products.category` que no matchean ninguno de los 18 slugs canonicos. Mitigacion: el UPDATE usa `normalizeCategory()` como logica SQL (CASE WHEN con aliases), y cualquier valor no reconocido se asigna a una categoria "other" creada como fallback.

---

*Plan derivado de audit-360/03-category-expansion.md validado contra codigo fuente real 2026-02-23. 18 categorias canonicas confirmadas en `frontend/src/lib/categories.ts` y `frontend/messages/en.json`.*
