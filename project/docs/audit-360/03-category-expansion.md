# Audit 360 - 03: Sistema de Categorias y Expansion

> **Fecha**: 2026-02-23 | **Scope**: Arquitectura de categorias, expansion modular, landing pages, identidad visual por vertical
> **Stack**: Supabase (PostgreSQL) + Next.js 16 + Printify API + PodClaw agents
> **Objetivo**: Evaluar capacidad de expandir de "Print-on-Demand generico" a multiples verticales

---

## 1. Estado Actual

### 1.1 Esquema de Base de Datos

La tabla `products` en Supabase tiene una sola columna de categoria:

```sql
-- supabase/migrations/20260213000000_initial_schema.sql (linea 56)
category VARCHAR(100),
```

**No existe tabla `categories` dedicada.** La categoria es un campo de texto libre en cada producto, sin FK, sin jerarquia, sin metadata.

Index existente:
```sql
-- linea 378
CREATE INDEX idx_products_category_status ON products (category, status);
```

### 1.2 Normalizacion de Categorias (Frontend)

El archivo `frontend/src/lib/categories.ts` implementa normalizacion client-side:

```typescript
const CATEGORY_ALIASES: Record<string, string> = {
  'home & living': 'home-decor',
  'clothing': 'apparel',
  'mugs': 'mugs',
  'cups': 'drinkware',
  'apparel': 'apparel',
  'accessories': 'accessories',
  'drinkware': 'drinkware',
  't-shirts': 't-shirts',
  'hoodies': 'hoodies',
  'stickers': 'stickers',
  'phone-cases': 'phone-cases',
  'posters': 'posters',
  'bags': 'bags',
  'hats': 'hats',
  'wall-art': 'wall-art',
  'stationery': 'stationery',
  'sweatshirts': 'sweatshirts',
  'kitchen': 'kitchen',
  'kids': 'kids',
  'games': 'games',
  'home-decor': 'home-decor',
}
```

**17 categorias canonicas** definidas: apparel, accessories, drinkware, t-shirts, hoodies, stickers, phone-cases, posters, bags, hats, wall-art, stationery, sweatshirts, kitchen, kids, games, home-decor, mugs.

### 1.3 UI de Categorias en Shop

**Archivo**: `frontend/src/app/[locale]/(app)/shop/page.tsx`

El sistema actual:
1. Hace `fetch('/api/products?limit=100')` para obtener TODOS los productos
2. Extrae categorias contando ocurrencias en JS del cliente
3. Muestra chips de categoria con conteo
4. Filtra via query param `?category=apparel`
5. Collapse de categorias: muestra primeras 6, boton "+N" para el resto

```typescript
// linea 109-129 de shop/page.tsx
async function fetchCategories() {
  const res = await fetch(`/api/products?limit=100&locale=${locale}`)
  const data = await res.json()
  if (data.success && data.items) {
    const counts: Record<string, number> = {}
    for (const p of data.items as Product[]) {
      const cat = p.category || 'other'
      counts[cat] = (counts[cat] || 0) + 1
    }
    const cats = Object.keys(counts).filter(Boolean)
    setCategories(['all', ...cats])
    setCategoryCounts({ all: data.items.length, ...counts })
  }
}
```

### 1.4 Categorias en Sidebar

**Archivo**: `frontend/src/components/storefront/StorefrontSidebar.tsx`

La sidebar NO tiene navegacion por categorias. Solo muestra:
- Chat, Shop, New Arrivals, Favorites, Orders, Cart
- Productos recomendados (por rating)
- Producto popular del dia

### 1.5 Categorias en Footer

**Archivo**: `frontend/src/components/Footer.tsx` (lineas 90-105)

Links hardcoded a 3 categorias:
```tsx
<Link href={`/${locale}/shop?category=apparel`}>Apparel</Link>
<Link href={`/${locale}/shop?category=accessories`}>Accessories</Link>
<Link href={`/${locale}/shop?category=home-decor`}>Home & Decor</Link>
```

### 1.6 Categorias en Printify

La sincronizacion con Printify (`frontend/src/lib/printify-sync.ts`) mapea los blueprint types de Printify a categorias locales. El mapeo es basico y orientado a POD apparel/accessories.

### 1.7 i18n de Categorias

Las traducciones viven en los archivos de mensajes bajo `shop.category.*`:
```json
{
  "shop": {
    "category": {
      "all": "All",
      "apparel": "Apparel",
      "accessories": "Accessories",
      "home-decor": "Home & Decor",
      "drinkware": "Drinkware",
      ...
    }
  }
}
```

