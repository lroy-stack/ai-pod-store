# 05 — Capa de Datos de Productos y API

Documento generado: 2026-03-08
Base path: `frontend/src/`

---

## 1. API Routes de Productos

### 1.1 `GET /api/products` — Listado principal

**Archivo**: `app/api/products/route.ts`
**Auth**: No requiere autenticacion (usa `supabaseAdmin` para bypass RLS).
**Multi-tenant**: Lee header `x-tenant-id` del middleware; si esta presente, filtra `tenant_id`.

#### Query Parameters

| Parametro     | Tipo    | Default | Descripcion                                      |
|---------------|---------|---------|--------------------------------------------------|
| `page`        | number  | 1       | Numero de pagina                                 |
| `limit`       | number  | 10      | Items por pagina                                 |
| `locale`      | string  | `en`    | Locale para traducciones (en/es/de)              |
| `category`    | string  | —       | Slug de categoria; `all` = sin filtro            |
| `q` / `search`| string  | —       | Query de busqueda (activa hybrid search)         |
| `sort`        | string  | newest  | `price-asc`, `price-desc`, `rating`, `popular`, `newest`, `priceLowToHigh`, `priceHighToLow`, `topRated` |
| `newArrivals` | boolean | false   | Filtra productos creados en los ultimos 14 dias  |
| `ids`         | string  | —       | IDs separados por coma (fast-path, max 50)       |

#### Modos de busqueda

1. **Fast-path por IDs** (`?ids=uuid1,uuid2`): Lookup directo sin paginacion ni busqueda. Usado por guest wishlist.
2. **Hybrid Search** (cuando `q` tiene valor): Combina vector search (Gemini embeddings 768-dim via `search_documents` RPC) + keyword search (ILIKE) mediante Reciprocal Rank Fusion (RRF, k=60). Fallback a full-text search (wfts) si GEMINI_API_KEY no esta configurada.
3. **Traditional query** (sin `q`): Query directo a tabla `products` con filtros de categoria, sort y paginacion via `.range()`.

#### Categoria resolution

La funcion `resolveCategoryIds(slug)` resuelve slugs a `category_id(s)`. Para categorias padre, incluye el ID del padre + todos los hijos activos. Esto permite que filtrar por "apparel" devuelva tambien "t-shirts", "hoodies", etc.

#### Response shape

```json
{
  "success": true,
  "total": 42,
  "page": 1,
  "limit": 10,
  "totalPages": 5,
  "items": [
    {
      "id": "uuid",
      "title": "Product Title",
      "description": "...",
      "price": 29.99,
      "maxPrice": 34.99,
      "hasVariantPricing": true,
      "compareAtPrice": 39.99,
      "currency": "EUR",
      "image": "https://...",
      "images": ["https://..."],
      "rating": 4.5,
      "reviewCount": 12,
      "category": "t-shirts",
      "tags": ["meme", "tech"],
      "inStock": true,
      "createdAt": "2026-01-15T...",
      "labels": ["trending", "bestseller"],
      "variants": {
        "sizes": ["S", "M", "L", "XL"],
        "colors": ["Black", "White"],
        "colorImages": { "Black": "https://...", "White": "https://..." }
      }
    }
  ],
  "locale": "en"
}
```

**Campos condicionales**:
- `maxPrice`, `hasVariantPricing`: Solo presentes si las variantes tienen precios diferentes.
- `compareAtPrice`: Solo presente si existe `compare_at_price_cents` en la DB.
- `labels`: Solo presente en el traditional query (no en hybrid search).
- En hybrid search, se incluyen ademas: `searchMethod`, `query`, `vectorResults`, `keywordResults`, `combinedResults`, y por item: `vectorRank`, `keywordRank`, `vectorSimilarity`.

#### Batch operations internas

- `fetchVariantsByProductId(ids[])`: Consulta `product_variants` filtrando `is_enabled=true` y `is_available=true`. Agrupa por product_id y devuelve sizes (ordenados via `sortSizes`), colors, colorImages (primer `image_url` por color), y rango de precios.
- `fetchLabelsByProductId(ids[])`: Consulta `product_labels` y agrupa `label_type` por product_id.
- `applyTranslations(product, locale)`: Si locale != 'en', busca en campo JSONB `translations[locale]` para `title` y `description`.

