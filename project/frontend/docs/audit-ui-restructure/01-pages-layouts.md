# Arquitectura de Paginas y Layouts — Frontend Next.js

> Fecha: 2026-03-08
> Directorio base: `frontend/src/app/`
> Framework: Next.js 16.1.6, App Router, i18n via next-intl

---

## 1. Composicion de Layouts (arbol completo)

```
src/app/layout.tsx                          (Root Layout — pass-through)
  [locale]/layout.tsx                       (Locale Layout — <html>, <body>, Providers)
    [locale]/providers.tsx                  (Provider tree — wraps ALL route groups)
      (landing)/layout.tsx                  (Landing — minimal, 'use client')
        (landing)/page.tsx                  (Landing page = /)
      (app)/layout.tsx                      (App shell — StorefrontLayout wrapper)
        (app)/chat/page.tsx
        (app)/shop/page.tsx
        (app)/shop/[id]/page.tsx
        (app)/shop/category/[slug]/page.tsx
        (app)/cart/page.tsx
        (app)/orders/page.tsx
        (app)/orders/[id]/page.tsx
        (app)/profile/page.tsx
        (app)/wishlist/page.tsx
        (app)/wishlist/shared/[token]/page.tsx
        (app)/designs/page.tsx
        (app)/pricing/page.tsx
        (app)/blog/page.tsx
        (app)/blog/[slug]/page.tsx
        (app)/referrals/page.tsx
        (app)/settings/billing/page.tsx
        (app)/offline/page.tsx
      (focused)/layout.tsx                  (Focused — AuthBackground + FocusedFooter)
        (focused)/auth/login/page.tsx
        (focused)/auth/register/page.tsx
        (focused)/auth/forgot-password/page.tsx
        (focused)/auth/reset-password/page.tsx
        (focused)/auth/verify-email/page.tsx
        (focused)/auth/callback/page.tsx
        (focused)/checkout/page.tsx
        (focused)/checkout/success/page.tsx
        (focused)/checkout/cancel/page.tsx
        (focused)/terms/page.tsx
        (focused)/privacy/page.tsx
        (focused)/shipping/page.tsx
        (focused)/returns/page.tsx
        (focused)/faq/page.tsx
        (focused)/about/page.tsx
        (focused)/contact/page.tsx
        (focused)/cookies/page.tsx
        (focused)/size-guide/page.tsx
        (focused)/legal/page.tsx
      (editor)/layout.tsx                   (Editor — full-screen, no chrome)
        (editor)/design/[productId]/page.tsx
    [locale]/profile/notifications/         (FUERA de route groups — sin layout de grupo)
      layout.tsx                            (solo metadata)
      page.tsx
```

**NOTA**: `[locale]/profile/notifications/` esta FUERA de cualquier route group. No hereda `(app)/layout.tsx` ni ningun otro group layout. Solo tiene el locale layout como padre.

---

## 2. Root Layout

**Archivo**: `src/app/layout.tsx`

```tsx
export default function RootLayout({ children }) {
  return children  // Pass-through puro
}
```

- Solo exporta `metadata` (titulo y descripcion genericos).
- NO renderiza `<html>` ni `<body>` — eso lo hace el locale layout.
- Existe porque Next.js lo requiere, pero es un noop funcional.

---

## 3. Locale Layout

**Archivo**: `src/app/[locale]/layout.tsx`

### Responsabilidades

1. Renderiza `<html lang={locale}>` y `<body className={inter.variable}>`
2. Genera `metadata` dinamica (SEO) con `generateMetadata()` — titulos/descripciones por locale desde `getBrandConfig()`
3. Inyecta CSS de tema inline para evitar FOUC: `<style id="server-theme-style">`
4. Carga Google Fonts (Inter por defecto, configurable via theme)
5. Incluye PWA links: `manifest.webmanifest`, `theme-color`, `apple-mobile-web-app-*`
6. Wrappea children con `<Providers params={params}>`
7. Genera static params para 3 locales: `['en', 'es', 'de']`

### Imports clave

- `Inter` de `next/font/google`
- `getActiveTheme, themeToInlineCSS, themeGoogleFontsURL` de `@/lib/theme-server`
- `getBrandConfig` de `@/lib/brand-config-server`
- `globals.css`

---

## 4. Providers

**Archivo**: `src/app/[locale]/providers.tsx`

