# 04 — Sistema de Estilos y Theming

Documentacion del sistema de estilos, theming, tipografia, animaciones, imagenes y brand assets del frontend SKAPARA.

Fecha: 2026-03-08

---

## 1. Tailwind CSS

### Version y configuracion

- **Tailwind v4** — usa configuracion CSS-only, no hay archivo `tailwind.config.ts` ni `tailwind.config.js`
- **PostCSS plugin**: `@tailwindcss/postcss` (en `postcss.config.mjs`)
- **Plugin de tipografia**: `@tailwindcss/typography` (importado como `@plugin` en `globals.css`)
- **Entrada CSS**: `src/app/globals.css` con directiva `@import "tailwindcss"`

### Dependencias en `package.json`

```
"tailwindcss": "^4.0.0"
"@tailwindcss/postcss": "^4.1.18"
"@tailwindcss/typography": "^0.5.15"
"postcss": "^8.4.49"
```

### PostCSS config (`postcss.config.mjs`)

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

---

## 2. CSS Variables — Color Tokens

Todos los colores se definen como CSS custom properties en OKLCH color space dentro de `src/app/globals.css`.

### Arquitectura de dos capas

**Layer 1 — Variables reales** (`:root` y `.dark`): Definen los valores concretos OKLCH.

**Layer 2 — Bridge reactivo** (`@theme inline`): Mapea las variables a Tailwind utilities (`--color-*` namespace).

Esto permite que los cambios en runtime (via theme-loader) se propaguen automaticamente a las clases Tailwind.

### Light mode (`:root`)

| Variable | Valor OKLCH | Descripcion |
|---|---|---|
| `--background` | `oklch(0.93 0.008 260)` | Fondo principal — gris azulado muy claro |
| `--foreground` | `oklch(0.30 0.025 255)` | Texto principal — azul oscuro desaturado |
| `--card` | `oklch(0.95 0.009 260)` | Superficie de cards — ligeramente mas claro que background |
| `--card-foreground` | `oklch(0.30 0.025 255)` | Texto en cards |
| `--popover` | `oklch(0.95 0.009 260)` | Superficie de popovers |
| `--popover-foreground` | `oklch(0.30 0.025 255)` | Texto en popovers |
| `--primary` | `oklch(0.58 0.19 38)` | Color primario — naranja quemado/burnt orange |
| `--primary-foreground` | `oklch(1.0 0 0)` | Texto sobre primary — blanco puro |
| `--secondary` | `oklch(0.91 0.006 260)` | Fondo secundario — gris azulado claro |
| `--secondary-foreground` | `oklch(0.30 0.025 255)` | Texto secundario |
| `--muted` | `oklch(0.90 0.008 260)` | Fondos atenuados |
| `--muted-foreground` | `oklch(0.53 0.015 260)` | Texto atenuado |
| `--accent` | `oklch(0.92 0.006 260)` | Fondos de acento (hover states) |
| `--accent-foreground` | `oklch(0.30 0.025 255)` | Texto de acento |
| `--destructive` | `oklch(0.55 0.22 25)` | Rojo destructivo |
| `--destructive-foreground` | `oklch(1.0 0 0)` | Texto sobre destructive |
| `--success` | `oklch(0.65 0.19 155)` | Verde de exito |
| `--success-foreground` | `oklch(1.0 0 0)` | Texto sobre success |
| `--warning` | `oklch(0.75 0.16 70)` | Amarillo de advertencia |
| `--warning-foreground` | `oklch(0.25 0.05 70)` | Texto sobre warning |
| `--border` | `oklch(0.87 0.008 260)` | Bordes |
| `--input` | `oklch(0.93 0.006 260)` | Fondo de inputs |
| `--ring` | `oklch(0.58 0.19 38)` | Focus ring — mismo que primary |
| `--rating` | `oklch(0.80 0.16 85)` | Estrellas de rating |
| `--rating-foreground` | `oklch(0.40 0.08 85)` | Texto de rating |

### Chart colors (light)

