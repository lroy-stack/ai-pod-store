# Plan de Reestructuración — Landing Page SKAPARA

**Fecha**: 2026-03-08
**Objetivo**: Reestructurar la landing page (layout y datos) con un sistema de marketing dinámico gestionado desde admin/DB.
**Fase**: Documentación de plan. El plan de desarrollo formal se creará en la siguiente sesión via plan mode.

---

## REGLA 0 — RESTRICCIONES INVIOLABLES

```
╔══════════════════════════════════════════════════════════════════════╗
║  1. NO SE TOCAN ESTILOS DE COMPONENTES EXISTENTES                  ║
║     ProductCard, Button, Badge, Card — mantienen su look actual    ║
║     (neomorphic, shadows, border-radius, tokens semánticos)        ║
║                                                                    ║
║  2. NO SE TOCA EL SISTEMA DE TOKENS                               ║
║     globals.css, store_themes, theme-server.ts, theme-loader.ts    ║
║     Los tokens OKLCH y el bridge @theme inline NO se modifican     ║
║                                                                    ║
║  3. SOLO SE REESTRUCTURA                                           ║
║     Qué secciones aparecen, en qué orden, con qué datos           ║
║     Layout y composición — NO apariencia visual                    ║
║                                                                    ║
║  4. COMPONENTES NUEVOS USAN TOKENS EXISTENTES                     ║
║     bg-background, text-foreground, bg-card, bg-primary, etc.     ║
║     cn() para clases condicionales. Cero colores hardcodeados.    ║
║                                                                    ║
║  5. LOS MOCKUPS DEFINEN ESTRUCTURA, NO PIXEL-PERFECT              ║
║     El estilo final lo dicta el theme activo en la DB              ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 1. Diagnóstico del Estado Actual

### 1.1 Estructura actual de la landing (`LandingPageClient.tsx` — 489 líneas)

```
Sección 1: HERO (min-h-dvh)
├── Background: radial-gradient + MetaballsBackground (canvas animado)
├── Card frosted glass (bg-card/50 backdrop-blur-2xl)
│   ├── BrandMark (56px)
│   ├── TextReveal h1: "Wear what you mean"
│   ├── Subtitulo: "Unique pieces that tell your story..."
│   ├── 2 CTAs: "Explore the collection" → /chat | "Browse Products" → /shop
│   └── Sub-CTA: "Free to explore — no account needed"
└── ChevronDown bounce animation

Sección 2: HOW IT WORKS (3 cards)
├── "Tell us" → MessageCircle
├── "Visualize" → Palette
└── "Receive" → Package

Sección 3: PRODUCT SHOWCASE (carousel)
├── Embla carousel con autoplay (4.5s)
├── 12 productos SSR (seasonal sort)
├── Cards con imagen, título, precio, rating
└── Carousel arrows + mobile "View All"

Sección 4: TESTIMONIALS
├── Reviews localizadas (6 max)
├── Rating promedio + total orders
└── Testimonials component

Sección 5: NEWSLETTER
└── NewsletterSignup component

Sección 6: FINAL CTA
├── Parallax effect
├── "Ready to find your next favorite piece?"
└── 2 CTAs (mismos que hero)