### Arbol de providers (de exterior a interior)

```
<Suspense fallback={<div min-h-dvh bg-background />}>
  <NextIntlClientProvider messages={messages} locale={locale}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <CartProvider>
        <WishlistProvider>
          <DesignProvider>
            <ErrorBoundary>
              <ServiceWorkerRegistration />
              <ThemeLoader />
              {children}
              <Toaster />
              <CommandPalette />
              <CookieConsent />
            </ErrorBoundary>
          </DesignProvider>
        </WishlistProvider>
      </CartProvider>
    </ThemeProvider>
  </NextIntlClientProvider>
</Suspense>
```

### Detalles

- Valida locale contra `['en', 'es', 'de']` — llama `notFound()` si invalido.
- Carga mensajes i18n con `getMessages({ locale })`.
- `Suspense` wrappea todo el contenido async con fallback visual minimo.
- Componentes globales renderizados en TODAS las paginas:
  - `ServiceWorkerRegistration` — registra SW para PWA
  - `ThemeLoader` — sincroniza tema desde DB
  - `Toaster` — notificaciones toast (sonner)
  - `CommandPalette` — Cmd+K palette
  - `CookieConsent` — banner GDPR

---

## 5. Route Groups

### 5.1 `(landing)` — Landing Page

**Layout**: `src/app/[locale]/(landing)/layout.tsx`

```tsx
'use client'

export default function LandingLayout({ children }) {
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only ...">
        {t('skipToContent')}
      </a>
      <main id="main-content" className="min-h-dvh bg-background text-foreground overflow-x-hidden">
        {children}
      </main>
    </>
  )
}
```

- **'use client'** — necesario para `useTranslations`.
- NO tiene sidebar, header, ni StorefrontLayout.
- Clases: `min-h-dvh bg-background text-foreground overflow-x-hidden`
- Skip-to-content link para accesibilidad.

#### Paginas

| Ruta URL | Archivo | Server/Client | Componente principal | Descripcion |
|---|---|---|---|---|
| `/{locale}/` | `(landing)/page.tsx` | Server | `LandingPageClient` + `Footer` | Landing con hero, carousel de productos, reviews, JSON-LD schema |

**Props que recibe `LandingPageClient`**: `locale`, `initialProducts` (12 productos SSR), `reviews` (6 reviews localizadas), `totalOrders`, `averageRating`.

**Datos SSR**: Fetch paralelo con `Promise.all()` — productos (12, ordenados por temporada), reviews aprobadas, count de ordenes pagadas, promedio de ratings. Usa `supabaseAdmin` (bypass RLS).

---

### 5.2 `(app)` — App Shell (Storefront)

**Layout**: `src/app/[locale]/(app)/layout.tsx`

```tsx
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout'

export default function AppShellLayout({ children }) {
  return <StorefrontLayout>{children}</StorefrontLayout>
}
```

- Wrapper directo a `StorefrontLayout`.
- NO tiene metadata propia (hereda del locale layout).
- NO tiene `page.tsx` en su raiz — el route group `(app)` NO tiene index page.

#### Sub-layouts (solo metadata)

Los siguientes directorios tienen `layout.tsx` que solo generan metadata SEO y pasan `children` directamente:

| Directorio | Layout | Metadata |
|---|---|---|
| `(app)/offline/` | `generateMetadata` con titulo/desc estaticos | No indexable |
| `(app)/pricing/` | `generateMetadata` con traducciones i18n `pricing` | SEO con alternates |
| `(app)/wishlist/` | `generateMetadata` con traducciones i18n `wishlist` | SEO con alternates |
| `(app)/wishlist/shared/[token]/` | `generateMetadata` estatico "Shared Wishlist" | SEO con alternates |

#### Paginas del route group `(app)`