### 1.2 `POST /api/products` — Crear producto

**Auth**: No requiere auth de usuario; usa `x-tenant-id` header para tenant context.
**Plan gate**: Si `tenantId` presente, ejecuta `checkPlanGate(tenantId, 'products')`. Devuelve 402 si el plan no permite mas productos.

Body: `{ title, description, base_price, currency, category, tags, status }`
Response: `{ success: true, product: { id, title, status, created_at } }`

### 1.3 `GET /api/products/[id]` — Detalle de producto

**Archivo**: `app/api/products/[id]/route.ts`

Fetcha en paralelo:
1. Producto completo (`select('*')`, incluyendo `categories(slug)`)
2. Variantes habilitadas y disponibles (para UI)
3. Todas las variantes habilitadas (para calcular `unavailableCombinations`)
4. Product labels

#### Response shape (dentro de `product`)

```json
{
  "id": "uuid",
  "title": "...",
  "description": "...",
  "price": 29.99,
  "maxPrice": 34.99,
  "hasVariantPricing": true,
  "compareAtPrice": 39.99,
  "currency": "EUR",
  "image": "https://...",
  "images": ["https://...", "https://..."],
  "rating": 4.5,
  "reviewCount": 12,
  "category": "t-shirts",
  "tags": [],
  "inStock": true,
  "providerProductId": "printful_12345",
  "createdAt": "...",
  "materials": "100% Organic Cotton",
  "careInstructions": "Machine wash cold",
  "printTechnique": "DTG",
  "manufacturingCountry": "Latvia",
  "brand": "SKAPARA",
  "safetyInformation": "<html>GPSR info</html>",
  "finish": "Glossy",
  "labels": ["trending"],
  "variants": {
    "sizes": ["S", "M", "L"],
    "colors": ["Black", "White"],
    "allColors": ["Black", "White", "Heather Grey"],
    "allSizes": ["S", "M", "L", "XL", "2XL"],
    "colorImageIndices": { "Black": [0, 1], "White": [2, 3] },
    "sizeImageIndices": { "11oz": [0], "15oz": [1] },
    "unavailableCombinations": [{ "color": "Heather Grey", "size": "2XL" }],
    "prices": [{ "size": "S", "color": "Black", "price": 29.99 }]
  }
}
```

**Diferencias clave respecto al listado**:
- `images` es un array completo (no solo el primero). El `branded_hero_url` se prepone si existe.
- `allColors` / `allSizes` incluyen variantes habilitadas pero no disponibles (para mostrar como tachadas).
- `colorImageIndices` / `sizeImageIndices` mapean color/size a indices de `images[]`, permitiendo galeria filtrada.
- `unavailableCombinations` permite cross-filter (si seleccionas "Black", deshabilita tallas sin stock en "Black").
- `prices` incluye el detalle de precio por combinacion (solo si hay variant pricing).
- Campos GPSR: `materials`, `careInstructions`, `printTechnique`, `manufacturingCountry`, `brand`, `safetyInformation`, `finish`.

**Image mapping strategies** (funcion `buildImageMap`):
1. Match `external_variant_id` dentro de la URL de imagen (patron `/.../pvid/...`).
2. Fallback: match `image_url` de la variante + match de alt text con patron `"Title - Color"`.

### 1.4 `GET /api/products/[id]/cross-sell` — Productos relacionados

**Archivo**: `app/api/products/[id]/cross-sell/route.ts`

Devuelve hasta 4 productos recomendados. Primero busca en la tabla `association_rules` (co-purchase data, ordenado por `lift` descendente). Si no hay reglas, fallback a misma categoria.

Response: `{ items: [{ id, title, description, price, currency, image, rating, reviewCount, category }] }`

### 1.5 `GET /api/products/[id]/social-proof` — Social proof