Sección 7: FOOTER
└── Footer component (4 columnas)
```

### 1.2 Problemas identificados

| # | Problema | Impacto |
|---|---------|---------|
| 1 | **Hero sin producto** — Solo texto + BrandMark en card glass. Cero producto visible. | El usuario no sabe qué se vende |
| 2 | **Fondo MetaballsBackground** — Efecto canvas abstracto, no transmite streetwear | Sensación SaaS/tech |
| 3 | **CTA principal va a /chat** — "Explore the collection" lleva al chat, no a la tienda | Confuso para un e-commerce |
| 4 | **Product showcase es carrusel genérico** — 12 productos iguales, sin jerarquía visual | "Más de lo mismo" |
| 5 | **No hay concepto de DROP** — Sin colecciones curadas ni producto protagonista | Falta identidad de marca |
| 6 | **Copy genérico** — "Wear what you mean" es correcto pero no diferenciador | No comunica streetwear/tech culture |
| 7 | **How It Works** — Patrón SaaS típico (3 cards numeradas) | Refuerza sensación de software |
| 8 | **Contenido estático** — Todo hardcodeado en componentes + i18n JSON | No se puede cambiar sin deploy |

---

## 2. Referencia Visual — Mockups

### 2.1 Mockups relevantes para este plan (`/Users/lr0y/POD-AI-PDR/ui-mocks/`)

| Mockup | Contenido | Define layout de... |
|--------|-----------|---------------------|
| `landing-desktop-tablet.PNG` | Hero 2 columnas (copy + hoodie), DROP 01 grid | Landing desktop |
| `Landing-mobile-ui.PNG` | 3 variantes mobile: copy + hoodie + collection grid | Landing mobile |
| `ska-steer.PNG` | Signal Hoodie 3 vistas (raw asset) | Hero image source |
| `skapara-street.jpg` | Lifestyle photo hoodie (raw asset) | Alternative hero |

> **NOTA**: Los mockups de shop, PDP y profile (`shop.PNG`, `product-detail.PNG`, `profile.PNG`) existen pero son scope de fases futuras. Este plan cubre SOLO la landing page.

### 2.2 Análisis del mockup Landing Desktop

```
SKAPARA (wordmark centrado top)

Signal for                    [HOODIE HERO IMAGE]
Creators.                     (Signal Hoodie — back view,
                               grande, protagonista)
DROP 01 — EARLY ACCESS

[SHOP DROP 01]

────────────────────────────────────────

DROP 01        SIGNAL COLLECTION

[Hoodie]  [Existential]  [Social]  [Next Line]  [...]
 €79      Dread Tee       Battery    Tee
          €44             Tee €44    €44
```

### 2.3 Análisis del mockup Landing Mobile (3 variantes)

- **Variante A**: "Streetwear for builders, hackers and creators" + "GET 20% EARLY ACCESS" + hoodie derecha + grid 2col + "VIEW COLLECTION" + tags CODE/DESIGN/FUTURE
- **Variante B**: "Signal for the digital underground" + "SHOP DROP 01" + hoodie centrado + grid 2col
- **Variante C**: "DROP 01 EARLY ACCESS / SIGNAL IS ACTIVE" + "SHOP DROP?" + wordmark grande + grid 2col

### 2.4 Principios extraídos de mockups

1. **Producto protagonista** — Hoodie ocupa >50% del hero visual
2. **Concepto DROP** — Colecciones curadas con nombre y scheduling
3. **Dark theme base** — Fondo oscuro, producto en contraste
4. **Copy streetwear** — "Signal for Creators", no "Wear what you mean"
5. **CTA directo** — "SHOP DROP 01" lleva al shop filtrado
6. **Colección curada** — 5-8 productos del DROP, no 12 random
7. **Trust bar** — 4 badges de confianza en landing

---

## 3. Sistema de Marketing Dinámico — DB Schema

### 3.1 Principio

**TODO el contenido de la landing se gestiona desde `/admin`**: heroes, copy, imágenes, colecciones, productos destacados, scheduling. Cero hardcoding. Cambiar de temporada o lanzar un DROP nuevo = editar en admin, sin deploy.

### 3.2 Tabla `hero_campaigns` — Campañas de marketing

```sql
CREATE TABLE hero_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,              -- 'drop-01-signal', 'summer-2026', 'black-friday'
  name TEXT NOT NULL,                     -- Admin display name (internal)
  status TEXT NOT NULL DEFAULT 'draft'    -- draft | scheduled | active | archived
    CHECK (status IN ('draft', 'scheduled', 'active', 'archived')),
  priority INTEGER DEFAULT 0,            -- Higher = shown first when multiple active
  starts_at TIMESTAMPTZ,                 -- NULL = immediately active when status='active'
  ends_at TIMESTAMPTZ,                   -- NULL = no end date

  -- Hero content (i18n via JSONB — keys: en, es, de)
  title JSONB NOT NULL DEFAULT '{}',            -- {"en": "Signal for Creators.", ...}
  subtitle JSONB DEFAULT '{}',                  -- {"en": "DROP 01 — EARLY ACCESS", ...}
  cta_text JSONB NOT NULL DEFAULT '{}',         -- {"en": "SHOP DROP 01", ...}
  cta_url TEXT NOT NULL DEFAULT '/shop',        -- '/shop?collection=drop-01' or '/drop/01'
  sub_cta_text JSONB DEFAULT '{}',              -- {"en": "Limited edition · Built for creators", ...}

  -- Images (Supabase Storage public URLs)
  image_url TEXT,                         -- Main hero image (all breakpoints via next/image sizes)
  image_alt JSONB DEFAULT '{}',           -- {"en": "SKAPARA Signal Hoodie", ...}
  og_image_url TEXT,                      -- OG image for social sharing (1200×630)

  -- Linked collection (for DROP grid below hero)
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Only ONE campaign should be active+priority at a time — fetch the top one
CREATE INDEX idx_hero_campaigns_active ON hero_campaigns(priority DESC, starts_at)
  WHERE status = 'active';