| Ruta URL | Archivo | Server/Client | Componente principal | Notas |
|---|---|---|---|---|
| `/{locale}/chat` | `chat/page.tsx` | Server (retorna null) | Ninguno (ChatArea vive en StorefrontLayout) | Metadata i18n. La pagina renderiza `null`. |
| `/{locale}/shop` | `shop/page.tsx` | Server | `ShopCategoryLanding` o `ShopPageClient` | Modo dual: si no hay query `?q=` muestra landing de categorias; si hay query muestra resultados. ISR 300s. |
| `/{locale}/shop/{id}` | `shop/[id]/page.tsx` | Server | `ProductDetailClient` | PDP con ISR 3600s. `generateStaticParams` para top 50 productos x 3 locales. JSON-LD Product + BreadcrumbList. |
| `/{locale}/shop/category/{slug}` | `shop/category/[slug]/page.tsx` | Server | `ShopPageClient` | Categoria con subcategorias, breadcrumbs. ISR 600s. `generateStaticParams` desde DB. |
| `/{locale}/cart` | `cart/page.tsx` | Server | `CartView` | Props: `locale`. Wrapper con padding responsive. |
| `/{locale}/orders` | `orders/page.tsx` | Server | `OrdersView` | Props: `locale`. Wrapper con padding responsive. |
| `/{locale}/orders/{id}` | `orders/[id]/page.tsx` | Server | `OrderDetailView` | Props: `locale`, `orderId`. |
| `/{locale}/profile` | `profile/page.tsx` | Server | `ProfilePageClient` | Props: `locale`. |
| `/{locale}/wishlist` | `wishlist/page.tsx` | Client ('use client') | Componente inline (no extraido) | Modo dual: guest (localStorage) vs auth (server wishlists). Usa `useAuth`, `useWishlist`. |
| `/{locale}/wishlist/shared/{token}` | `wishlist/shared/[token]/page.tsx` | Client ('use client') | Componente inline | Fetch de wishlist publica via API. |
| `/{locale}/designs` | `designs/page.tsx` | Server | `DesignsGallery` (colocated) | Galeria de disenos del usuario. |
| `/{locale}/pricing` | `pricing/page.tsx` | Client ('use client') | Componente inline | Tiers (Free/Premium) + Credit Packs. Usa `useAuth`. |
| `/{locale}/blog` | `blog/page.tsx` | Server | Componente inline | Lista de blog posts desde `blog_posts` table. |
| `/{locale}/blog/{slug}` | `blog/[slug]/page.tsx` | Server | Componente inline + `SafeMarkdown` | Blog post individual. Incrementa view count en render. JSON-LD Article. |
| `/{locale}/referrals` | `referrals/page.tsx` | Server | Componente inline + `CopyButton` (colocated) | Requiere auth (redirect si no hay cookie). Stats de referidos. |
| `/{locale}/settings/billing` | `settings/billing/page.tsx` | Server | `BillingSettings` | Dentro de Card wrapper. Props: `locale`. |
| `/{locale}/offline` | `offline/page.tsx` | Client ('use client') | Componente inline | Productos cacheados desde IndexedDB. Boton retry. |

---

### 5.3 `(focused)` — Paginas Focalizadas (sin sidebar)

**Layout**: `src/app/[locale]/(focused)/layout.tsx`

```tsx
export default function FocusedLayout({ children }) {
  return (
    <div className="relative min-h-dvh bg-background">
      <AuthBackground />
      <div className="relative z-10 flex min-h-dvh flex-col items-center px-4 py-6 md:py-10">
        <div className="my-auto w-full">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
        <FocusedFooter />
      </div>
    </div>
  )
}
```

- `AuthBackground` — componente decorativo de fondo (animacion/gradiente).
- Contenido centrado verticalmente (`my-auto`).
- Padding responsive: `py-6` mobile, `md:py-10` desktop.
- `FocusedFooter` al fondo.
- `ErrorBoundary` wrappea el contenido.
- NO tiene sidebar, header, ni StorefrontLayout.

#### Sub-layout

| Directorio | Layout | Detalle |
|---|---|---|
| `(focused)/auth/callback/` | `layout.tsx` | Solo metadata. `robots: { index: false }`. |

#### Paginas del route group `(focused)`

**Paginas Auth** — Todas siguen el mismo patron visual:

```tsx
<div className="mx-auto max-w-md flex flex-col items-center">
  <Link href={`/${locale}/`}><BrandMark size={48} /></Link>
  <Card className="w-full bg-card/80 backdrop-blur-xl border-border/60 shadow-xl">
    <CardContent className="pt-6">
      <FormComponent locale={locale} />
    </CardContent>
  </Card>
</div>
```