---

## 2. Gaps Detectados

### 2.1 Arquitectura de Datos (CRITICO)

| Gap | Detalle |
|-----|---------|
| **Sin tabla `categories`** | No hay entidad de categoria en la DB -- es texto libre en `products.category` |
| **Sin jerarquia** | No hay parent_id ni nested sets -- imposible tener subcategorias |
| **Sin metadata de categoria** | No hay descripcion, imagen, SEO fields, orden de display |
| **Sin slug canonico en DB** | La normalizacion se hace en frontend con un diccionario hardcoded |
| **Sin relacion N:M** | Un producto solo puede tener UNA categoria (VARCHAR simple) |
| **Sin categorias para designs** | La tabla `designs` no tiene campo de categoria |

### 2.2 API (CRITICO)

| Gap | Detalle |
|-----|---------|
| **Sin endpoint `/api/categories`** | No existe; el frontend fetcha todos los productos para derivar categorias |
| **Sin CRUD de categorias en admin** | El admin panel no tiene gestion de categorias |
| **Sin endpoint de productos por categoria** | Se filtra via `?category=X` pero no hay ruta dedicada |
| **Sin cache de categorias** | Cada visita a /shop hace el fetch completo |

### 2.3 Frontend (ALTO)

| Gap | Detalle |
|-----|---------|
| **Sin landing pages por categoria** | No existe `/shop/category/[slug]` ni `/collections/[slug]` |
| **Sin imagenes de categoria** | Los chips de categoria son solo texto |
| **Sin navegacion por categoria en sidebar** | Solo links genericos (Shop, New Arrivals) |
| **Sin breadcrumbs de categoria** | Componente breadcrumb existe pero no se usa con categorias |
| **Sin hero/banner por categoria** | No hay visual identity per-category |
| **Sin filtros dentro de categoria** | Al seleccionar categoria no aparecen subcategorias ni filtros especificos |

### 2.4 PodClaw / AI (MEDIO)

| Gap | Detalle |
|-----|---------|
| **Sin category-aware recommendations** | El agente recomienda por rating global, no por afinidad de categoria |
| **Sin category browsing via chat** | El chat puede buscar productos pero no tiene "browse by category" como tool |
| **Sin product_beliefs por categoria** | La tabla `product_beliefs` no agrupa insights por categoria |

---

## 3. Riesgos

### 3.1 Riesgos de Expansion (CRITICO)

| Riesgo | Impacto |
|--------|---------|
| **VARCHAR sin constraint = datos sucios** | Cada integracion (Printify, admin, chat) puede escribir categorias en formato diferente |
| **Normalizacion solo en frontend** | Si el admin crea un producto con categoria "Home and Living" vs "home-decor", la normalizacion falla |
| **Fetch ALL products para categorias** | Con 10K productos esto es un timeout garantizado |
| **Sin migracion path** | Cambiar de VARCHAR a tabla relacional requiere migrar todos los productos existentes |

### 3.2 Riesgos de UX con Nuevas Verticales

| Riesgo | Detalle |
|--------|---------|
| **Chips inutiles con 50+ categorias** | El UI actual muestra chips planos -- con muchas categorias se vuelve inmanejable |
| **Sin jerarquia visual** | "Cafe > Tazas > Espresso" no se puede representar con el sistema actual |
| **Sin identidad por vertical** | Todos los productos se ven igual independiente de la categoria |

### 3.3 Riesgos de SEO con Categorias

| Riesgo | Detalle |
|--------|---------|
| **Sin URLs canonicas por categoria** | `?category=apparel` no es crawleable como `/shop/apparel` |
| **Sin metadata por categoria** | No hay title/description especificos para SERPs de categoria |
| **Sin structured data (ItemList)** | Google no puede identificar colecciones |

---

## 4. Inconsistencias

### 4.1 Nomenclatura

- **DB**: `category VARCHAR(100)` -- texto libre, puede ser "Home & Living", "home-decor", "Hogar"
- **Frontend normalizer**: Convierte a kebab-case (`categories.ts`)
- **Footer**: Hardcoded a 3 categorias (`apparel`, `accessories`, `home-decor`)
- **Sidebar**: No usa categorias en absoluto
- **Shop chips**: Muestra categorias como vienen de la API (pre-normalizacion en algunos casos)
- **i18n keys**: `shop.category.home-decor` pero el alias mapea "home & living" -> "home-decor"

### 4.2 Flujos Inconsistentes