```

### 3.3 Tabla `collections` — Colecciones / DROPs

```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,              -- 'drop-01-signal', 'summer-essentials'
  name JSONB NOT NULL DEFAULT '{}',       -- {"en": "Signal Collection", "es": "Colección Signal", ...}
  description JSONB DEFAULT '{}',         -- {"en": "First drop — streetwear for creators", ...}
  status TEXT NOT NULL DEFAULT 'draft'    -- draft | active | archived
    CHECK (status IN ('draft', 'active', 'archived')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.4 Tabla `collection_products` — Productos en colección

```sql
CREATE TABLE collection_products (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,             -- Order within collection grid
  is_featured BOOLEAN DEFAULT false,      -- Featured/hero product (bigger in grid)
  PRIMARY KEY (collection_id, product_id)
);

CREATE INDEX idx_collection_products_order ON collection_products(collection_id, position);
```

### 3.5 Supabase Storage — Bucket `marketing`

```sql
-- Bucket for campaign images (hero images, OG images, banners)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketing',
  'marketing',
  true,                                    -- Public access (CDN-served)
  5242880,                                 -- 5MB max per file
  ARRAY['image/png', 'image/jpeg', 'image/webp']
);

-- Public read for all
CREATE POLICY marketing_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'marketing');

-- Admin write only
CREATE POLICY marketing_admin_write ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'marketing')
  WITH CHECK (bucket_id = 'marketing');
```

**Estructura de carpetas en storage**:
```
marketing/
├── heroes/           -- Hero campaign images
│   ├── drop-01-signal-hoodie.png
│   ├── summer-2026-beach.jpg
│   └── ...
└── og/               -- OG/social share images (1200×630)
    ├── drop-01-og.png
    └── ...
```

### 3.6 RLS Policies

```sql
-- hero_campaigns: public read, admin write
ALTER TABLE hero_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY hero_campaigns_public_read ON hero_campaigns
  FOR SELECT USING (status = 'active');
CREATE POLICY hero_campaigns_admin_all ON hero_campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- collections: public read, admin write
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY collections_public_read ON collections
  FOR SELECT USING (status = 'active');
CREATE POLICY collections_admin_all ON collections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- collection_products: public read via join, admin write
ALTER TABLE collection_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY collection_products_public_read ON collection_products
  FOR SELECT USING (true);
CREATE POLICY collection_products_admin_all ON collection_products
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 3.7 Diagrama de relaciones

```
hero_campaigns ──────────┐
  │                      │ collection_id (FK)
  │ title (JSONB i18n)   │
  │ subtitle             ▼
  │ cta_text         collections
  │ image_url           │ slug
  │ og_image_url        │ name (JSONB i18n)
  │ starts_at/ends_at   │ status
  │                     │
  │                     ▼
  │              collection_products
  │                │ position
  │                │ is_featured
  │                │
  │                ▼
  │             products (existente)
  │               │ title, base_price_cents
  │               │ images, status
  │               ▼
  │           product_variants (existente)
  │               │ color, size, image_url
```

### 3.8 Flujo de gestión

```
ADMIN (/admin/marketing):

  1. CREAR COLECCIÓN
     └── Seleccionar productos existentes
     └── Ordenar (drag & drop)
     └── Marcar featured (1 producto grande en grid)
     └── Estado: draft → active

  2. CREAR CAMPAÑA
     └── Título/subtítulo/CTA en 3 idiomas (en/es/de)
     └── Subir imagen hero → Supabase Storage `marketing/heroes/`
     └── Subir OG image → Supabase Storage `marketing/og/`
     └── Vincular colección existente
     └── Scheduling: starts_at / ends_at (opcional)
     └── Estado: draft → scheduled → active

  3. CAMBIAR DE TEMPORADA
     └── Archivar campaña actual (status → archived)
     └── Activar nueva campaña (status → active)
     └── La landing cambia instantáneamente, sin deploy
```

---

## 4. Arquitectura de la Nueva Landing

### 4.1 Estructura de secciones

```
NUEVA LANDING PAGE (datos desde hero_campaigns + collections)
==============================================================

SECCIÓN 1: HERO (min-h-dvh) ← datos de hero_campaigns
├── Layout: 2 columnas en desktop (texto izq + imagen der)
│   ├── Columna izquierda (copy dinámico):
│   │   ├── Logo SKAPARA (wordmark, existente)
│   │   ├── h1: campaign.title[locale]
│   │   ├── Badge: campaign.subtitle[locale]
│   │   └── CTA: campaign.cta_text[locale] → campaign.cta_url
│   └── Columna derecha (imagen dinámica):
│       └── next/image src={campaign.image_url} (desde Supabase Storage)
├── Mobile: Stack vertical (copy arriba, imagen abajo)
├── Fondo: bg-background (del theme activo, NO hardcodeado)
└── Sin MetaballsBackground (eliminar canvas pesado)

SECCIÓN 2: DROP COLLECTION ← datos de collections + collection_products
├── Título: collection.name[locale]
├── Grid: N productos (según collection_products, ordenados por position)
│   ├── is_featured=true → card más grande (2 cols desktop)
│   └── is_featured=false → card estándar
├── Cada producto: ProductCard existente (SIN CAMBIOS de estilo)
└── CTA: "VIEW COLLECTION" → /shop?collection={collection.slug}

SECCIÓN 3: BRAND STATEMENT (diferenciador)
├── Copy localizado (desde i18n — este SÍ va en messages/*.json)
├── Subcopy sobre la marca
└── Opcional: Tags CODE / DESIGN / FUTURE (del mockup mobile)

SECCIÓN 4: SOCIAL PROOF (simplificado)
├── Testimonials existente (SIN CAMBIOS de estilo, reducir a 3)
└── TrustBar: 4 badges (Made in EU, returns, secure, shipping)

SECCIÓN 5: NEWSLETTER + FINAL CTA
├── NewsletterSignup existente (SIN CAMBIOS)
└── CTA final dinámico (reutiliza campaign.cta_text/cta_url)

SECCIÓN 6: FOOTER (existente, SIN CAMBIOS)
```

### 4.2 Breakpoints responsive (LAYOUT — no estilos)

```
MOBILE (< 768px):
─────────────────
┌──────────────────────┐
│      SKAPARA         │
│                      │
│  {campaign.title}    │
│                      │
│  {campaign.subtitle} │
│                      │
│  [{campaign.cta}]    │
│                      │
│   ┌──────────────┐   │
│   │              │   │
│   │  HERO IMG    │   │  ← campaign.image_url
│   │  (dynamic)   │   │
│   │              │   │
│   └──────────────┘   │
│                      │
│ {collection.name}    │
│ ┌──────┐ ┌──────┐   │
│ │Card  │ │Card  │   │  ← ProductCard existente
│ │      │ │      │   │
│ └──────┘ └──────┘   │
│ ┌──────┐ ┌──────┐   │
│ │Card  │ │Card  │   │
│ │      │ │      │   │
│ └──────┘ └──────┘   │
└──────────────────────┘

TABLET (768px - 1024px):
────────────────────────
┌─────────────────────────────────┐
│ SKAPARA                         │
│                                 │
│ {title}           ┌───────────┐ │
│                   │           │ │
│ {subtitle}        │  HERO IMG │ │
│                   │ (dynamic) │ │
│ [{cta}]           │           │ │
│                   └───────────┘ │
│                                 │
│ ┌──────┐┌──────┐┌──────┐┌────┐ │
│ │ Card ││ Card ││ Card ││Card│ │  ← ProductCard existente
│ └──────┘└──────┘└──────┘└────┘ │
└─────────────────────────────────┘

DESKTOP (> 1024px):
───────────────────
┌──────────────────────────────────────────────────┐
│ SKAPARA                                          │
│                                                  │
│   {campaign.title}     ┌─────────────────────┐   │
│                        │                     │   │
│   {campaign.subtitle}  │    HERO IMAGE       │   │
│                        │    (dynamic, from    │   │
│   [{campaign.cta}]     │     Supabase Storage)│   │
│                        │                     │   │
│                        └─────────────────────┘   │
│                                                  │
│ ──────────────────────────────────────────────── │
│                                                  │
│ {collection.name}                                │
│                                                  │
│ ┌─────────────────┐ ┌────────┐ ┌────────┐       │
│ │                 │ │        │ │        │       │
│ │  FEATURED       │ │  Card  │ │  Card  │       │
│ │  ProductCard    │ │        │ │        │       │
│ │  (is_featured)  │ │        │ │        │       │
│ └─────────────────┘ └────────┘ └────────┘       │
│                     ┌────────┐ ┌────────┐       │
│                     │  Card  │ │  Card  │       │
│                     │        │ │        │       │
│                     └────────┘ └────────┘       │
└──────────────────────────────────────────────────┘
```

---

## 5. Componentes a Crear / Modificar

### 5.1 Componentes NUEVOS (usan tokens existentes, cero estilos custom)

| Componente | Archivo | Datos de entrada | Responsabilidad |
|------------|---------|------------------|-----------------|
| `HeroSection` | `components/landing/HeroSection.tsx` | `campaign: HeroCampaign`, `locale: string` | Layout 2 columnas: copy dinámico + imagen dinámica |
| `DropCollection` | `components/landing/DropCollection.tsx` | `collection: Collection`, `products: Product[]`, `locale: string` | Grid curado con ProductCard existente |
| `BrandStatement` | `components/landing/BrandStatement.tsx` | i18n keys | Sección identidad de marca |
| `TrustBar` | `components/landing/TrustBar.tsx` | i18n keys | Barra de trust badges |

### 5.2 Componentes EXISTENTES a modificar (solo data flow, no estilo)

| Componente | Cambio |
|------------|--------|
| `LandingPageClient.tsx` | **Reescribir composición** — recibe campaign + collection como props, compone las nuevas secciones |
| `page.tsx` (landing) | **Reescribir data fetching** — SSR fetch de active campaign + collection products |

### 5.3 Componentes EXISTENTES sin cambios (NI layout NI estilo)

| Componente | Razón |
|------------|-------|
| `ProductCard` | **INTOCABLE** — mantiene su estilo neomorphic actual. Solo se reutiliza en DropCollection grid |
| `Testimonials.tsx` | Se mantiene, se pasa prop para limitar a 3 reviews |
| `NewsletterSignup.tsx` | Se mantiene íntegro |
| `TextReveal.tsx` | Reutilizable para el h1 dinámico |
| `Footer` | Se mantiene íntegro |
| `BrandMark` | Se reutiliza en el hero |

### 5.4 Componentes a DEPRECAR

| Componente | Razón |
|------------|-------|
| `MetaballsBackground.tsx` | Canvas pesado, no aporta. Se deja de importar (no se borra el archivo) |

---

## 6. Copy y Contenido — Estrategia i18n

### 6.1 Contenido DINÁMICO (desde DB — hero_campaigns)

El copy del hero viene de la DB en JSONB i18n. Ejemplo del registro:

```json
{
  "title": {"en": "Signal for Creators.", "es": "Signal for Creators.", "de": "Signal for Creators."},
  "subtitle": {"en": "DROP 01 — EARLY ACCESS", "es": "DROP 01 — ACCESO ANTICIPADO", "de": "DROP 01 — EARLY ACCESS"},
  "cta_text": {"en": "SHOP DROP 01", "es": "COMPRAR DROP 01", "de": "DROP 01 SHOPPEN"},
  "sub_cta_text": {"en": "Limited edition · Built for creators", "es": "Edición limitada · Hecho para creadores", "de": "Limitierte Auflage · Für Creator gemacht"}
}
```

**Ventaja**: Cambiar el copy del hero = editar en admin. Sin deploy, sin PR, sin tocar messages/*.json.

### 6.2 Contenido ESTÁTICO (messages/*.json — secciones fijas)

Las secciones que NO cambian entre campañas siguen en i18n files:

```json
{
  "landing": {
    "brandStatement": "Streetwear for builders, hackers and creators.",
    "brandBody": "Born from code culture. Made in Europe. Every piece is a signal.",
    "trustMadeInEU": "Made in Europe",
    "trustReturns": "14-day returns",
    "trustSecure": "Secure checkout",
    "trustShipping": "Worldwide shipping",
    "viewCollection": "VIEW COLLECTION"
  }
}
```

---

## 7. Data Fetching — Server Component

### 7.1 Landing page.tsx (SSR)

```typescript
// app/[locale]/(landing)/page.tsx

export default async function LandingPage({ params }: { params: { locale: string } }) {
  const { locale } = await params

  // 1. Fetch active campaign (highest priority, within date range)
  const { data: campaign } = await supabaseAdmin
    .from('hero_campaigns')
    .select(`
      *,
      collection:collections(
        id, slug, name, description,
        collection_products(
          position, is_featured,
          product:products(id, title, base_price_cents, currency, images, status, avg_rating, review_count)
        )
      )
    `)
    .eq('status', 'active')
    .or(`starts_at.is.null,starts_at.lte.${new Date().toISOString()}`)
    .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
    .order('priority', { ascending: false })
    .limit(1)
    .single()

  // 2. Collection products sorted by position
  const collectionProducts = campaign?.collection?.collection_products
    ?.sort((a, b) => a.position - b.position)
    ?.filter(cp => cp.product?.status === 'active')
    ?.map(cp => ({ ...cp.product, is_featured: cp.is_featured }))
    ?? []

  // 3. Testimonials (existente, sin cambios)
  const { data: testimonials } = await supabaseAdmin
    .from('reviews')
    .select('...')
    .limit(3)

  return (
    <LandingPageClient
      campaign={campaign}
      collectionProducts={collectionProducts}
      collectionName={campaign?.collection?.name}
      collectionSlug={campaign?.collection?.slug}
      testimonials={testimonials}
      locale={locale}
    />
  )
}
```

### 7.2 Fallback sin campaña activa

Si no hay campaña activa (primera visita, error de DB), el componente muestra un hero genérico con copy estático de messages/*.json. No crash, no página en blanco.

### 7.3 next/image con Supabase Storage

```typescript
// next.config.ts — agregar dominio de Supabase Storage
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '*.supabase.co',
      pathname: '/storage/v1/object/public/**',
    },
  ],
}
```

```tsx
// HeroSection.tsx — imagen dinámica desde Storage
<Image
  src={campaign.image_url}  // Supabase Storage URL
  alt={campaign.image_alt?.[locale] ?? 'Campaign hero'}
  width={1200}
  height={1600}
  sizes="(max-width: 640px) 280px, (max-width: 768px) 340px, (max-width: 1024px) 450px, 600px"
  priority  // LCP
  quality={90}
  className="object-contain"
/>
```

### 7.4 Caching

```typescript
// Usar unstable_cache como ya hace theme-server.ts
export const getActiveCampaign = unstable_cache(
  async () => { /* fetch from hero_campaigns */ },
  ['active-campaign'],
  { revalidate: 60, tags: ['campaign'] }  // 1 min cache, revalidate on admin change
)
```

---

## 8. Admin — Gestión de Marketing

### 8.1 Nueva página: `/admin/marketing`

Tabs: **Campañas** | **Colecciones**

#### Tab: Campañas

| Elemento | Descripción |
|----------|-------------|
| Lista de campañas | Tabla con slug, status badge, dates, priority |
| Crear/Editar campaña | Form con: título i18n (3 tabs: EN/ES/DE), subtitle i18n, CTA i18n, upload imagen hero, upload OG image, selector de colección, date pickers (starts_at/ends_at), priority number |
| Activar/Archivar | Botón para cambiar status (draft→active, active→archived) |
| Preview | Vista previa del hero tal como se verá en la landing |

#### Tab: Colecciones

| Elemento | Descripción |
|----------|-------------|
| Lista de colecciones | Tabla con slug, status badge, product count |
| Crear/Editar colección | Name i18n, description i18n, product selector (search/add), drag & drop para ordenar, toggle featured |
| Producto featured | Checkbox en cada producto — el featured aparece grande en el grid |

### 8.2 API Routes admin

```
POST   /api/admin/campaigns          — crear campaña
GET    /api/admin/campaigns          — listar campañas (todas, no solo activas)
PUT    /api/admin/campaigns/:id      — editar campaña
PATCH  /api/admin/campaigns/:id/status — cambiar status
DELETE /api/admin/campaigns/:id      — eliminar campaña (solo draft)