| Variable | Valor OKLCH | Hue aproximado |
|---|---|---|
| `--chart-1` | `oklch(0.58 0.19 38)` | Naranja (= primary) |
| `--chart-2` | `oklch(0.55 0.18 280)` | Violeta |
| `--chart-3` | `oklch(0.65 0.15 200)` | Cyan/teal |
| `--chart-4` | `oklch(0.65 0.19 155)` | Verde (= success) |
| `--chart-5` | `oklch(0.75 0.16 70)` | Amarillo (= warning) |

### Dark mode (`.dark`)

| Variable | Valor OKLCH | Cambio vs light |
|---|---|---|
| `--background` | `oklch(0.20 0.010 260)` | Gris oscuro azulado |
| `--foreground` | `oklch(0.93 0.005 260)` | Texto claro |
| `--card` | `oklch(0.24 0.012 260)` | Surface ligeramente elevada |
| `--primary` | `oklch(0.65 0.19 38)` | Naranja mas brillante (+0.07 lightness) |
| `--secondary` | `oklch(0.26 0.010 260)` | Gris oscuro |
| `--muted` | `oklch(0.28 0.012 260)` | Gris oscuro elevado |
| `--muted-foreground` | `oklch(0.65 0.012 260)` | Texto gris medio |
| `--destructive` | `oklch(0.60 0.22 25)` | Rojo mas brillante |
| `--border` | `oklch(0.34 0.012 260)` | Bordes oscuros |
| `--input` | `oklch(0.26 0.010 260)` | Inputs oscuros |
| `--ring` | `oklch(0.65 0.19 38)` | Focus ring mas brillante |
| `--shadow` | `0 4px 6px -1px rgb(0 0 0 / 0.3)` | Sombra mas pronunciada (0.3 vs 0.1) |

### Design tokens adicionales

| Variable | Valor default | Descripcion |
|---|---|---|
| `--radius` | `1rem` | Radio de borde base |
| `--shadow` | `0 4px 6px -1px rgb(0 0 0 / 0.1), ...` | Sombra default (medium) |
| `--font-sans` | `"Inter", system-ui, -apple-system, sans-serif` | Fuente sans-serif |
| `--font-heading` | `"Inter", system-ui, -apple-system, sans-serif` | Fuente de headings |
| `--font-mono` | `"JetBrains Mono", ui-monospace, monospace` | Fuente monospace |

### Radius derivations (en `@theme inline`)

```css
--radius-sm: calc(var(--radius) - 4px);   /* 0.75rem ~12px */
--radius-md: calc(var(--radius) - 2px);    /* 0.875rem ~14px */
--radius-lg: var(--radius);                /* 1rem = 16px */
--radius-xl: calc(var(--radius) + 4px);    /* 1.25rem ~20px */
```

---

## 3. shadcn/ui Theme

### Configuracion (`components.json`)

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- **Estilo**: `new-york` (variante mas refinada con bordes mas sutiles)
- **Base color**: `zinc` (aunque los valores reales estan sobreescritos con la paleta OKLCH custom)
- **CSS variables**: activo (`cssVariables: true`)
- **RSC**: habilitado para React Server Components
- **Iconos**: Lucide React

### Componentes UI instalados (28 componentes)

`src/components/ui/`:

accordion, alert-dialog, alert, avatar, badge, brand-mark, breadcrumb, button, card, carousel, checkbox, dialog, dropdown-menu, input, label, progress, radio-group, select, separator, sheet, skeleton, slider, sonner, switch, table, tabs, textarea, toaster

### Utilidad `cn()` (`src/lib/utils.ts`)

```ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 4. Tipografia

### Fuentes del UI

| Rol | Fuente | Carga | Pesos |
|---|---|---|---|
| Body text (`--font-sans`) | Inter | Google Fonts + `next/font/google` | 400, 500, 600, 700, 800 |
| Headings (`--font-heading`) | Inter | Misma instancia | 400, 500, 600, 700, 800 |
| Monospace (`--font-mono`) | JetBrains Mono | Google Fonts | 400, 500, 600 |

**Carga de Inter**: Doble estrategia — `next/font/google` para optimizacion automatica (variable CSS `--font-inter` en `<body>`) + Google Fonts `<link>` para los pesos especificos.

**Carga de fuentes del tema**: Si el tema activo define fuentes distintas, se cargan dinamicamente via Google Fonts (tanto SSR como client-side).

### Fuentes del Design Studio

12 fuentes locales en `public/fonts/` para el editor de disenos (usadas por `fabric-init.ts` y `composition-renderer.ts`):

Inter, Roboto, Montserrat, Playfair Display, Oswald, Lato, Pacifico, Dancing Script, Great Vibes, Caveat, Permanent Marker, Bebas Neue

Registradas en `src/lib/font-config.ts` como `FONT_FILES` (mapeo nombre -> archivo TTF).

### Escala tipografica

Definida via CSS reset en `globals.css`:

```css
h1, h2, h3, h4, h5, h6 {
  @apply font-bold tracking-tight;
  font-family: var(--font-heading);
}

