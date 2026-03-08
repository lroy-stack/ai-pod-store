# Plan: Reestructuración Shop Page SKAPARA

**Fecha**: 2026-03-08
**Referencia visual**: `/Users/lr0y/POD-AI-PDR/ui-mocks/shop.PNG`
**Auditorías base**: `02-component-inventory.md`, `05-product-data-layer.md`

---

## Contexto

La página Shop actual tiene dos modos: **Category Landing** (grid de categorías con thumbnails) y **Search Results** (chips de categoría horizontales + grid de productos). El diseño es funcional pero no transmite la identidad streetwear de SKAPARA ni integra el sistema de colecciones/DROPs que acabamos de crear para la landing.

### Estado actual vs Mock

| Aspecto | Actual | Mock (shop.PNG) | Gap |
|---|---|---|---|
| **Hero/Banner** | Ninguno | "DROP 01 — SIGNAL COLLECTION" hero con imagen de producto | FALTA |
| **Filtros de categoría** | Chips horizontales (Button pills) | Sidebar vertical izquierda (All, T-Shirts, Long Sleeves, Caps, Accessories) | REDISEÑAR |
| **Sort** | Select dropdown estándar | "SORT BY: NEWEST" más prominente | AJUSTAR |
| **Product Cards** | Completas: imagen, categoría, rating, título, descripción, precio, botones cart+quickview | Limpias: imagen, título, precio — minimalistas | SIMPLIFICAR vista |
| **Trust Bar** | Solo en landing | 4 badges en footer del shop | REUTILIZAR |
| **Colecciones** | No integrado | `?collection=signal` como contexto de navegación | INTEGRAR |
| **Grid** | auto-fill responsive (neu-grid) | 4 columnas en desktop | OK (compatible) |
| **Breadcrumbs** | Presentes | No visibles en mock | MANTENER (SEO) |

---

## REGLA 0 — RESTRICCIONES INVIOLABLES

1. **NO SE TOCAN** globals.css tokens, store_themes, theme system
2. **NO SE TOCAN** ProductCard internals (neu-card, neu-image, neu-btn-*) — solo se controla qué props recibe
3. **ProductGrid** se mantiene (neu-grid con auto-fill)
4. **Componentes nuevos** usan solo tokens semánticos existentes
5. **SSR/ISR** se mantiene — el shop page es Server Component con revalidate=300
6. **JSON-LD** structured data se mantiene y mejora
7. **El sidebar del StorefrontLayout NO se modifica** — los filtros del shop son un sidebar IN-PAGE separado

---

## Fase 1: Shop Collection Banner (Hero contextual)

### Problema
El mock muestra un hero banner "DROP 01 — SIGNAL COLLECTION" con imagen de producto destacado. La shop page actual no tiene ningún banner. Cuando el usuario navega desde la landing al shop, pierde el contexto de la colección.

### Solución
Nuevo componente `ShopCollectionBanner.tsx` que muestra la colección activa cuando se accede con `?collection={slug}`.

### Nuevo: `components/shop/ShopCollectionBanner.tsx`

```
Props: {
  collectionName: string
  collectionDescription?: string
  productCount: number
  heroImage?: string
  locale: string
}
```

**Layout**:
- Desktop: 2 columnas — copy izquierda (nombre colección, badge "LIMITED EDITION", conteo) + imagen producto derecha
- Mobile: Stack vertical, imagen arriba, copy debajo
- Fondo: `bg-card` con gradiente sutil
- Tipografía: `font-[family-name:var(--font-display)]` para el título (Space Grotesk)
- Motion: `FADE_UP` desde `useMotionConfig`

**Datos**: Se obtienen del mismo `getActiveCampaign()` de `marketing-server.ts` o de una nueva query por collection slug.

### Nuevo: `lib/collections-server.ts`

```typescript
export const getCollectionBySlug = unstable_cache(
  async (slug: string) => {
    const { data } = await supabaseAdmin
      .from('collections')
      .select(`
        id, slug, name, description, status,
        collection_products(
          position, is_featured,
          product:products(id, title, base_price_cents, compare_at_price_cents, currency, images, status, avg_rating, review_count)
        )
      `)
      .eq('slug', slug)
      .eq('status', 'active')
      .single()
    return data
  },
  ['collection-by-slug'],
  { revalidate: 120, tags: ['collection'] }
)
```