- **Desde Footer**: Click "Apparel" -> `/shop?category=apparel` -> filtra client-side
- **Desde Sidebar**: No hay opcion de categoria
- **Desde Chat**: El agente puede buscar por query pero no por categoria explicitamente
- **Desde Landing**: El carousel muestra productos sin agrupar por categoria

### 4.3 Printify vs Local

- Printify tiene su propio sistema de categorias (blueprint types)
- La sincronizacion (`printify-sync.ts`) mapea a categorias locales
- No hay garantia de que los nombres coincidan con `CATEGORY_ALIASES`
- Si Printify agrega un nuevo tipo, no se mapea automaticamente

---

## 5. Quick Wins

### 5.1 Prioridad Inmediata (1-3 dias)

1. **Crear endpoint `/api/categories`** que haga `SELECT DISTINCT category, COUNT(*) FROM products WHERE status='active' GROUP BY category`
   - Archivo: `frontend/src/app/api/categories/route.ts`
   - Reemplaza el fetch de 100 productos en shop page

2. **Mover normalizacion a backend** -- Normalizar en el API route, no en el frontend
   - Usar `normalizeCategory()` de `frontend/src/lib/categories.ts` en el API

3. **Agregar categorias a sidebar** como seccion colapsable
   - Archivo: `frontend/src/components/storefront/StorefrontSidebar.tsx`

4. **URL-friendly category routes** -- Redirigir `/shop/apparel` a `/shop?category=apparel` como primer paso
   - Archivo: `frontend/src/app/[locale]/(app)/shop/[category]/page.tsx` (redirect)

### 5.2 Prioridad Alta (1 semana)

5. **Crear tabla `categories` en Supabase**:
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  parent_id UUID REFERENCES categories(id),
  name_en VARCHAR(200) NOT NULL,
  name_es VARCHAR(200),
  name_de VARCHAR(200),
  description_en TEXT,
  description_es TEXT,
  description_de TEXT,
  image_url TEXT,
  icon VARCHAR(50),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  seo_title_en VARCHAR(200),
  seo_description_en TEXT,
  printify_blueprint_ids INT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

6. **Migrar datos existentes** de `products.category` VARCHAR a FK en nueva tabla

---

## 6. Refactor Estructural Recomendado

### 6.1 Schema: De VARCHAR a Tabla Relacional

```
ACTUAL:
  products.category VARCHAR(100)  -- texto libre

PROPUESTO:
  categories (id, slug, parent_id, name_{locale}, description_{locale}, image_url, icon, ...)
  product_categories (product_id FK, category_id FK)  -- relacion N:M
  products.primary_category_id FK -> categories.id    -- categoria principal (para display)
```

**Beneficios**:
- Un producto puede pertenecer a multiples categorias (ej: "Taza Espresso" -> Cafe + Drinkware + Kitchen)
- Jerarquia con `parent_id` (ej: Apparel > T-Shirts > Graphic Tees)
- Metadata por categoria (imagen, descripcion, SEO)
- Admin puede gestionar categorias sin tocar codigo

### 6.2 API: Endpoints de Categoria

```
GET  /api/categories              -> Lista jerarquica con conteo de productos
GET  /api/categories/[slug]       -> Metadata de una categoria
GET  /api/products?category=slug  -> (ya existe, mejorar con FK)
POST /api/admin/categories        -> CRUD desde admin panel
```

### 6.3 Frontend: Landing Pages por Categoria

```
Actual:
  /shop?category=apparel          -> query param, no crawleable

Propuesto:
  /shop/                          -> Todas las categorias (overview)
  /shop/[category]/               -> Landing page de categoria
  /shop/[category]/[subcategory]/ -> Subcategoria (opcional)
  /shop/[category]/[id]           -> Producto (mover de /shop/[id])

  Cada landing tiene:
  - Hero banner con imagen de categoria
  - Descripcion SEO
  - Grid de productos filtrados
  - Subcategorias si existen
  - Breadcrumbs: Home > Shop > Apparel > T-Shirts
  - JSON-LD ItemList
  - generateMetadata() con titulo/descripcion de la categoria
```

**Archivo propuesto**: `frontend/src/app/[locale]/(app)/shop/[category]/page.tsx`

### 6.4 Arquitectura Modular para Nuevas Verticales

Para soportar Cafe, Personal Care, Tech, Home sin reescribir:

```
categories/
  cafe/
    - tazas-espresso
    - tazas-cappuccino
    - accesorios-cafe
  personal-care/
    - bolsas-cosmeticos
    - espejos
    - organizadores
  tech/
    - fundas-telefono
    - fundas-laptop
    - mousepads
  home/
    - cojines
    - mantas
    - wall-art
    - posters
  apparel/
    - t-shirts
    - hoodies
    - sweatshirts
```

Cada vertical necesita:
1. **Registro en tabla `categories`** con parent_id, imagenes, y metadata i18n
2. **Mapeo a Printify blueprints** via `printify_blueprint_ids[]` en la tabla
3. **Landing page** generada automaticamente desde metadata de la categoria
4. **Filtros especificos** (ej: Cafe puede tener filtro "material: ceramica/vidrio")
5. **Identidad visual** (color accent, hero image) almacenada en la categoria

### 6.5 Identidad Visual por Categoria

```typescript
// Propuesta: Cada categoria tiene theme overrides
interface CategoryTheme {
  slug: string
  accentColor: string       // ej: '#8B4513' para Cafe
  heroImage: string         // URL de imagen hero
  heroGradient: string      // ej: 'from-amber-900/20 to-background'
  icon: string              // Lucide icon name
  badges: string[]          // ej: ['Artisan', 'Eco-Friendly']
}
```

Esto se almacena en la tabla `categories` y se usa en el componente `CategoryLanding` para renderizar cada vertical con identidad propia.

---

## 7. Roadmap por Fases

### Fase 1: Fundamentos de Datos (Semana 1-2)

- [ ] Crear tabla `categories` con migracion Supabase
- [ ] Crear tabla `product_categories` (N:M)
- [ ] Migrar datos de `products.category` VARCHAR a nueva tabla
- [ ] Crear endpoint `GET /api/categories` con cache
- [ ] Actualizar shop page para usar nuevo endpoint
- [ ] CRUD de categorias en admin panel

### Fase 2: Landing Pages (Semana 3-4)

- [ ] Crear `[locale]/(app)/shop/[category]/page.tsx` con SSR
- [ ] `generateMetadata()` desde tabla categories
- [ ] JSON-LD ItemList por categoria
- [ ] Hero banner por categoria (imagen desde DB)
- [ ] Breadcrumbs funcionales
- [ ] Actualizar sidebar con navegacion por categorias
- [ ] Actualizar sitemap con URLs de categorias

### Fase 3: Jerarquia y Subcategorias (Semana 5-6)

- [ ] UI de subcategorias en landing page
- [ ] Filtros especificos por categoria (atributos variables)
- [ ] `[locale]/(app)/shop/[category]/[subcategory]/page.tsx`
- [ ] Megamenu o dropdown de categorias en header
- [ ] Breadcrumb trail completo

### Fase 4: Nuevas Verticales (Semana 7-10)

- [ ] Definir categorias para Cafe, Personal Care, Tech, Home
- [ ] Mapear a Printify blueprints disponibles
- [ ] Crear contenido i18n para cada categoria (en/es/de)
- [ ] Subir imagenes hero y configurar theme por categoria
- [ ] Actualizar PodClaw con conocimiento de nuevas categorias
- [ ] Landing page de "Explorar Verticales" en homepage

### Fase 5: Optimizacion y AI (Semana 11-12)

- [ ] Category-aware recommendations en sidebar
- [ ] Chat tool: "browse category" para PodClaw
- [ ] A/B test de layouts por vertical
- [ ] Analytics de conversion por categoria
- [ ] Auto-categorization de nuevos productos via AI

---

## 8. Impacto en Escalabilidad 1.000+ Clientes

### 8.1 Estado Actual vs. Necesario

| Metrica | Actual | Con 1000+ clientes |
|---------|--------|---------------------|
| Categorias | 17 (hardcoded en frontend) | 100+ (dinamicas desde DB) |
| Productos por categoria | ~5-20 | 500-5000 |
| Fetch para categorias | ALL products (100 limit) | SELECT DISTINCT con cache |
| URLs de categoria | `?category=x` (no SEO) | `/shop/[category]/` (crawleable) |
| Subcategorias | No soportado | 2-3 niveles de profundidad |
| i18n de categorias | Diccionario en JS | Tabla con name_{locale} |
| Admin de categorias | No existe | CRUD completo |

### 8.2 Patron de Escalabilidad Recomendado