p {
  @apply font-normal leading-relaxed;
}

body {
  @apply bg-background text-foreground leading-relaxed;
  font-family: var(--font-sans);
  font-feature-settings: "rlig" 1, "calt" 1;
}
```

No hay una escala tipografica custom definida con tamanios especificos (se usa la escala nativa de Tailwind: `text-xs` a `text-9xl`).

### OpenType features

`font-feature-settings: "rlig" 1, "calt" 1` — liga contextual y alternativas contextuales habilitadas en body.

---

## 5. Dark Mode

### Implementacion

- **Libreria**: `next-themes` (ThemeProvider)
- **Metodo**: Class-based (`attribute="class"`)
- **Default**: `"system"` (respeta `prefers-color-scheme` del OS)
- **Toggle**: `<ThemeToggle />` componente con iconos Sun/Moon
- **Transiciones**: `disableTransitionOnChange` activo (sin transicion de color al cambiar tema)

### Custom variant para Tailwind v4

```css
@custom-variant dark (&:is(.dark *));
```

Esto permite usar `dark:` prefix en Tailwind v4 con class-based dark mode.

### Flujo

1. `next-themes` agrega/quita la clase `.dark` en `<html>`
2. Las CSS variables en `.dark {}` sobreescriben las de `:root`
3. El bridge `@theme inline` propaga los valores a Tailwind utilities
4. `suppressHydrationWarning` en `<html>` previene warnings de hidratacion

### Meta theme-color

```html
<meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0a0a0b" media="(prefers-color-scheme: dark)" />
```

---

## 6. Sistema de Themes Dinamicos (Database-driven)

### Tabla `store_themes`

Almacena temas completos en Supabase con la estructura:

```ts
interface ThemeRow {
  css_variables: Record<string, string>;      // light mode variables
  css_variables_dark: Record<string, string>; // dark mode variables
  fonts: { heading: string; body: string; mono: string };
  border_radius: string;    // preset key
  shadow_preset: string;    // preset key
}
```

### Shadow presets

| Key | Valor |
|---|---|
| `none` | `none` |
| `small` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` |
| `subtle` | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` |
| `medium` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` |
| `large` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` |
| `extra_large` | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` |

### Radius presets

| Key | Valor |
|---|---|
| `none` | `0` |
| `small` | `0.375rem` |
| `medium` | `0.75rem` |
| `large` | `1rem` |
| `full` | `2rem` |

### Resolucion del tema

**Orden de prioridad** (tanto SSR como client):
1. Tema activo del tenant (si hay header `x-tenant-id`)
2. Tema activo global (`is_active = true, tenant_id IS NULL`)
3. Tema default (`is_default = true`)
4. Fallback hardcoded: slug `ocean-blue`

### Flujo SSR (zero FOUC)

1. `getActiveTheme()` en `[locale]/layout.tsx` — fetch con cache de 5 min (`unstable_cache`, tag `store-theme`)
2. `themeToInlineCSS()` genera CSS string con sanitizacion XSS
3. Se inyecta como `<style id="server-theme-style">` via `dangerouslySetInnerHTML`
4. Google Fonts URL se genera y carga como `<link rel="stylesheet">`

### Flujo client-side (ThemeLoader)

1. `<ThemeLoader />` se monta en `providers.tsx`
2. Llama `loadActiveTheme()` al montar (reemplaza el style tag server con uno dinamico)
3. Polling cada 5 minutos para detectar cambios del admin
4. El client-side fetch tambien carga branding overrides del tenant y los mergea