POST   /api/admin/collections        — crear colección
GET    /api/admin/collections        — listar colecciones
PUT    /api/admin/collections/:id    — editar colección (+ products)
DELETE /api/admin/collections/:id    — eliminar colección (solo draft)
```

### 8.3 Upload de imágenes

```typescript
// Admin sube imagen → va a Supabase Storage bucket 'marketing'
const { data } = await supabaseAdmin.storage
  .from('marketing')
  .upload(`heroes/${slug}-${Date.now()}.png`, file, {
    contentType: 'image/png',
    cacheControl: '31536000', // 1 year CDN cache
  })

// URL pública para guardar en hero_campaigns.image_url
const publicUrl = supabaseAdmin.storage
  .from('marketing')
  .getPublicUrl(data.path).data.publicUrl
```

---

## 9. Imágenes — Guía de Formatos

### 9.1 Imágenes gestionadas por el sistema dinámico

| Uso | Formato | Ratio | Tamaño recomendado | Origen |
|-----|---------|-------|-------------------|--------|
| Hero image | PNG (con alpha) o JPG | ~3:4 vertical | ≥1200×1600 | Admin upload → Storage |
| OG image | PNG o JPG | 1.91:1 | 1200×630 | Admin upload → Storage |
| Collection banner (futuro) | JPG | 16:9 | 1920×1080 | Admin upload → Storage |

### 9.2 Imágenes que NO cambian (vienen de Printful/DB)

| Uso | Origen | Ratio |
|-----|--------|-------|
| ProductCard thumbnail | `products.images` (Printful CDN) | 1:1 cuadrado |
| PDP gallery | `products.images` (Printful CDN) | ~3:4 |
| Variant color swatch | `product_variants.image_url` (Printful CDN) | 1:1 |

### 9.3 Imagen hero para DROP 01 (primera campaña)

**Fuente**: Procesar `ui-mocks/ska-steer.PNG` (back view principal)
- Remove background → transparencia (usar rembg del stack)
- Trim → export PNG ≥1200×1600
- Upload a Supabase Storage `marketing/heroes/drop-01-signal-hoodie.png`
- next/image genera WebP + responsive sizes automáticamente

**OG image**: Composición 1200×630 (hoodie + wordmark + "Signal for Creators" sobre dark bg)
- Upload a `marketing/og/drop-01-og.png`

---

## 10. Archivos Afectados (Resumen)

### 10.1 Migraciones SQL (NUEVAS)

| # | Archivo | Contenido |
|---|---------|-----------|
| 1 | `supabase/migrations/20260308600000_hero_campaigns.sql` | Tablas hero_campaigns, collections, collection_products + RLS + Storage bucket |

### 10.2 Frontend (NUEVOS)

| # | Archivo | Responsabilidad |
|---|---------|-----------------|
| 2 | `components/landing/HeroSection.tsx` | Hero dinámico: campaign props → layout 2 columnas |
| 3 | `components/landing/DropCollection.tsx` | Grid dinámico: collection products → ProductCard grid |
| 4 | `components/landing/BrandStatement.tsx` | Sección identidad marca (copy estático i18n) |
| 5 | `components/landing/TrustBar.tsx` | 4 trust badges (copy estático i18n) |
| 6 | `lib/marketing-server.ts` | `getActiveCampaign()` con unstable_cache |

### 10.3 Frontend (MODIFICADOS — solo data flow, no estilo)

| # | Archivo | Cambio |
|---|---------|--------|
| 7 | `app/[locale]/(landing)/page.tsx` | Reescribir SSR: fetch campaign + collection |
| 8 | `components/landing/LandingPageClient.tsx` | Reescribir composición: recibe campaign/collection props |
| 9 | `messages/en.json` | Agregar keys estáticas de landing (brandStatement, trust*) |
| 10 | `messages/es.json` | Agregar keys estáticas de landing |
| 11 | `messages/de.json` | Agregar keys estáticas de landing |
| 12 | `next.config.ts` | Agregar Supabase Storage a remotePatterns |

### 10.4 Admin (NUEVOS)

| # | Archivo | Responsabilidad |
|---|---------|-----------------|
| 13 | `admin/src/app/(dashboard)/marketing/page.tsx` | Página de gestión: campañas + colecciones |
| 14 | `admin API routes` | CRUD para campaigns + collections |

### 10.5 Sin cambios (explícito)

| Componente | Estado |
|------------|--------|
| `ProductCard` | **INTOCABLE** — se reutiliza tal cual |
| `globals.css` | **INTOCABLE** — tokens permanecen |
| `theme-server.ts` / `theme-loader.ts` | **INTOCABLE** — sistema de themes permanece |
| `store_themes` table | **INTOCABLE** |
| `Testimonials.tsx` | Se reutiliza sin cambios de estilo |
| `NewsletterSignup.tsx` | Se reutiliza sin cambios |
| `Footer` | Se reutiliza sin cambios |

---

## 11. Orden de Implementación

```
FASE 0: Base de Datos (pre-requisito)
  1. Crear migración: hero_campaigns + collections + collection_products + RLS + Storage bucket
  2. Desplegar migración a Supabase
  3. Seed inicial: crear colección "drop-01-signal" + vincular productos existentes
  4. Procesar imagen hero (rembg) → upload a Storage bucket