| Ruta URL | Archivo | Server/Client | Componente en Card | Notas |
|---|---|---|---|---|
| `/{locale}/auth/login` | `auth/login/page.tsx` | Server | `LoginForm` | BrandMark link a home |
| `/{locale}/auth/register` | `auth/register/page.tsx` | Server | `RegisterForm` | CardContent con `px-4 md:px-6` |
| `/{locale}/auth/forgot-password` | `auth/forgot-password/page.tsx` | Server | `ForgotPasswordForm` | |
| `/{locale}/auth/reset-password` | `auth/reset-password/page.tsx` | Server | `ResetPasswordForm` | |
| `/{locale}/auth/verify-email` | `auth/verify-email/page.tsx` | Server | `EmailVerificationHandler` | |
| `/{locale}/auth/callback` | `auth/callback/page.tsx` | Client ('use client') | Componente inline | OAuth callback. Auto-redirect. Session migration. |

**Paginas Checkout**

| Ruta URL | Archivo | Server/Client | Componente principal | Notas |
|---|---|---|---|---|
| `/{locale}/checkout` | `checkout/page.tsx` | Server | `CheckoutView` | Wrapper con padding responsive |
| `/{locale}/checkout/success` | `checkout/success/page.tsx` | Server | Componente inline + `CartClearer` | Fetch de Stripe session. Muestra detalles de pago. |
| `/{locale}/checkout/cancel` | `checkout/cancel/page.tsx` | Server | Componente inline | Icono XCircle + botones de navegacion |

**Paginas Legales** — Parecen usar un patron comun pero NO comparten componente. Cada una tiene su propia funcion `getLegalPage()` que crea un Supabase client inline.

| Ruta URL | Archivo | Server/Client | Componente principal | Fuente de contenido |
|---|---|---|---|---|
| `/{locale}/terms` | `terms/page.tsx` | Server | `SafeMarkdown variant="legal"` | DB: `legal_pages` slug="terms" |
| `/{locale}/privacy` | `privacy/page.tsx` | Server | `SafeMarkdown variant="legal"` | DB: `legal_pages` slug="privacy" |
| `/{locale}/shipping` | `shipping/page.tsx` | Server | `SafeMarkdown variant="legal"` | DB: `legal_pages` slug="shipping" |
| `/{locale}/returns` | `returns/page.tsx` | Server | `SafeMarkdown variant="legal"` | DB: `legal_pages` slug="returns" |
| `/{locale}/cookies` | `cookies/page.tsx` | Server | Componente inline + `CookieSettingsButton` | Traducciones i18n |
| `/{locale}/legal` | `legal/page.tsx` | Server | Componente inline | DB: `legal_settings` table |
| `/{locale}/faq` | `faq/page.tsx` | Server | `FAQAccordion` | Traducciones i18n. JSON-LD FAQPage. |
| `/{locale}/about` | `about/page.tsx` | Server | Componente inline | Traducciones i18n |
| `/{locale}/contact` | `contact/page.tsx` | Server | `ContactForm` | Grid 3 cols: info cards + form |
| `/{locale}/size-guide` | `size-guide/page.tsx` | Server | `SizeGuideContent` (colocated) | Traducciones i18n |

---

### 5.4 `(editor)` — Design Editor

**Layout**: `src/app/[locale]/(editor)/layout.tsx`

```tsx
export default function EditorLayout({ children }) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-background">
      {children}
    </div>
  )
}
```

- Full-screen: `h-dvh w-full overflow-hidden`
- Sin sidebar, header, footer ni StorefrontLayout.
- Minimalista — el editor ocupa toda la pantalla.

#### Paginas

| Ruta URL | Archivo | Server/Client | Componente principal | Notas |
|---|---|---|---|---|
| `/{locale}/design/{productId}` | `design/[productId]/page.tsx` | Server | `DesignEditorClient` (colocated) | Fetch de producto + variantes desde Supabase. Props: product, variants, designTemplates, compositionId. |

---

### 5.5 Pagina suelta: `profile/notifications`

**Archivo**: `src/app/[locale]/profile/notifications/page.tsx`

- **FUERA de todo route group** — ubicada directamente bajo `[locale]/`.
- Solo hereda: Root Layout > Locale Layout (con Providers).
- NO hereda StorefrontLayout ni ninguna UI de aplicacion.
- Layout propio (`layout.tsx`) solo genera metadata SEO.
- Componente: pagina 'use client' inline con lista de notificaciones.
- Ruta URL: `/{locale}/profile/notifications`