### Modificar: `app/[locale]/(app)/shop/page.tsx`

- Detectar `searchParams.collection` → fetch collection data
- Pasar collection data a ShopPageClient como nueva prop
- Filtrar productos por collection_products join si `collection` param presente
- Mantener comportamiento actual cuando NO hay collection param

---

## Fase 2: Filtros de Categoría — Sidebar In-Page

### Problema
El mock muestra un sidebar vertical izquierdo con categorías (All, T-Shirts, Long Sleeves, Caps, Accessories). Actualmente los filtros son chips horizontales encima del grid. El StorefrontLayout ya tiene un sidebar global (StorefrontSidebar), pero ese es de NAVEGACIÓN general, no de filtros de shop.

### Solución
Convertir el layout del ShopPageClient de single-column a 2-column: sidebar de filtros (izquierda) + grid de productos (derecha). En mobile, el sidebar se colapsa en un Sheet drawer o chips horizontales.

### Modificar: `components/shop/ShopPageClient.tsx`

**Cambios estructurales**:

1. **Layout 2-columnas**:
   ```
   <div className="flex gap-6">
     {/* Sidebar — desktop only */}
     <aside className="hidden lg:block w-56 shrink-0 sticky top-20 self-start">
       <ShopFilterSidebar ... />
     </aside>

     {/* Main content */}
     <div className="flex-1 min-w-0">
       {/* Collection banner (conditional) */}
       {collection && <ShopCollectionBanner ... />}

       {/* Toolbar: search + sort */}
       <div className="flex items-center justify-between mb-6">
         <SearchBar />
         <SortSelector />
       </div>

       {/* Product grid */}
       <ProductGrid ... />

       {/* Pagination */}
       <Pagination ... />
     </div>
   </div>
   ```

2. **Mobile**: Sidebar oculto → filtros como Sheet drawer activado por botón "Filters" o como chips horizontales colapsables (patrón actual pero más compacto)

### Nuevo: `components/shop/ShopFilterSidebar.tsx`

```
Props: {
  categories: string[]
  categoryCounts: Record<string, number>
  selectedCategory: string
  onCategoryChange: (category: string) => void
  subcategories?: SubcategoryData[]
  selectedSubcategory?: string
  onSubcategoryChange?: (slug: string | undefined) => void
  t: (key: string) => string
}
```

**Layout**:
- Título "Categories" en `text-xs uppercase tracking-widest text-muted-foreground`
- Lista vertical de categorías como `<button>` con:
  - Estilo inactivo: `text-sm text-muted-foreground hover:text-foreground`
  - Estilo activo: `text-sm font-semibold text-foreground` con indicator izquierdo (border-l-2 border-primary)
  - Conteo a la derecha en `text-muted-foreground/60`
- Subcategorías indentadas debajo de la categoría padre cuando está expandida
- Separador después de categorías
- Posible sección "Price Range" (futuro — no en mock, no implementar ahora)

**Mobile fallback**: El `ShopPageClient` muestra un `<Sheet>` con `ShopFilterSidebar` dentro, activado por un botón `<Button variant="outline" size="sm">` con icono `SlidersHorizontal`.

---

## Fase 3: Toolbar Mejorado (Search + Sort + View Toggle)

### Problema
El search bar actual es demasiado prominente (max-w-2xl, ocupa toda la sección). El mock muestra una barra de herramientas más compacta con sort prominente.

### Solución
Compactar el toolbar en una sola fila: resultados count + sort dropdown. El search queda en el header global (ya existe en StorefrontHeader) o como barra compacta.

### Modificar: `components/shop/ShopPageClient.tsx` — Sección toolbar

**Antes** (actual):
```
[Título h1 + subtítulo + conteo]
[Search bar full-width]
[Category chips | Sort dropdown]
```

**Después** (mock):
```
[Collection Banner (si hay collection)]
[Search bar compacto (solo en search mode) | Results count | Sort]
[Product Grid]
```