FASE 1: Data Layer Frontend
  5. lib/marketing-server.ts — getActiveCampaign() con cache
  6. next.config.ts — agregar Supabase Storage remotePatterns
  7. Types: HeroCampaign, Collection, CollectionProduct

FASE 2: Landing Restructure
  8. HeroSection.tsx — layout responsive, props dinámicos, image desde Storage
  9. DropCollection.tsx — grid con ProductCard existente, featured logic
  10. BrandStatement.tsx — copy estático i18n
  11. TrustBar.tsx — 4 badges estáticos i18n
  12. Reescribir page.tsx — SSR fetch campaign + collection
  13. Reescribir LandingPageClient.tsx — componer secciones
  14. Actualizar messages/*.json — keys estáticas nuevas

FASE 3: Admin Marketing
  15. API routes: campaigns CRUD + collections CRUD
  16. admin/marketing/page.tsx — gestión de campañas y colecciones
  17. Upload de imágenes a Storage desde admin

FASE 4: Seed + Testing
  18. Crear campaña "DROP 01 — SIGNAL" con datos reales
  19. Visual check en 3 breakpoints (375px, 768px, 1440px)
  20. Lighthouse performance (LCP < 2.5s)
  21. Verificar cambio de campaña desde admin (sin deploy)
```

---

## 12. Decisiones Pendientes para Plan Mode

1. **¿Mantenemos el "How It Works"?** — Los mockups no lo muestran. Puede eliminarse o moverse al footer.
2. **¿El CTA principal va a /shop?collection=slug o a /drop/slug?** — /drop/slug es más limpio para SEO pero requiere nueva ruta.
3. **¿Qué productos son el DROP 01?** — Signal Hoodie + Existential Dread Tee + Social Battery Tee + Next Line Tee + Code Long Sleeve (del mockup).
4. **¿Hero carousel (multiple slides) o single hero?** — Los mockups muestran single hero. El schema soporta ambos (multiple active campaigns con priority).
5. **¿Admin marketing es tab en branding o página nueva?** — Recomendación: página nueva `/admin/marketing` (es un dominio diferente a branding/themes).

---

## 13. Métricas de Éxito

| Métrica | Actual (estimado) | Objetivo |
|---------|-------------------|----------|
| LCP | ~3-4s (MetaballsBackground canvas) | < 2.5s (imagen desde CDN Storage) |
| Primera impresión | "App SaaS / dashboard" | "Marca streetwear / tienda" |
| CTA clarity | "Explore the collection" → chat | "{cta_text}" → shop filtrado |
| Productos en hero | 0 | 1 protagonista (dinámico) |
| Jerarquía visual | Plana (12 random) | Clara (1 featured + N curados) |
| Tiempo para cambiar landing | Deploy needed | Admin edit, instantáneo |
| Personalización estacional | Imposible | Scheduling automático |