---

## 6. StorefrontLayout — Analisis Exhaustivo

**Archivo**: `src/components/storefront/StorefrontLayout.tsx`

### Estructura de componentes

```
StorefrontLayout (export)
  StorefrontProvider         (Context: selectedProduct, artifacts, clearArtifacts)
    ChatMessageProvider      (Context: pendingChatMessage)
      StorefrontShell         (Componente interno — toda la UI)
```

### Providers que wrappea

- `StorefrontProvider` — maneja estado de producto seleccionado y artifacts (para detail panel).
- `ChatMessageProvider` — maneja `pendingChatMessage` para enviar preguntas al chat desde otros componentes.

### StorefrontShell — Estructura del DOM

```
<div className="flex h-dvh w-full overflow-hidden bg-background">

  <!-- Skip Navigation -->
  <a href="#main-content" className="sr-only focus:not-sr-only ...">

  <!-- LEFT SIDEBAR - Desktop (lg:) -->
  <aside className="hidden lg:flex lg:flex-col border-r border-border
                     transition-all duration-300 ease-in-out
                     [isCollapsed ? 'lg:w-0 overflow-hidden border-r-0' : 'lg:w-60']">
    <StorefrontSidebar onCollapse={toggleDesktopSidebar} />
  </aside>

  <!-- LEFT SIDEBAR - Mobile (Sheet drawer) -->
  <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
    <SheetContent side="left" className="w-60 p-0">
      <StorefrontSidebar onNavigate={() => setIsSidebarOpen(false)} />
    </SheetContent>
  </Sheet>

  <!-- CENTER: Header + Content -->
  <main id="main-content" className="flex flex-1 flex-col min-w-0 overflow-hidden">

    <StorefrontHeader ... />
    <OfflineBanner />
    <SubscriptionStatusBanner />

    <!-- ChatArea — SIEMPRE montado, visibilidad via CSS -->
    <div className="[isChatPage ? 'flex-1 pb-16 md:pb-0' : 'h-0 overflow-hidden pointer-events-none']">
      <ErrorBoundary>
        <ChatArea />   <!-- dynamic import, ssr: false -->
      </ErrorBoundary>
    </div>

    <!-- Page Content (solo si NO es chat page) -->
    {!isChatPage && (
      <div className="flex flex-1 flex-col min-h-0 overflow-y-auto pb-16 md:pb-0">
        {children}
        <Footer />
      </div>
    )}

  </main>

  <!-- RIGHT DETAIL PANEL - Desktop -->
  {showDetailPanel && (
    <aside className="hidden lg:flex lg:w-[340px] border-l border-border
                       animate-in slide-in-from-right duration-300">
      <DetailPanel ... />
    </aside>
  )}

  <!-- RIGHT DETAIL PANEL - Mobile (full screen overlay) -->
  {showDetailPanel && (
    <div className="lg:hidden fixed inset-0 z-50 bg-background
                     animate-in slide-in-from-bottom duration-300">
      <DetailPanel ... />
    </div>
  )}

  <!-- BOTTOM NAV - Mobile -->
  <BottomNav />

  <!-- PWA Install Prompt -->
  <InstallPrompt />

  <!-- Welcome Popup (solo en chat page) -->
  {isChatPage && <WelcomePopup />}  <!-- dynamic import, ssr: false -->

</div>
```

### Logica de visibilidad del ChatArea

```tsx
const isChatPage = pathname === `/${locale}/chat` || pathname === `/${locale}/chat/`
```

- **En `/chat`**: ChatArea ocupa `flex-1` con `pb-16 md:pb-0`. Children NO se renderizan (chat/page.tsx retorna null y ademas el bloque `!isChatPage` impide renderizar children).
- **En cualquier otra pagina**: ChatArea se colapsa a `h-0 overflow-hidden pointer-events-none`. El componente sigue montado para preservar estado SSE/conversacion. Children se renderizan normalmente dentro de un scroll container.

### Logica del Detail Panel

```tsx
const showDetailPanel = artifacts.length > 0 || selectedProduct
```

- Se muestra cuando hay artifacts (del chat AI) O un producto seleccionado.
- **Desktop (lg:)**: panel fijo de 340px a la derecha, con animacion slide-in-from-right.
- **Mobile (<lg)**: overlay full-screen fijo, con animacion slide-in-from-bottom.