**Cambios**:
- El `h1` pasa a ser más compacto: `text-2xl sm:text-3xl` (era `text-4xl`)
- Si hay collection, el título lo proporciona el banner, no el h1 genérico
- Search bar visible solo en search mode o expandible via icono
- Sort selector más prominente: label "SORT BY:" en uppercase tracking-widest
- Conteo de resultados inline con el sort

---

## Fase 4: Category Landing → Collection-Aware

### Problema
La Category Landing actual (`ShopCategoryLanding.tsx`) muestra un grid de tarjetas de categoría con thumbnails. El mock no muestra esta vista — va directo a productos. Sin embargo, la Category Landing es útil cuando no hay contexto de búsqueda/colección.

### Solución
Mantener la Category Landing pero mejorarla:

1. **Si hay `?collection=` param**: Skip category landing, ir directo a producto grid filtrado por colección
2. **Si NO hay params**: Mostrar Category Landing mejorada con:
   - Collection banner del DROP activo (reutilizar `ShopCollectionBanner`)
   - Grid de categorías debajo
   - "Recently Viewed" (ya existe, mantener)

### Modificar: `app/[locale]/(app)/shop/page.tsx`

Agregar tercer modo: **Collection Mode**

```
if (collectionSlug) → Collection Mode (banner + productos filtrados)
else if (!isSearchMode) → Category Landing (actual)
else → Search Results (actual)
```

**Collection Mode** data flow:
1. `getCollectionBySlug(collectionSlug)` → collection data
2. Extract product IDs from `collection_products`
3. Fetch full product data + variants for esos IDs
4. Sort by collection_products.position
5. Pass to ShopPageClient con `collectionBanner` prop

---

## Fase 5: Trust Bar en Shop Page

### Problema
El mock muestra 4 trust badges en el footer del shop: "WORLDWIDE SHIPPING", "14-DAY RETURNS", "LIMITED STOCK", "SECURE CHECKOUT". Actualmente `TrustBar` solo está en la landing.

### Solución
Reutilizar `components/landing/TrustBar.tsx` en la shop page. Mover a `components/shared/TrustBar.tsx` o simplemente importar desde landing.

### Modificar: `components/shop/ShopPageClient.tsx`

Agregar `<TrustBar />` después de la paginación, con un `<Separator>` encima.

**Alternativa**: Si no queremos mover TrustBar, crear un import alias. Pero la recomendación es mover a `components/shared/` ya que se usa en 2+ páginas.

### Mover: `components/landing/TrustBar.tsx` → `components/shared/TrustBar.tsx`

Actualizar imports en:
- `components/landing/LandingPageClient.tsx`
- `components/shop/ShopPageClient.tsx` (nuevo)

---

## Fase 6: Animaciones & Polish

### Problema
La shop page actual no tiene animaciones de entrada. El mock implica una experiencia más premium.

### Solución
Agregar animaciones sutiles usando los variants existentes de `useMotionConfig.ts`.

### Cambios:
1. **Collection Banner**: `FADE_UP` en viewport
2. **Product Grid**: `STAGGER_CONTAINER` + `STAGGER_ITEM` en viewport (wrapping ProductGrid)
3. **Filter sidebar**: Transición suave al cambiar categoría
4. **Page transitions**: Skeleton loading durante fetch (ya existe via `isLoading`)

**NO agregar**:
- Animaciones en cada ProductCard individual (ya tienen hover transform)
- Parallax (no es streetwear, es SaaS)
- Infinite scroll (mantener paginación explícita — mejor para SEO y UX)

---

## Resumen de Archivos

### Nuevos (3)
| # | Archivo | Responsabilidad |
|---|---------|-----------------|
| 1 | `components/shop/ShopCollectionBanner.tsx` | Hero banner colección en shop |
| 2 | `components/shop/ShopFilterSidebar.tsx` | Sidebar vertical de filtros |
| 3 | `lib/collections-server.ts` | getCollectionBySlug() con cache |