**Archivo**: `app/api/products/[id]/social-proof/route.ts`

Lee tabla `product_daily_metrics` para obtener `viewsToday` y `ordersThisWeek`. Incluye flag `sellingFast: true` si hay mas de 5 pedidos en la semana.

Response: `{ viewsToday: 23, ordersThisWeek: 8, sellingFast: true }`

### 1.6 `GET /api/products/trending` — Productos trending

**Archivo**: `app/api/products/trending/route.ts`

Lee materialized view `trending_products` que agrega `product_daily_metrics` (7 dias) con `weighted_score`. Fallback a `review_count` desc si la view falla.

Query param: `limit` (default 12, max 50).
Response: `{ items: [...], source: "trending" | "fallback" | "error" }`

---

## 2. Tipos TypeScript

**Archivo**: `types/product.ts`

Jerarquia de 3 niveles alineada con las respuestas de la API:

### ProductBase (Tier 1 — minimo)
Usado en landing cards, wishlist items.
```ts
interface ProductBase {
  id: string
  title: string
  price: number
  currency: string
  image: string | null
}
```

### ProductCard (Tier 2 — listado)
Extiende `ProductBase`. Usado por ProductCard, ProductGrid, ShopPageClient, QuickViewModal, ProductGridArtifact, LandingPageClient.
```ts
interface ProductCard extends ProductBase {
  description: string
  rating?: number
  reviewCount?: number
  category?: string
  inStock?: boolean
  stock?: number
  createdAt?: string
  compareAtPrice?: number
  maxPrice?: number
  hasVariantPricing?: boolean
  labels?: string[]
  variants?: {
    sizes?: string[]
    colors?: string[]
    colorImages?: Record<string, string>
  }
}
```

### ProductDetail (Tier 3 — detalle completo)
Extiende `ProductCard` (con override de `variants`). Usado por DetailPanel, ProductDetailClient, ArtifactContent.
```ts
interface ProductDetail extends Omit<ProductCard, 'variants'> {
  images: string[]
  materials?: string | null
  careInstructions?: string | null
  printTechnique?: string | null
  manufacturingCountry?: string | null
  brand?: string | null
  safetyInformation?: string | null
  finish?: string | null
  variants?: {
    sizes?: string[]
    colors?: string[]
    allColors?: string[]
    allSizes?: string[]
    colorImages?: Record<string, string>
    colorImageIndices?: Record<string, number[]>
    sizeImageIndices?: Record<string, number[]>
    unavailableCombinations?: Array<{ color: string; size: string }>
    prices?: Array<{ size: string; color: string; price: number }>
  }
}
```

### VariantSelection
```ts
interface VariantSelection {
  size?: string
  color?: string
}
```

### Tipos locales duplicados

Varias paginas definen su propia interfaz `Product` localmente en lugar de importar de `types/product.ts`:
- `app/[locale]/(app)/shop/page.tsx` — define `Product` con `base_price_cents`, `images: Array<{src, alt}>`, `categories: {slug}`
- `app/[locale]/(app)/shop/category/[slug]/page.tsx` — misma interfaz local
- `app/[locale]/(landing)/page.tsx` — interfaz minima con `compare_at_price_cents`
- `app/[locale]/(app)/wishlist/page.tsx` — interfaz local `Product` y `WishlistItem`

Estos son tipos de la **shape de la DB** (antes de transformar a formato frontend), no duplicados del tipo `ProductCard`.

---

## 3. Carga de Productos por Pagina

### 3.1 Landing Page (`/[locale]`)

**Server Component**: `app/[locale]/(landing)/page.tsx`
**Fetching**: SSR directo con `supabaseAdmin`. Carga en paralelo:
- 12 productos activos (orden estacional: rating en invierno, created_at resto del ano)
- 6 reviews aprobadas filtradas por locale
- Count total de ordenes pagadas
- Promedio de rating global

**Client Component**: `components/landing/LandingPageClient.tsx`
- Recibe `initialProducts` (shape simplificada: id, title, price, compareAtPrice, currency, rating, image)
- Renderiza carousel con embla-carousel-autoplay (4.5s delay, loop)
- Usa `formatPrice()` con locale para mostrar precios