### Per-tenant branding overrides

`/api/storefront/branding` devuelve overrides del tenant desde `tenant_configs`:

- `primary_color`, `secondary_color`, `accent_color` — sobreescriben variables individuales
- `font_heading`, `font_body` — sobreescriben fuentes
- `css_overrides` — mapa JSONB arbitrario de CSS variables adicionales

### Revalidacion

- `POST /api/revalidate/theme` — invalida el cache SSR (requiere `REVALIDATION_SECRET` o `CRON_SECRET`)
- Llamado por el admin app despues de activar un tema
- Cache-Control de la API: `public, max-age=300` (5 min)

### Sanitizacion de seguridad

**Server-side** (`theme-server.ts`):
- Regex estricto: rechaza valores con `<`, `>`, `"`, `'`, `;`, `{`, `}`
- Rechaza palabras clave: `script`, `javascript`, `expression`, `url`
- Solo permite: `[a-zA-Z0-9#%(),.\s\-\/]`

**Client-side** (`theme-loader.ts`):
- Strip de caracteres: `[<>{};]`

---

## 7. Spacing & Layout Tokens

No hay tokens de spacing custom definidos. Se usa la escala nativa de Tailwind v4 (`p-1` a `p-96`, `gap-*`, `m-*`, etc.).

### Tokens de layout del tema neumorphic

Variables `--neu-*` definidas solo cuando el tema activo las proporciona (actualmente solo "Warm Slate"):

| Variable | Descripcion |
|---|---|
| `--neu-card-pad` | Padding de cards neumorphic |
| `--neu-border-w` | Ancho de borde |
| `--neu-card-radius` | Radio de cards |
| `--neu-image-radius` | Radio de imagenes |
| `--neu-image-bg` | Fondo de imagenes |
| `--neu-out` | Sombra outer (elevacion) |
| `--neu-in` | Sombra inner (hundido) |
| `--neu-btn` | Sombra de botones soft |
| `--neu-accent-glow` | Glow del boton accent |
| `--neu-accent-glow-hover` | Glow hover del accent |
| `--neu-hover-lift` | Transform de hover |
| `--neu-fav-bg` | Fondo del boton favorito |
| `--neu-input-radius` | Radio de inputs |
| `--grid-card-min` | Ancho minimo de card en grid (default 200px) |
| `--grid-gap` | Gap del grid (default 1rem) |

Todos tienen fallbacks con `var(..., default)` para degradar cuando el tema no provee neumorphism.

---

## 8. Clases Utilitarias Globales

Definidas en `globals.css`:

### Clases de superficie

| Clase | Descripcion |
|---|---|
| `.glass-panel` | `bg-card/80 backdrop-blur-xl border border-border rounded-2xl shadow-sm` |

### Clases neumorphic

| Clase | Uso |
|---|---|
| `.neu-card` | Cards con sombra outer y bordes |
| `.neu-image` | Contenedor de imagen con sombra inner (pseudo `::after`) |
| `.neu-btn-accent` | Boton accent con glow y lift en hover |
| `.neu-btn-soft` | Boton suave con sombra |
| `.neu-fav` | Boton favorito |
| `.neu-input` | Input con sombra inner |
| `.neu-chip` | Chip/tag con sombra |
| `.neu-chip-active` | Chip activo con glow |
| `.neu-grid` | Grid responsive con `auto-fill` y minmax |

**Componentes que usan clases neumorphic** (20 archivos): ProductCard, ProductGrid, ProductDetailClient, ProductCardSkeleton, ShopPageClient, ShopCategoryLanding, CategoryCard, CategoryCardSkeleton, CategoryGrid, WishlistPage, y todos los Artifacts (ProductGrid, ProductDetail, OrderTimeline, OrderList, CartSummary, ApprovalCard, DesignPreview, ProductMockup), LandingPageClient.

### Clases de gradiente

| Clase | Descripcion |
|---|---|
| `.gen-gradient` | Gradiente lineal 135deg de chart-1 a chart-2 |
| `.gen-gradient-text` | Texto con gradiente (background-clip) |
| `.landing-gradient-text` | Texto animado con gradiente multi-color (8s loop) |

### Clases de landing