```
Fase 1 (MVP, hasta 100 categorias):
  PostgreSQL tabla categories + product_categories
  Cache Redis (5 min TTL) para GET /api/categories
  Landing pages SSR con ISR (revalidate: 3600)

Fase 2 (Escala, 100-1000 categorias):
  Materialized view para conteos de productos
  Search facets (Meilisearch) para filtros dinamicos
  CDN cache para landing pages (Cloudflare KV)

Fase 3 (Enterprise, 1000+ categorias):
  Category tree service (microservicio)
  GraphQL para queries complejas de jerarquia
  Personalizacion de categorias por segmento de usuario
```

### 8.3 Impacto en Componentes Existentes

| Componente | Cambio Necesario | Esfuerzo |
|------------|-----------------|----------|
| `frontend/src/lib/categories.ts` | Reemplazar diccionario hardcoded por fetch a API | Bajo |
| `frontend/src/app/[locale]/(app)/shop/page.tsx` | Usar endpoint `/api/categories` | Bajo |
| `frontend/src/components/storefront/StorefrontSidebar.tsx` | Agregar seccion de categorias | Medio |
| `frontend/src/components/Footer.tsx` | Generar links de categorias dinamicamente | Bajo |
| `frontend/src/app/sitemap.ts` | Incluir URLs de categorias | Bajo |
| `frontend/src/components/products/ProductGrid.tsx` | Sin cambios (ya recibe datos filtrados) | Ninguno |
| `admin/src/app/products/` | Agregar selector de categoria desde tabla | Medio |
| `podclaw/skills/` | Actualizar knowledge de categorias | Medio |

### 8.4 Modelo de Datos Completo Propuesto

```sql
-- Tabla principal de categorias
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Nombres i18n
  name_en VARCHAR(200) NOT NULL,
  name_es VARCHAR(200),
  name_de VARCHAR(200),

  -- Descripciones i18n (SEO)
  description_en TEXT,
  description_es TEXT,
  description_de TEXT,

  -- SEO metadata
  seo_title_en VARCHAR(200),
  seo_title_es VARCHAR(200),
  seo_title_de VARCHAR(200),
  seo_description_en TEXT,
  seo_description_es TEXT,
  seo_description_de TEXT,

  -- Visual identity
  image_url TEXT,
  hero_image_url TEXT,
  icon VARCHAR(50),           -- Lucide icon name
  accent_color VARCHAR(7),    -- Hex color

  -- Display
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,

  -- Printify mapping
  printify_blueprint_ids INT[] DEFAULT '{}',

  -- Attributes schema (JSON para filtros especificos)
  attribute_schema JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Relacion N:M producto-categoria
CREATE TABLE product_categories (
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  PRIMARY KEY (product_id, category_id)
);

-- Indices
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_active ON categories(is_active, display_order);
CREATE INDEX idx_product_categories_category ON product_categories(category_id);
CREATE INDEX idx_product_categories_primary ON product_categories(product_id) WHERE is_primary;

-- Vista materializada para conteos rapidos
CREATE MATERIALIZED VIEW category_product_counts AS
SELECT
  c.id,
  c.slug,
  c.name_en,
  COUNT(pc.product_id) as product_count
FROM categories c
LEFT JOIN product_categories pc ON pc.category_id = c.id
LEFT JOIN products p ON p.id = pc.product_id AND p.status = 'active'
WHERE c.is_active = true
GROUP BY c.id, c.slug, c.name_en;

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are viewable by everyone" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "Categories are manageable by admins" ON categories FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
```

### 8.5 Comparativa con Ecommerce de Referencia

| Aspecto | POD AI (Actual) | Shopify | WooCommerce | Objetivo |
|---------|----------------|---------|-------------|----------|
| Modelo de datos | VARCHAR libre | Tabla + Collections | Taxonomia WP | Tabla relacional |
| Jerarquia | No | Si (nested) | Si (terminos) | parent_id recursivo |
| N:M | No (1 categoria) | Si (collections) | Si (tags + cats) | product_categories |
| Landing automatica | No | Si (collection pages) | Si (archive) | SSR desde metadata |
| SEO por categoria | No | Si (metadata) | Si (Yoast) | generateMetadata() |
| Visual identity | No | Parcial (imagen) | Plugin | accent_color + hero |
| Admin CRUD | No | Si | Si | Admin panel |
| i18n | Frontend dict | App-level | Plugin (WPML) | Columnas name_{locale} |

**Conclusion**: El sistema de categorias actual es el gap mas significativo para escalar POD AI mas alla de un MVP. La migracion a tabla relacional es prerequisito para landing pages, SEO, navegacion, y expansion a nuevas verticales. Se estima 2-3 semanas de trabajo para las Fases 1-2, con retorno inmediato en SEO y UX.