**ISR**: No configurado explicitamente (render on-demand).

### 3.2 Shop Page (`/[locale]/shop`)

**Server Component**: `app/[locale]/(app)/shop/page.tsx`
**Dos modos**:

1. **Category Landing** (sin query `q`): Carga arbol de categorias via `getCategoryTree(locale)` (cached en Redis). Muestra `ShopCategoryLanding` con grid de categorias, cada una con `previewImages` (3 imagenes de productos top-rated).

2. **Search Results** (con query `q`): Ejecuta query directa con ILIKE, filtra por categoria/sort, primera pagina de 20 items. Pasa datos a `ShopPageClient`.

**ISR**: `revalidate = 300` (5 minutos).

**Client Component**: `components/shop/ShopPageClient.tsx`
- Recibe `initialProducts`, `initialTotal`, `initialCategories`, `initialCategoryCounts`.
- Skip del primer fetch (SSR ya provee datos) via `isInitialMount` ref.
- Client-side fetch posterior via `GET /api/products` cuando cambian filtros.
- Paginacion con 20 items por pagina.
- Debounce de 300ms en el input de busqueda.
- Category chips colapsables (muestra primeros 6, boton "+N" para expandir).
- Sort options: featured, priceLowToHigh, priceHighToLow, newest, topRated.

### 3.3 Category Page (`/[locale]/shop/category/[slug]`)

**Server Component**: `app/[locale]/(app)/shop/category/[slug]/page.tsx`
**ISR**: `revalidate = 600` (10 minutos).
**Static generation**: `generateStaticParams()` pre-renders todas las categorias activas x 3 locales.

Valida que el slug exista en DB. Detecta si es categoria padre o hijo:
- **Padre**: Carga hijos y muestra subcategory chips con conteo. Soporta `?sub=slug` para filtrar subcategoria.
- **Hijo**: Muestra breadcrumb con padre.

Pasa datos a `ShopPageClient` con props adicionales: `subcategories`, `selectedSubcategory`, `parentCategorySlug`, `categoryTitle`.

### 3.4 Product Detail Page (`/[locale]/shop/[id]`)

**Server Component**: `app/[locale]/(app)/shop/[id]/page.tsx`
**ISR**: `revalidate = 3600` (1 hora).
**Static generation**: Pre-renders top 50 productos x 3 locales.

Usa `lib/product-detail-cache.ts` que implementa caching en dos capas:
1. **Redis** (cross-request): `getCachedProductDetail(id)` / `setCachedProductDetail(id, data)`
2. **React.cache** (same-request dedup): Evita queries duplicadas dentro del mismo render.

Carga en paralelo:
- `getProduct(id)` — producto completo con variantes
- `getRelatedProducts(id)` — via association_rules o fallback a misma categoria
- `getProductReviews(id)` — 10 reviews mas recientes

**Client Component**: `components/products/ProductDetailClient.tsx`
- Recibe `product: ProductDetail`, `relatedProducts`, `reviews`.
- Galeria con embla-carousel (swipeable) + thumbnails en desktop.
- Selectores de color (image thumbnails) y talla (botones).
- Cross-filtering: seleccionar un color deshabilita tallas no disponibles y viceversa.
- Per-variant pricing con lookup `Map<"size::color", price>`.
- URL param `?color=` para pre-seleccion desde ProductCard.
- URL param `?compositionId=` para custom designs.
- Dual CTA: "Add to Cart" + "Buy Now" (Add to Cart + redirect a checkout).
- Sticky CTA en mobile via `SmartStickyCTA`.
- Recently viewed products (via `useRecentlyViewed` hook, localStorage).
- Social proof indicator (async fetch a `/api/products/[id]/social-proof`).
- Collapsible sections: Description, Specifications (materials, care, print technique, country), GPSR Safety Info.

---

## 4. Categorias

### Modelo de datos

