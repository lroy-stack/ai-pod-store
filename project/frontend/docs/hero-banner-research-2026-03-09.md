# Hero Banner Research — Next.js 16 + Tailwind v4 + Motion v12 + Dynamic Themes

**Fecha**: 2026-03-09
**Contexto**: Investigacion para hero banners con SSR, animaciones de entrada, temas dinamicos desde DB

---

## 1. motion/react v12 — SSR y el problema de `initial={{ opacity: 0 }}`

### El problema confirmado

**Si. `motion.div` con `initial={{ opacity: 0 }}` renderiza `style="opacity: 0"` como atributo inline en el HTML del servidor.** Esto tiene consecuencias directas:

1. **Contenido invisible en el HTML del servidor**: El servidor emite `<div style="opacity: 0; transform: translateY(100px)">...</div>`. El contenido existe en el DOM pero es invisible.
2. **SEO**: El contenido es indexable (esta en el DOM), pero Google podria penalizarlo como contenido oculto si la animacion nunca se ejecuta.
3. **JavaScript deshabilitado**: Si el usuario tiene JS deshabilitado, el contenido **queda permanentemente invisible** porque la animacion de `animate` nunca se ejecuta.
4. **CSP (Content Security Policy)**: Politicas estrictas de CSP pueden bloquear los estilos inline generados por el servidor, causando errores de seguridad.
5. **Hydration mismatch**: El `data-projection-id` puede diferir entre servidor y cliente, causando warnings en consola.