### Padding bottom para BottomNav

- Todas las areas de contenido principales tienen `pb-16 md:pb-0`.
- `pb-16` = 64px, que es el alto de BottomNav.
- `md:pb-0` = en tablet+ BottomNav esta oculto, no se necesita padding.

### Collapse de sidebar

- Controlado via hook `useSidebarCollapsed()`.
- Desktop: transicion CSS `transition-all duration-300 ease-in-out`.
- `isCollapsed=true`: `lg:w-0 lg:overflow-hidden lg:border-r-0`.
- `isCollapsed=false`: `lg:w-60`.
- Boton de collapse en `StorefrontSidebar` (PanelLeftClose icon).
- Boton de expand en `StorefrontHeader` (PanelLeftOpen icon) — visible solo cuando `isCollapsed && lg:`.

---

## 7. Responsive Behavior

### Breakpoints utilizados

| Breakpoint | Prefijo | Ancho | Uso principal |
|---|---|---|---|
| Base (mobile) | ninguno | 0-767px | Estilos por defecto |
| Tablet | `md:` | 768px+ | Ocultar BottomNav, mostrar nav links en header |
| Desktop | `lg:` | 1024px+ | Mostrar sidebar, mostrar search bar, mostrar detail panel |

### Sidebar

| Viewport | Comportamiento |
|---|---|
| < lg (1024px) | `hidden`. Se abre como `<Sheet side="left">` via boton hamburguesa en header. |
| >= lg | `flex` visible. Ancho fijo 240px (`w-60`). Colapsable a `w-0`. |

### Header

| Viewport | Comportamiento |
|---|---|
| < md | Solo hamburguesa (lg:hidden) + search icon (lg:hidden) + cart + avatar. Nav links ocultos. |
| >= md | Nav links visibles (Chat, Shop). Hamburguesa oculta. |
| >= lg | Search bar centrado visible. Search icon mobile oculto. |

### Search

| Viewport | Comportamiento |
|---|---|
| < lg | Icono Search en header que abre overlay full-screen con form. |
| >= lg | Search bar inline en header, `max-w-md`, `rounded-full bg-muted`. |

### BottomNav

| Viewport | Comportamiento |
|---|---|
| < md (768px) | Visible. `fixed bottom-0` con `z-50`. 4 items: Chat, Shop, Cart, Profile. |
| >= md | `md:hidden` — completamente oculto. |

### Detail Panel

| Viewport | Comportamiento |
|---|---|
| < lg | `lg:hidden`. Full-screen overlay (`fixed inset-0 z-50`) con slide-in-from-bottom. |
| >= lg | Sidebar derecho de 340px, `hidden lg:flex`. Slide-in-from-right. |

### Content area padding

| Viewport | Padding | Razon |
|---|---|---|
| Base (mobile) | `pb-16` (64px) | Espacio para BottomNav |
| >= md | `pb-0` | BottomNav oculto |

### Paginas (focused) auth

- Contenido centrado: `max-w-md mx-auto`.
- Card con `bg-card/80 backdrop-blur-xl` — efecto glassmorphism.
- Padding responsive del layout padre: `px-4 py-6 md:py-10`.

### Landing page

- `min-h-dvh overflow-x-hidden`.
- NO tiene sidebar/header. Layout completamente independiente.
- Footer propio integrado directamente en la pagina.

### Editor (design)

- `h-dvh w-full overflow-hidden` — full viewport sin scroll.
- Sin ningun chrome (header, footer, sidebar).

---

## 8. Flujo de Navegacion

### 8.1 Puntos de entrada al store

| Origen | Destino | Mecanismo |
|---|---|---|
| URL directa | `/{locale}/` | Landing page |
| Landing hero CTA | `/{locale}/chat` | Link/Button en `LandingPageClient` |
| Landing product card | `/{locale}/shop/{id}` | Link en carousel |
| Google / SEO | Cualquier pagina publica | URLs canonicas con alternates |

### 8.2 Navegacion dentro de `(app)` — StorefrontLayout

#### Sidebar (desktop + Sheet mobile)