Tabla `categories` con campos:
- `id` (UUID), `slug`, `parent_id` (nullable — para jerarquia), `name_en`, `name_es`, `name_de`, `icon`, `image_url`, `sort_order`, `is_active`

### Jerarquia

Dos niveles: padre -> hijos. Ejemplo: "Apparel" (padre) -> "T-Shirts", "Hoodies", "Crewnecks" (hijos).

### Navegacion

- **Shop root**: Muestra solo categorias padre con `totalProductCount` (propios + hijos) y 3 `previewImages`.
- **Categoria padre**: Muestra subcategory chips con conteo individual. Filtra por `?sub=slug`.
- **Categoria hijo**: Muestra solo sus productos, breadcrumb incluye padre.

### Colecciones / Drops

No existe un concepto separado de "colecciones" o "drops". El filtro `newArrivals=true` (ultimos 14 dias en API, 30 dias en shop SSR) funciona como pseudo-drop. Las etiquetas en `product_labels` (`trending`, `bestseller`) proveen badges visuales pero no son navegables como colecciones.

---

## 5. Imagenes de Producto

### Origen

Las imagenes se almacenan en el campo JSONB `products.images` como array de objetos:
```json
[
  { "src": "https://files.cdn.printful.com/files/.../1200x1200.jpg", "alt": "Title - Color" },
  ...
]
```

Provienen de Printful CDN (`files.cdn.printful.com`), sincronizadas por el cron `printify-sync.ts` (`syncProductFromPrintify`).

### branded_hero_url

Campo separado `products.branded_hero_url`. Si existe, se usa como imagen principal (se prepone al array de images). Es una imagen hero con branding SKAPARA, distinta de las mockups de Printful.

### Variant images

Campo `product_variants.image_url`: URL de la imagen especifica de cada variante (color). Usado para:
- `colorImages` en la card del listado (primer `image_url` por color).
- `colorImageIndices` / `sizeImageIndices` en el detalle (mapping color/talla -> indices del array `images[]`).

### Formatos y tamanos

Las imagenes de Printful CDN vienen tipicamente en 1200x1200 px. No hay transformacion de imagen server-side. Se usan los `sizes` prop de Next.js `<Image>` para hint al browser:
- ProductCard: `"(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"`
- Landing carousel: `"(max-width: 768px) 80vw, (max-width: 1024px) 50vw, 33vw"`
- PDP main: `"(max-width: 1024px) 100vw, 50vw"`
- PDP thumbs: `"(max-width: 1024px) 25vw, 12.5vw"`

---

## 6. Variantes

### Modelo de datos

Tabla `product_variants`:
- `product_id`, `size`, `color`, `price_cents`, `is_enabled`, `is_available`, `external_variant_id`, `image_url`, `title`

Dos flags: `is_enabled` (activa en Printful) y `is_available` (en stock). El detalle PDP muestra variantes enabled pero no available como deshabilitadas (tachadas).

### ProductCard (Listado)

- `colorImages`: Record<string, string> — primera `image_url` por color. Se usan como swatches visuales en la card.
- Los swatches son botones circulares de 36x36px con la imagen de la variante. Click o hover cambia la imagen principal.
- El ProductCard enlaza a `/[locale]/shop/[id]?color=SelectedColor` para pre-seleccion.
- Sizes no se muestran en la card; si hay multiples variantes (size o color), el boton "Add to Cart" abre el detalle para seleccion.

### ProductDetailClient (PDP)

- **Color selector**: Grid de thumbnails (56x56px mobile, 64x64px desktop) con imagen real del producto en ese color. Si no hay imagen, muestra cuadro gris con 3 letras del color.
- **Size selector**: Botones con el nombre de la talla. Se muestra SizeGuide para categorias de ropa.
- **Cross-filtering**: `unavailableCombinations` es un array de `{color, size}` no disponibles. Se filtran reactivamente:
  - `availableSizesForColor`: tallas disponibles para el color seleccionado.
  - `availableColorsForSize`: colores disponibles para la talla seleccionada.
  - Auto-reset: si la seleccion actual se vuelve no disponible, se selecciona automaticamente la primera disponible.