### Modificados (4)
| # | Archivo | Cambio |
|---|---------|--------|
| 4 | `app/[locale]/(app)/shop/page.tsx` | Agregar Collection Mode, fetch collection data |
| 5 | `components/shop/ShopPageClient.tsx` | Layout 2-col, integrar sidebar + banner + trust bar |
| 6 | `components/landing/TrustBar.tsx` → `components/shared/TrustBar.tsx` | Mover a shared |
| 7 | `components/landing/LandingPageClient.tsx` | Actualizar import de TrustBar |

### Intocables (explícito)
| Componente | Razón |
|---|---|
| `ProductCard.tsx` | Neumorphic design intacto — solo se controla qué datos recibe |
| `ProductGrid.tsx` | neu-grid auto-fill — funciona perfecto |
| `CategoryCard.tsx` | Usado en Category Landing mode, no tocado |
| `CategoryGrid.tsx` | Wrapper de CategoryCard, no tocado |
| `ShopCategoryLanding.tsx` | Mantener para non-collection/non-search mode |
| `StorefrontSidebar.tsx` | Sidebar global de navegación — NO es el sidebar de filtros |
| `StorefrontLayout.tsx` | Shell wrapper — NO tocado |
| globals.css | Tokens intactos |

---

## Orden de Implementación

```
Fase 1: ShopCollectionBanner + collections-server.ts
  ↓
Fase 2: ShopFilterSidebar + layout 2-col en ShopPageClient
  ↓
Fase 3: Toolbar compacto (search + sort)
  ↓
Fase 4: Collection Mode en shop/page.tsx (SSR)
  ↓
Fase 5: TrustBar → shared + integrar en shop
  ↓
Fase 6: Animaciones (FADE_UP, STAGGER)
```

Fases 1-4 son el core. Fases 5-6 son polish.

---

## Decisiones Tomadas

| Pregunta | Decisin | Razn |
|---|---|---|
| Sidebar filtros: global vs in-page? | **In-page** (dentro de ShopPageClient) | El StorefrontSidebar global tiene navegacin (chat, shop, orders), no filtros de shop. Mock muestra sidebar de filtros dentro del rea de shop |
| Category Landing: eliminar? | **Mantener** como modo sin params | til cuando el usuario entra a /shop sin contexto. El mock muestra productos directamente porque tiene collection context |
| Infinite scroll vs paginacin? | **Paginacin** (mantener actual) | Mejor para SEO (cada pgina indexable), UX predictible, ya implementado |
| ProductCard: simplificar? | **No tocar** | Las cards neumorphic son parte del diseo system. El mock es un wireframe — las cards reales tienen ms funcionalidad y eso est bien |
| Search: quitar del shop? | **Mantener** pero compactar | El search es til. En collection mode queda ms sutil. En search mode es protagonista |
| Collection filter: URL param o ruta? | **URL param** `?collection=slug` | Reutiliza ruta /shop existente, evita nueva ruta, compatible con el flow landing→shop |
| TrustBar: copiar vs mover? | **Mover** a shared/ | DRY — se usa en landing + shop. Un solo componente mantenido |
| Price range filter | **No implementar ahora** | No est en el mock, se puede agregar despus como enhancement |

---

## Verificacin Post-Implementacin

1. **URL `/shop`** (sin params): Muestra Category Landing con grid de categoras
2. **URL `/shop?collection=drop-01-signal`**: Muestra Collection Banner + productos de la coleccin
3. **URL `/shop?q=hoodie`**: Muestra Search Results con search bar prominente
4. **URL `/shop?category=t-shirts`**: Muestra sidebar con categora seleccionada + grid filtrado
5. **Sidebar responsive**: Visible en `lg:`, Sheet drawer en mobile
6. **Sort funcional**: Cambia orden de productos sin reload
7. **TrustBar**: Visible en bottom de todos los modos
8. **ISR**: revalidate=300 sigue funcionando
9. **JSON-LD**: CollectionPage schema cuando hay collection, ItemList cuando hay productos
10. **SEO**: Breadcrumbs, meta tags, canonical URLs — todo funcional
11. **Theme**: Cambiar theme → shop page respeta tokens
12. **i18n**: /en/shop, /es/shop, /de/shop — todo traducido
13. **Performance**: LCP < 2.5s, collection banner image con `priority`
14. **Animations**: FADE_UP en banner, STAGGER en grid — respeta `prefers-reduced-motion`