Links en `StorefrontSidebar`:
1. **Chat** -> `/{locale}/chat`
2. **Shop** -> `/{locale}/shop`
3. **New Arrivals** -> `/{locale}/shop?sort=newest&newArrivals=true`
4. **Favorites** -> `/{locale}/wishlist`
5. **Orders** -> `/{locale}/orders`
6. **Cart** -> `/{locale}/cart` (con badge de count)
7. **Logo (BrandMark)** -> `/{locale}` (landing)

Sidebar tambien tiene:
- **Recommended Products** (2 productos random top-rated, click abre DetailPanel)
- **Popular Today** (1 producto deterministic por dia, click abre DetailPanel)

#### Header

Links en `StorefrontHeader`:
- **Chat** (md:) -> `/{locale}/chat`
- **Shop** (md:) -> `/{locale}/shop`
- **Search** -> `/{locale}/shop?q={query}` (form submit)
- **Notifications bell** -> Sin link (solo icono, sin navegacion)
- **Cart** -> `/{locale}/cart`
- **User menu (dropdown)**:
  - Profile -> `/{locale}/profile`
  - Logout -> `/{locale}/auth/login`
- **Login button** (no auth) -> `/{locale}/auth/login`
- **Locale switcher** -> reemplaza `/{locale}/` en pathname actual

#### BottomNav (mobile < md)

4 items fijos:
1. **Chat** -> `/{locale}/chat`
2. **Shop** -> `/{locale}/shop`
3. **Cart** -> `/{locale}/cart` (con badge)
4. **Profile** -> `/{locale}/profile`

#### Navegacion interna entre paginas

| Desde | Hacia | Mecanismo |
|---|---|---|
| Shop listing | Product detail | Click en ProductCard -> `/{locale}/shop/{id}` |
| Product detail | Cart | "Add to Cart" button |
| Cart | Checkout | CTA button -> `/{locale}/checkout` |
| Checkout success | Orders | Link -> `/{locale}/orders` |
| Checkout success | Shop | Link -> `/{locale}/shop` |
| Checkout cancel | Cart | Link -> `/{locale}/cart` |
| Profile | Billing | Link -> `/{locale}/settings/billing` |
| Profile | Notifications | Probablemente link pero la pagina esta FUERA del route group |
| Pricing | Billing | Redirect a billing settings |
| FAQ | Contact | Link -> `/{locale}/contact` |
| Footer | Legal pages | Links a terms, privacy, shipping, returns, etc. |
| Referrals | Login | Redirect si no autenticado |
| Blog listing | Blog post | Link -> `/{locale}/blog/{slug}` |
| Category landing | Category page | Link -> `/{locale}/shop/category/{slug}` |

### 8.3 Flujo auth

```
Login/Register -> (success) -> OAuth callback -> /{locale}/
                                              -> session migration
                              -> Email/password -> direct redirect

Forgot password -> (submit) -> "check email"
Reset password -> (from email link) -> success -> login
Verify email -> (from email link) -> success -> redirect
```

### 8.4 Flujo checkout

```
Cart -> /{locale}/checkout -> Stripe redirect -> success -> /{locale}/checkout/success
                                              -> cancel  -> /{locale}/checkout/cancel
```

---

## 9. Resumen de Componentes Clave por Route Group

| Route Group | Layout Component | Sidebar | Header | Footer | Detail Panel | BottomNav | Background |
|---|---|---|---|---|---|---|---|
| `(landing)` | Propio (minimal `<main>`) | No | No | En la pagina | No | No | bg-background |
| `(app)` | StorefrontLayout | Si (240px / Sheet) | Si (StorefrontHeader) | Si (en scroll area) | Si (condicional) | Si (mobile) | bg-background |
| `(focused)` | FocusedLayout | No | No | FocusedFooter | No | No | AuthBackground + bg-background |
| `(editor)` | EditorLayout (full-screen) | No | No | No | No | No | bg-background |

---

## 10. Componentes Dinamicos (lazy-loaded)

| Componente | Import | SSR | Donde se monta |
|---|---|---|---|
| `ChatArea` | `dynamic(() => import(...))` | false | StorefrontLayout (siempre montado) |
| `WelcomePopup` | `dynamic(() => import(...))` | false | StorefrontLayout (solo en /chat) |
| `DesignsGallery` | Colocated export | N/A | designs/page.tsx |
| `DesignEditorClient` | Colocated export | N/A | design/[productId]/page.tsx |
| `SizeGuideContent` | Colocated export | N/A | size-guide/page.tsx |