- **Per-variant pricing**: Lookup map `"size::color" -> price`. Si todos los precios son iguales, se muestra un solo precio. Si difieren, se muestra "from X.XX" en la card y el precio exacto en el PDP segun la combinacion seleccionada.

### Sorting de tallas

`lib/size-order.ts` exporta `sortSizes()` que ordena tallas en orden logico (XS, S, M, L, XL, 2XL... y formatos numericos como 11oz, 15oz).

---

## 7. Precios

### Moneda

- Almacenamiento: `base_price_cents` (enteros en centimos) + `currency` (string, tipicamente "eur").
- Todas las tiendas EU usan EUR. La config esta en `lib/store-config.ts`:
  - `LOCALE_CURRENCY`: `{ en: 'EUR', es: 'EUR', de: 'EUR' }`
  - `LOCALE_FORMAT`: `{ en: 'en-IE', es: 'es-ES', de: 'de-DE' }`

### Formateo

`lib/currency.ts`:
- `formatPrice(price, locale, currency?)`: Usa `Intl.NumberFormat` con el locale de formato correspondiente.
- `getLocalizedPrice(basePrice, baseCurrency, locale)`: Convierte el precio a la moneda del locale (actualmente todas EUR, por lo que es identity transform).
- `convertPrice(price, from, to)`: Conversion simplificada con rates hardcoded: `{ EUR: 1.0, USD: 1.09, GBP: 0.86 }`. Placeholder para futura integracion con API de tasas de cambio.

### Transformacion DB -> Frontend

En la API: `price = base_price_cents / 100`. En el PDP, el precio se recalcula reactivamente segun la combinacion de variante seleccionada.

### Descuentos

- `compare_at_price_cents` en la DB -> `compareAtPrice` en el frontend.
- Si existe `compareAtPrice`, se muestra precio tachado + badge con porcentaje de descuento (`-XX%`).
- Componente `StrikethroughPrice` en PDP para el precio de referencia.
- El descuento se calcula como: `Math.round(((compareAtPrice - price) / compareAtPrice) * 100)`.

### Cupones

No hay sistema de cupones visible en las rutas de productos. Los cupones, si existen, se aplican en el checkout (Stripe).

---

## 8. Wishlist

### Hook: `hooks/useWishlist.tsx`

Context provider `WishlistProvider` con dos modos:

#### Guest mode (no autenticado)
- Almacena `product_id[]` en `localStorage` bajo key `pod-guest-wishlist`.
- Maximo 50 items (`GUEST_MAX_ITEMS`).
- Shape: `GuestWishlistItem = { product_id: string, added_at: string }`.

#### Authenticated mode
- Fetch via `GET /api/wishlist` que devuelve wishlists con items.
- Toggle: busca en `serverItems`, si existe hace `DELETE /api/wishlist/items?item_id=X`, si no existe primero get-or-create default wishlist, luego `POST /api/wishlist/items`.
- Optimistic updates en remove (rollback on error).

#### Sync guest -> server
Al hacer login (`user` cambia de null a valor), `syncGuestWishlistToServer(items)` via `POST /api/wishlist/sync`. Si tiene exito, borra localStorage.

### Interfaz publica

```ts
interface WishlistContextType {
  wishlistItems: string[]       // product_ids
  loading: boolean
  isWishlisted: (productId: string) => boolean
  toggleWishlist: (productId: string) => Promise<void>
  refreshWishlist: () => Promise<void>
  guestItemCount: number
}
```

### API routes de wishlist

| Ruta | Metodos | Descripcion |
|------|---------|-------------|
| `/api/wishlist` | GET, POST, PATCH, DELETE | CRUD de wishlists |
| `/api/wishlist/items` | POST, DELETE | Add/remove items de una wishlist |
| `/api/wishlist/sync` | POST | Sync guest wishlist al servidor |
| `/api/wishlist/share` | POST | Generar share token para wishlist publica |
| `/api/wishlist/shared/[token]` | GET | Acceder a wishlist compartida |

### Wishlist Page (`/[locale]/wishlist`)