| Clase | Descripcion |
|---|---|
| `.shader-fade-bottom` | Gradiente transparente a background (fade inferior) |
| `.landing-float` | Animacion de flotacion vertical (4s loop, 6px) |
| `.steps-connector` | Linea conectora horizontal entre steps (hidden en mobile) |

### Clases de scroll

| Clase | Descripcion |
|---|---|
| `.detail-scroll` | Scrollbar thin custom (5px, 8% foreground opacity) |
| `.tab-scroll` | Scrollbar oculto para tabs horizontales |
| `scrollbar-hide` | Utility `@utility` para ocultar scrollbar |

### Sparkle text

`.sparkle-text` — Texto con gradiente animado shimmer (3s loop, foreground/primary alternado).

---

## 9. Animaciones

### CSS Animations (globals.css)

| Keyframe | Duracion | Uso |
|---|---|---|
| `sparkle` | 3s linear infinite | `.sparkle-text` — shimmer en greeting del chat |
| `landing-gradient` | 8s ease infinite | `.landing-gradient-text` — gradiente animado en hero |
| `landing-float-kf` | 4s ease-in-out infinite | `.landing-float` — flotacion vertical sutil |

### Motion library (framer-motion v12)

**Paquete**: `motion` v12.35.1 (rebrand de framer-motion)

**Componentes que usan motion**:
- `LandingPageClient.tsx` — scroll parallax (`useScroll`, `useTransform`, `useSpring`), fade-in animations
- `TextReveal.tsx` — word-by-word clip-path reveal
- `NewsletterSignup.tsx` — fade/scale entrance
- `Testimonials.tsx` — carousel con drag y spring physics

**Variantes compartidas** (`src/hooks/useMotionConfig.ts`):

| Variante | Efecto | Easing |
|---|---|---|
| `FADE_UP` | Opacity 0->1, Y 40->0 | `[0.16, 1, 0.3, 1]` (0.7s) |
| `STAGGER_CONTAINER` | Stagger children 0.12s | - |
| `STAGGER_ITEM` | Opacity 0->1, Y 30->0 | `[0.16, 1, 0.3, 1]` (0.6s) |
| `SCALE_IN` | Opacity 0->1, Scale 0.9->1 | `[0.16, 1, 0.3, 1]` (0.5s) |
| `WORD_REVEAL` | Clip-path inset reveal | `[0.16, 1, 0.3, 1]` (0.5s) |

Easing compartido: `[0.16, 1, 0.3, 1]` — curva "ease-out-expo" custom.

### CSS Transitions en clases neumorphic

- `.neu-btn-accent`: `transition: all 0.2s ease`
- `.neu-btn-soft`: `transition: all 0.2s ease`

### Reduced motion

- **CSS**: `@media (prefers-reduced-motion: reduce)` deshabilita `landing-gradient-text` y `landing-float`
- **Motion library**: `useReducedMotion()` hook usado en LandingPageClient, TextReveal, NewsletterSignup, Testimonials
- **MetaballsBackground**: `window.matchMedia('(prefers-reduced-motion: reduce)')` para skip del canvas animation

### View Transitions (React 19)

Deshabilitadas explicitamente. Comentario en globals.css: la transicion cross-fade de 300ms causaba ghosting visible entre rutas.

---

## 10. Manejo de Imagenes

### next/image config (`next.config.ts`)

**Remote patterns permitidos**:

| Hostname | Uso |
|---|---|
| `images.printify.com` | Mockups de productos Printify |
| `images-api.printify.com` | API de imagenes Printify |
| `*.supabase.co` | Storage de Supabase (wildcard) |
| `via.placeholder.com` | Placeholders de desarrollo |
| `placehold.co` | Placeholders de desarrollo |
| `*.fal.ai` | Imagenes generadas por fal.ai |
| `fal.media` | CDN de fal.ai |
| `images.unsplash.com` | Fotos de stock Unsplash |
| `pfy-prod-image-storage.s3.us-east-2.amazonaws.com` | Storage S3 de Printify |
| `files.cdn.printful.com` | CDN de Printful |

Todos requieren protocolo `https`.

### Content Security Policy para imagenes