**Fuentes**:
- [Motion discussions #1792 — JS disabled behavior](https://github.com/motiondivision/motion/discussions/1792)
- [Motion issues #1727 — CSP blocks inline styles](https://github.com/motiondivision/motion/issues/1727)
- [Motion discussions #3184 — Next.js SSR questions](https://github.com/motiondivision/motion/discussions/3184)
- [Motion issues #2668 — React 19 compatibility](https://github.com/framer/motion/issues/2668)

### Compatibilidad React 19

**React 19 es totalmente compatible** con motion/react v12. El React Compiler puede auto-memoizar componentes de animacion. Funciona correctamente con `<Suspense>` boundaries y streaming SSR.

**Fuente**: [Framer Motion Complete Guide 2026](https://inhaq.com/blog/framer-motion-complete-guide-react-nextjs-developers.html)

### El patron correcto para animaciones de entrada en SSR

#### Opcion A: `initial={false}` — Saltar la animacion de entrada (mas seguro)

```tsx
<motion.div
  initial={false}  // Renderiza directamente con los valores de animate
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  Contenido visible desde el servidor
</motion.div>
```

**Comportamiento**: El servidor renderiza el estado de `animate` directamente. No hay flash. No hay contenido invisible. El trade-off es que pierdes la animacion de entrada.

**Fuente**: [Motion docs — React motion component](https://motion.dev/docs/react-motion-component)

#### Opcion B: Wrapper `"use client"` con `useIsMounted` (recomendado para animaciones)

```tsx
'use client'
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'

function AnimatedEntry({ children, ...animationProps }) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    // En servidor y primera renderizacion: contenido visible, sin animacion
    return <div>{children}</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      {...animationProps}
    >
      {children}
    </motion.div>
  )
}
```

**Comportamiento**: El servidor renderiza contenido visible. Tras hydration, se monta el motion.div y la animacion se ejecuta. No hay flash de contenido invisible.

#### Opcion C: Noscript CSS fallback

```tsx
// En el <head> del layout
<noscript>
  <style>{`.motion-animated { opacity: 1 !important; transform: none !important; }`}</style>
</noscript>
```

**Comportamiento**: Si JS esta deshabilitado, los estilos inline de `initial` se sobreescriben con `!important`. No es ideal pero funciona como safety net.

**Fuente**: [Motion discussions #1792](https://github.com/motiondivision/motion/discussions/1792)

#### Opcion D: CSS animations en lugar de motion initial (mejor para LCP)

```tsx
// Sin motion para el estado inicial — CSS puro
<div className="animate-fade-in-up">
  {children}
</div>
```

```css
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fade-in-up 0.6s ease-out both;
}
```

**Comportamiento**: El servidor renderiza el contenido visible (sin inline styles). La animacion CSS se ejecuta automaticamente. Compatible con JS deshabilitado via `prefers-reduced-motion`. Mejor para LCP del hero.

### Patron de wrapper para Server Components

El patron oficial recomendado por Matt Perry (maintainer):

```tsx
// components/motion.tsx
'use client'
import { motion } from 'motion/react'
export const MotionDiv = motion.div
export const MotionSpan = motion.span
export const MotionSection = motion.section
```

```tsx
// page.tsx (Server Component)
import { MotionDiv } from '@/components/motion'

export default async function Page() {
  const data = await fetchFromDB()
  return (
    <MotionDiv animate={{ opacity: 1 }}>
      {data.title}
    </MotionDiv>
  )
}
```

**Fuentes**:
- [How to use Framer Motion with Next.js Server Components](https://www.hemantasundaray.com/blog/use-framer-motion-with-nextjs-server-components)
- [Medium — Resolving Framer Motion Compatibility in Next.js](https://medium.com/@dolce-emmy/resolving-framer-motion-compatibility-in-next-js-14-the-use-client-workaround-1ec82e5a0c75)

### Optimizacion de bundle

```tsx
import { LazyMotion, domAnimation, m } from 'motion/react'

// En el layout o wrapper
<LazyMotion features={domAnimation}>
  {children}
</LazyMotion>

// En componentes (m en lugar de motion)
<m.div animate={{ opacity: 1 }}>...</m.div>
```

**Impacto**: De ~30-50kb gzipped (full) a ~15kb (domAnimation) o ~27kb (domMax con layout + drag).

**IMPORTANTE**: `<m.div>` NO anima si no hay un `<LazyMotion>` arriba en el arbol.

**Fuente**: [Framer Motion Complete Guide 2026](https://inhaq.com/blog/framer-motion-complete-guide-react-nextjs-developers.html)

---

## 2. Tailwind CSS v4 — `@theme inline` y colores por defecto

### Lo que hace `@theme inline`

`@theme inline` genera utilidades Tailwind donde el valor CSS usa el **valor resuelto** de la variable, no una referencia a ella. Es especificamente para cuando defines variables que **referencian otras variables**.

```css
/* SIN inline: genera --tw-color: var(--color-background) */
@theme {
  --color-background: var(--background);
}

/* CON inline: genera el valor resuelto directamente */
@theme inline {
  --color-background: var(--background);
}
```

**`@theme inline` NO elimina colores por defecto.** No tiene nada que ver con eliminar o preservar `black`, `white`, etc.

### Lo que SI elimina colores: `--color-*: initial`

```css
@theme {
  --color-*: initial;  /* PELIGRO: Elimina TODOS los colores por defecto */
  --color-white: #fff; /* Solo disponible si lo redeclaras */
}
```

**Consecuencias**:
- `text-white` NO funciona a menos que redeclares `--color-white: #fff`
- `bg-black` NO funciona a menos que redeclares `--color-black: #000`
- `from-black/75` NO funciona sin `--color-black`
- Todos los colores de la paleta (red, blue, gray, etc.) desaparecen

### Estado actual del proyecto

Revisando `globals.css` del proyecto: **El proyecto NO usa `--color-*: initial`**. Solo usa `@theme inline` para mapear variables semanticas. Esto significa que:

- `text-white` FUNCIONA (color por defecto preservado)
- `bg-black` FUNCIONA
- `from-black/75` FUNCIONA

No hay problema con los colores por defecto en la configuracion actual.

### Pattern correcto para temas dinamicos con `@theme inline`

```css
/* Paso 1: Variables reales en :root (sobreescribibles por JS/DB) */
:root {
  --background: oklch(0.93 0.008 260);
  --foreground: oklch(0.30 0.025 255);
  --primary: oklch(0.55 0.17 75);
}

.dark {
  --background: oklch(0.13 0.008 260);
  --foreground: oklch(0.92 0.005 260);
}

/* Paso 2: Bridge reactivo a utilidades Tailwind */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
}
```

**Por que funciona**: Al cambiar `--background` en runtime (via JS que carga tema de DB), `bg-background` automaticamente refleja el nuevo valor porque `@theme inline` referencia `var(--background)`.

**Fuentes**:
- [Tailwind CSS v4 Theme Variables docs](https://tailwindcss.com/docs/theme)
- [Tailwind CSS v4 Colors docs](https://tailwindcss.com/docs/customizing-colors)
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcnblocks — Tailwind 4 Theming](https://www.shadcnblocks.com/blog/tailwind4-shadcn-themeing/)
- [GitHub Discussion #18471 — Theming best practices](https://github.com/tailwindlabs/tailwindcss/discussions/18471)
- [GitHub Discussion #18560 — @theme vs @theme inline](https://github.com/tailwindlabs/tailwindcss/discussions/18560)
- [GitHub Discussion #15095 — Disable default colors](https://github.com/tailwindlabs/tailwindcss/discussions/15095)

### Tabla resumen

| Approach | Colores por defecto | Colores custom | Caso de uso |
|---|---|---|---|
| `@theme` (sin inline) | Preservados | Agregados | Extender tema con valores fijos |
| `@theme inline` | Preservados | Agregados (resueltos) | Temas dinamicos con CSS variables |
| `@theme { --color-*: initial }` | ELIMINADOS | Solo custom | Rediseno completo de paleta |
| `@theme { --*: initial }` | ELIMINADOS | Solo custom | Reset total del tema |

---

## 3. Hero Banner — Arquitectura para temas dinamicos desde DB

### Patron recomendado: Server Component + Client Islands

```
page.tsx (Server Component)
├── fetch campaign data from DB
├── inject CSS custom properties via style prop
└── render <HeroClient campaign={data} />
    ├── 'use client'
    ├── motion/react animations
    └── Responsive layout with Tailwind semantic tokens
```

#### Paso 1: Fetch en Server Component

```tsx
// app/[locale]/(landing)/page.tsx
export default async function LandingPage({ params }: Props) {
  const campaign = await getCampaignFromDB()

  return (
    <main>
      {/* Inyectar tema de campana como CSS vars en el scope */}
      {campaign?.theme && (
        <div style={campaignThemeToVars(campaign.theme)}>
          <HeroSection campaign={campaign} locale={params.locale} />
        </div>
      )}
    </main>
  )
}

function campaignThemeToVars(theme: CampaignTheme): React.CSSProperties {
  return {
    '--campaign-accent': theme.accentColor,
    '--campaign-bg': theme.backgroundColor,
    '--campaign-text': theme.textColor,
  } as React.CSSProperties
}
```

#### Paso 2: Hero como Client Component con animaciones

```tsx
'use client'

export function HeroSection({ campaign, locale }: HeroSectionProps) {
  // Usa semantic tokens de Tailwind, NO colores hardcodeados
  // Los tokens se resuelven a las CSS vars del tema activo
  return (
    <section className="bg-background text-foreground">
      {/* Animaciones via motion/react */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {campaign.title}
      </motion.h1>
    </section>
  )
}
```

#### Paso 3: Theme switching por campana

```tsx
// Cargar tema de campana desde DB y aplicar como CSS vars
useEffect(() => {
  if (campaign?.theme_overrides) {
    const root = document.documentElement
    Object.entries(campaign.theme_overrides).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value as string)
    })
    return () => {
      // Restaurar defaults al desmontar
      Object.keys(campaign.theme_overrides).forEach((key) => {
        root.style.removeProperty(`--${key}`)
      })
    }
  }
}, [campaign])
```

### Caching de campanas

```tsx
// fetch con revalidation
const campaign = await fetch(`${BASE_URL}/api/campaigns/active`, {
  next: { revalidate: 300 } // 5 min cache
}).then(r => r.json())

// O con tag-based revalidation
const campaign = await fetch(url, {
  next: { tags: ['campaign-hero'] }
})
// Invalidar: revalidateTag('campaign-hero')
```

**Fuentes**:
- [Next.js 15 App Router patterns](https://medium.com/@livenapps/next-js-15-app-router-a-complete-senior-level-guide-0554a2b820f7)
- [React Server Components in practice](https://medium.com/@vyakymenko/react-server-components-in-practice-next-js-d1c3c8a4971f)
- [GitHub — hero-banners configurable](https://github.com/rajiv-coding/hero-banners)
- [Next.js Best Practices 2025](https://www.raftlabs.com/blog/building-with-next-js-best-practices-and-benefits-for-performance-first-teams/)

---

## 4. Analisis del HeroSection actual del proyecto

### Problemas detectados

Revisando `/frontend/src/components/landing/HeroSection.tsx`:

1. **`initial={{ opacity: 0 }}` en multiples elementos**: El brand mark, subtitle, CTA button, sub-CTA text, y product image todos usan `initial` con `opacity: 0`. El servidor renderiza HTML con `style="opacity: 0"` — contenido invisible hasta que JS ejecuta.

2. **Title con `initial={{ y: '110%' }}`**: Las palabras del titulo estan completamente fuera del viewport en el HTML del servidor.

3. **JS deshabilitado = hero completamente invisible**: Sin JavaScript, el usuario ve una seccion vacia.

4. **LCP impact**: El Largest Contentful Paint no puede medir un elemento con `opacity: 0`. La animacion de entrada retrasa el LCP real.

5. **Delays acumulados**: El ultimo elemento (sub-CTA) tiene `delay: 1.35s`. Eso son 1.35 segundos donde el contenido ya esta en el DOM pero invisible.

### Recomendaciones

| Aspecto | Estado actual | Recomendacion |
|---|---|---|
| Hero title | `initial={{ y: '110%' }}` invisible en SSR | Usar CSS animation o `initial={false}` |
| Brand mark | `initial={{ opacity: 0 }}` | CSS fade-in o quitar animacion |
| CTA button | `initial={{ opacity: 0, scale: 0.85 }}` | Mantener pero con delay menor |
| Product image | `initial={{ opacity: 0, y: 100 }}` | `initial={false}` para LCP |
| Noscript fallback | No existe | Agregar CSS override |
| LazyMotion | No implementado | Implementar para reducir bundle |

---

## 5. Resumen ejecutivo

| Pregunta | Respuesta |
|---|---|
| motion.div con initial causa problemas SSR? | **Si** — renderiza inline `style="opacity:0"` en HTML del servidor. Contenido invisible con JS deshabilitado. |
| Patron correcto para animaciones de entrada SSR? | **Opcion A**: `initial={false}` (seguro, sin animacion). **Opcion B**: CSS animations (compatible SSR). **Opcion C**: `useIsMounted` wrapper (animacion solo post-hydration). |
| `@theme inline` elimina colores como white/black? | **No.** Solo cambia como se resuelven las variables. `--color-*: initial` es lo que elimina colores. |
| Como afecta a text-white, from-black/75? | **No les afecta.** El proyecto actual NO usa `--color-*: initial`, asi que todos los colores por defecto funcionan. |
| Estructura hero con datos de campana DB? | **Server Component** fetches data + inyecta CSS vars de tema → **Client Component** renderiza con motion/react + semantic tokens. |