**Archivo**: `app/[locale]/(app)/wishlist/page.tsx`

Client component con dos vistas:

- **Guest**: Fetch productos por IDs via `/api/products?ids=...`. Muestra `ProductGrid` + banner para registro.
- **Auth**: Carga wishlists completas del servidor. Cada wishlist muestra ProductGrid, con acciones: rename, delete, share (genera URL con token), add all to cart.

Existe tambien `/[locale]/wishlist/shared/[token]` para wishlists compartidas.

### Donde se muestra

- **ProductCard**: Boton corazon (top-right de la imagen).
- **ProductDetailClient**: Boton corazon al lado del titulo (desktop) o en la fila de dot indicators (mobile).
- **Wishlist page**: Grid completo de productos guardados.

---

## 9. Reviews

### Componentes

#### ReviewForm (`components/products/ReviewForm.tsx`)
- Formulario con rating (1-5 estrellas), comentario (min 10 chars), y hasta 3 fotos (max 5MB cada una).
- Upload de fotos via `POST /api/reviews/upload-photos` (FormData).
- Submit via `POST /api/reviews` con `{ productId, rating, comment, imageUrls }`.
- Se muestra en PDP debajo de la seccion de reviews existentes, toggle con boton "Write Review".

#### Reviews en PDP (`ProductDetailClient`)
- Las reviews se cargan server-side via `getProductReviews(id)` (10 mas recientes de `product_reviews` tabla).
- Cada review muestra: autor ("Verified Buyer"), rating (estrellas), fecha localizada, badge "Verified Purchase" si `is_verified_purchase`, y comentario.
- Agregados: rating promedio (estrellas) + conteo total (`product.reviewCount`).

### API routes de reviews

| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/reviews` | POST | Submit review (requiere auth) |
| `/api/reviews/upload-photos` | POST | Upload fotos para review |

### Reviews en Landing Page

La landing page carga 6 reviews aprobadas filtradas por locale (`moderation_status = 'approved'`, `locale = locale`) y las pasa al componente `Testimonials`. Incluye join con tabla `users` para obtener nombre real.

### Datos agregados en producto

Campos `avg_rating` y `review_count` en tabla `products` (pre-calculados o mantenidos via trigger/cron).

---

## 10. Productos Relacionados / Cross-Sell

### PDP — Related Products

Cargados server-side via `getRelatedProducts(id)` en `lib/product-detail-cache.ts`:

1. **Association rules** (primary): Tabla `association_rules` con co-purchase data. Busca reglas donde `antecedents` contiene el product ID. Ordena por `lift` desc. Toma hasta 4 consequent IDs.
2. **Same category** (fallback): Si no hay association rules, busca productos de la misma categoria (hasta 4).

Resultado cacheado en Redis via `setCachedRelatedProducts(id, data)`.

Se muestra en el PDP bajo "Customers Also Bought" con `ProductCard` grid.

### Cart Cross-Sell

Componente `components/cart/CartCrossSell.tsx`:
- Recibe `productId` del primer item del carrito.
- Fetch client-side via `GET /api/products/[id]/cross-sell`.
- Muestra hasta 4 productos en grid 2x2 (mobile) / 4 cols (desktop).
- Non-critical: falla silenciosamente si el fetch no funciona.

### Recently Viewed

Hook `useRecentlyViewed` (localStorage). ProductDetailClient trackea cada vista y muestra hasta 4 productos "Recently Viewed" al final del PDP.

---

## Apendice A: Mapa de Archivos

| Archivo | Rol |
|---------|-----|
| `app/api/products/route.ts` | API listado + creacion |
| `app/api/products/[id]/route.ts` | API detalle |
| `app/api/products/[id]/cross-sell/route.ts` | API cross-sell |
| `app/api/products/[id]/social-proof/route.ts` | API social proof |
| `app/api/products/trending/route.ts` | API trending |
| `app/api/wishlist/route.ts` | API wishlist CRUD |
| `app/api/wishlist/items/route.ts` | API wishlist items |
| `app/api/wishlist/sync/route.ts` | API sync guest->server |
| `app/api/wishlist/share/route.ts` | API share wishlist |
| `app/api/reviews/route.ts` | API submit review |
| `app/api/reviews/upload-photos/route.ts` | API upload review photos |
| `types/product.ts` | ProductBase, ProductCard, ProductDetail, VariantSelection |
| `lib/product-detail-cache.ts` | getProduct, getProductReviews, getRelatedProducts (Redis + React.cache) |
| `lib/currency.ts` | formatPrice, getLocalizedPrice, convertPrice |
| `lib/store-config.ts` | BRAND, STORE_DEFAULTS, LOCALE_CURRENCY, LOCALE_FORMAT |
| `lib/size-order.ts` | sortSizes() |
| `lib/query-sanitizer.ts` | sanitizeForLike, sanitizeForPostgrest |
| `hooks/useWishlist.tsx` | WishlistProvider + useWishlist hook |
| `hooks/useCart.tsx` | CartProvider + useCart hook |
| `hooks/useRecentlyViewed.ts` | localStorage recently viewed |
| `components/products/ProductCard.tsx` | Card de producto (listado) |
| `components/products/ProductDetailClient.tsx` | PDP completo |
| `components/products/ProductGrid.tsx` | Grid responsive de ProductCards |
| `components/products/ReviewForm.tsx` | Formulario de review |
| `components/products/SizeGuide.tsx` | Guia de tallas |
| `components/products/SmartStickyCTA.tsx` | CTA sticky en mobile |
| `components/products/SocialProofIndicator.tsx` | Badge de social proof |
| `components/products/StrikethroughPrice.tsx` | Precio tachado + descuento |
| `components/products/ProductBadge.tsx` | Labels (trending, bestseller) |
| `components/products/QuickViewModal.tsx` | Quick view desde la card |
| `components/shop/ShopPageClient.tsx` | Client component de shop (filtros, paginacion) |
| `components/shop/ShopCategoryLanding.tsx` | Category grid landing |
| `components/shop/CategoryGrid.tsx` | Grid de tarjetas de categoria |
| `components/cart/CartCrossSell.tsx` | Cross-sell en carrito |
| `components/landing/LandingPageClient.tsx` | Landing page client |
| `app/[locale]/(landing)/page.tsx` | Landing page server |
| `app/[locale]/(app)/shop/page.tsx` | Shop page server |
| `app/[locale]/(app)/shop/[id]/page.tsx` | PDP server |
| `app/[locale]/(app)/shop/category/[slug]/page.tsx` | Category page server |
| `app/[locale]/(app)/wishlist/page.tsx` | Wishlist page |

## Apendice B: Tablas de Base de Datos Involucradas

| Tabla | Rol |
|-------|-----|
| `products` | Productos principales (title, description, base_price_cents, currency, images, branded_hero_url, category_id, tags, status, avg_rating, review_count, translations, product_details, compare_at_price_cents, provider_product_id, tenant_id, deleted_at) |
| `product_variants` | Variantes (product_id, size, color, price_cents, is_enabled, is_available, external_variant_id, image_url, title) |
| `product_labels` | Labels tipo badge (product_id, label_type: trending/bestseller/etc) |
| `categories` | Categorias jerarquicas (id, slug, parent_id, name_en/es/de, icon, image_url, sort_order, is_active) |
| `product_reviews` | Reviews de productos (product_id, user_id, rating, title, body, is_verified_purchase, moderation_status, locale) |
| `product_daily_metrics` | Metricas diarias (product_id, metric_date, views, orders) |
| `trending_products` | Materialized view (id, title, avg_rating, views_7d, orders_7d, weighted_score) |
| `association_rules` | Co-purchase rules (antecedents[], consequents[], confidence, lift) |
| `wishlists` | Wishlists de usuario (id, user_id, name, is_public, share_token) |
| `wishlist_items` | Items de wishlist (id, wishlist_id, product_id, variant_id) |
| `documents` | Embeddings para vector search (source_type='product', source_id, embedding vector(768)) |