```
img-src 'self' data: blob: https://images.printify.com https://images-api.printify.com
  https://pfy-prod-image-storage.s3.us-east-2.amazonaws.com https://*.supabase.co
  https://via.placeholder.com https://placehold.co https://*.fal.ai https://fal.media
  https://images.unsplash.com https://files.cdn.printful.com
```

### Uso de next/image

30+ componentes usan `next/image` (import `Image` from `next/image`), incluyendo: ProductCard, ProductDetailClient, StorefrontSidebar, LandingPageClient, ChatMessages, DesignStudioPage, CategoryLanding, etc.

No hay configuracion custom de formatos o tamanios en `next.config.ts` — se usan los defaults de Next.js (auto WebP/AVIF optimization).

---

## 11. Brand Assets

### Directorio: `public/brand/`

#### Logos SVG (4 variantes)

| Archivo | Uso |
|---|---|
| `skapara-mark-color.svg` (4.4KB) | S mark a color (gradiente) |
| `skapara-mark-dark.svg` (4.0KB) | S mark oscuro (para fondos claros) |
| `skapara-mark-white.svg` (4.0KB) | S mark blanco (para fondos oscuros) |
| `skapara-wordmark-dark.svg` (3.9KB) | Wordmark "SKAPARA" oscuro |
| `skapara-wordmark-white.svg` (3.9KB) | Wordmark "SKAPARA" blanco |

#### PWA / Favicon

| Archivo | Tamano | Uso |
|---|---|---|
| `favicon.ico` | public root | Favicon clasico (tambien existe en `public/brand/`) |
| `favicon-16.png` (1.7KB) | 16x16 | Favicon pequeno |
| `favicon-32.png` (3.2KB) | 32x32 | Favicon estandar |
| `apple-touch-icon.png` (12KB) | 180x180 | iOS home screen icon |
| `icon-192.png` (13KB) | 192x192 | PWA icon (maskable) |
| `icon-512.png` (61KB) | 512x512 | PWA splash icon (maskable) |

#### OG / Social

| Archivo | Tamano | Uso |
|---|---|---|
| `og-image.png` (28KB) | 1200x630 | Open Graph / Twitter card |

#### Print / Product Design

| Archivo | Tamano | Uso |
|---|---|---|
| `back-wordmark-1800x2400-NEW.png` (29KB) | 1800x2400 | Wordmark para parte trasera de prendas |
| `label-outside-wordmark-450x450.png` (5.8KB) | 450x450 | Label exterior con wordmark |
| `logo-mark-dark.png` (9.7KB) | - | Logo mark rasterizado oscuro |
| `logo-mark-white.png` (8.1KB) | - | Logo mark rasterizado blanco |
| `dangerous-flag-back-mockup.png` (311KB) | - | Mockup de diseno de bandera |
| `termina-bold-test.png` (314KB) | - | Test de fuente Termina Bold |

### PWA Manifest (`src/app/manifest.ts`)

```ts
theme_color: '#09090b'
background_color: '#09090b'
display: 'standalone'
orientation: 'portrait-primary'
```

Iconos referenciados: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.

---

## 12. Base Resets

Aplicados globalmente en `globals.css`:

```css
* { @apply border-border; }

body {
  @apply bg-background text-foreground leading-relaxed;
  font-family: var(--font-sans);
  font-feature-settings: "rlig" 1, "calt" 1;
}

code, pre, kbd, samp {
  font-family: var(--font-mono);
}
```

---

## 13. Resumen del tema default (Warm Slate)

El tema por defecto se describe en el comentario como "Warm Slate" con las siguientes caracteristicas:

- **Acento**: Burnt orange (`oklch(0.58 0.19 38)`)
- **Superficies**: Cool gray-blue (hue 260 en OKLCH)
- **Color space**: OKLCH (perceptually uniform, mas preciso que HSL)
- **Contraste light**: Background muy claro (0.93 L) vs foreground oscuro (0.30 L)
- **Contraste dark**: Background oscuro (0.20 L) vs foreground claro (0.93 L)
- **Neumorphism**: Preparado pero solo activo si el tema provee variables `--neu-*`
- **Border radius**: 1rem (16px) por defecto, con derivaciones sm/md/lg/xl
- **Sombras**: Preset "medium" por defecto
