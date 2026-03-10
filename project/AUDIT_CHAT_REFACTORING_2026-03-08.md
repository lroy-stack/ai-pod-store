# SKAPARA Chat Interface — Full Refactoring Audit

**Fecha**: 2026-03-08
**Scope**: ChatArea.tsx (975 LOC), StorefrontLayout.tsx, contexts, hooks, data flow, CSS/layout
**Objetivo**: Documentar todos los problemas y producir un plan de decomposicion modular

---

## Executive Summary

ChatArea.tsx es un **God Component de 975 lineas con 14+ responsabilidades** que viola SRP masivamente. Tiene un antipatron critico de layout (`sticky bottom-0` dentro de `overflow-y-auto`) que causa bounce/jitter en scroll. Hay logica de negocio (checkout, returns) embebida inline en JSX, efectos que disparan en cada token de streaming, y duplicacion de codigo. Requiere una refactorizacion completa: decomposicion en ~8 componentes + ~5 hooks custom.

---

## Phase 1: Architecture & Modularity

### 1.1 Component Size & Responsibility Violations

**Total**: 975 lineas. Un componente de chat bien estructurado deberia ser ~80-150 lineas.

| # | Responsabilidad | Lineas | Extraer a |
|---|----------------|--------|-----------|
| 1 | Serializacion/deserializacion de sesion (tipos, `serializeMessages`, `deserializeMessages`, `clearChatSession`, `isChatExpired`) | 39-106 | `useChatSession` hook |
| 2 | Transport AI SDK (`customFetch` con CSRF, conversation ID, intercepcion engagement) | 151-208 | `useChatTransport` hook |
| 3 | Fetch de datos de usuario (session, orders, favorites) | 235-258 | `useUserContext` hook o context |
| 4 | Check de limites de uso (rate limit pre-check anonimo) | 261-278 | Merge en hook de engagement |
| 5 | Ciclo de vida de expiracion (mount, visibility, focus, interval) | 282-308 | Parte de `useChatSession` |
| 6 | Auto-scroll management | 311-320 | `useChatScroll` hook |
| 7 | Persistencia de mensajes a sessionStorage | 322-333 | Parte de `useChatSession` |
| 8 | Bridge de mensaje pendiente (DetailPanel "Ask about") | 336-341 | Aceptable inline |
| 9 | Upload de imagen + validacion (file input + FileReader) | 394-430 | `useImageUpload` hook |
| 10 | Drag-and-drop de imagenes | 432-468 | Merge en `useImageUpload` |
| 11 | Voice input (speech-to-text) | 214-232 | Ya extraido a `useSpeechToText` (OK) |
| 12 | Welcome screen (brand, orders, favorites, suggested prompts) | 479-569 | `ChatWelcomeScreen` componente |
| 13 | Renderizado de mensajes con tool artifacts, checkout approval, return approval | 573-823 | `ChatMessageList` + `ChatMessage` + handler modules |
| 14 | Input bar (form, image preview, voice, send) | 831-930 | `ChatInputBar` componente |
| 15 | Modales de engagement (AuthWall, Upgrade) | 932-943 | Aceptable inline |

### 1.2 State Management — Hooks Count

**10 useState + 7 useEffect + 3 useRef + 2 useCallback + 1 useMemo = 23 hooks** en un solo componente.

#### useState (10):
| # | Hook | Linea | Extraer? |
|---|------|-------|----------|
| 1 | `inputValue` | 119 | -> `ChatInputBar` |
| 2 | `selectedImage` | 120 | -> `useImageUpload` |
| 3 | `userData` | 121-125 | -> `useUserContext` |
| 4 | `initialMessages` (lazy init) | 129-132 | -> `useChatSession` |
| 5 | `showAuthWall` | 135 | -> engagement hook |
| 6 | `showUpgrade` | 136 | -> engagement hook |
| 7 | `isLimitReached` | 137 | -> engagement hook |
| 8 | `conversationIdRef` (useRef) | 140-142 | -> `useChatSession` |
| 9 | `userRef` (useRef) | 143 | Eliminar — workaround innecesario |
| 10 | `messagesEndRef` (useRef) | 117 | -> `useChatScroll` |

#### useEffect (7):
| # | Proposito | Lineas | Problema |
|---|-----------|--------|----------|
| 1 | Sync `userRef` con `userData.user` | 146-148 | Workaround para stale closure en `customFetch` |
| 2 | Fetch user data on mount | 235-258 | **Sin AbortController** — memory leak si desmonta |
| 3 | Check usage limits on mount | 261-278 | **Sin AbortController** — mismo problema |
| 4 | Chat expiry lifecycle | 282-308 | OK — tiene cleanup |
| 5 | **Auto-scroll** | 312-320 | **BUG CRITICO: depende de `[messages]`** — dispara en CADA token de streaming |
| 6 | Persistencia sessionStorage | 322-333 | **PERFORMANCE: `JSON.stringify` en cada token** — deberia ser debounced |
| 7 | Pending message bridge | 336-341 | OK |

### 1.3 Inline Business Logic en JSX

#### Checkout approval handler (L650-697) — 47 lineas de logica de negocio en render:
```
- API call a `/api/checkout/create-session`
- Parseo de respuesta y redirect (`window.location.href`)
- Error handling con `sendMessage`
- `handleDeny` que envia mensaje al chat
```

#### Return request handler (L700-738) — 38 lineas de logica de negocio en render:
```
- API call a `/api/orders/${orderId}/returns`
- Parseo de respuesta, success/error messaging
- `handleDeny` que envia mensaje al chat
```

#### Side effect durante render (L741-745):
```tsx
if (output.checkoutUrl && toolName === 'confirm_checkout') {
  window.location.href = output.checkoutUrl  // <-- ANTIPATRON: side effect en render
  return null
}
```
Esto puede disparar multiples veces en StrictMode.

#### Validacion de imagen duplicada:
- `handleImageSelect` (L394-419) y `handleDrop` (L438-468) comparten la misma logica de validacion copy-paste.

### 1.4 Otros Issues
- `alert()` usado para errores de validacion (L400, L405, L448, L453) en vez de `toast()`

---

## Phase 2: CSS, Layout & Scroll

### 2.1 Full Layout Chain

```
html
  body
    Providers (pass-through)
      StorefrontLayout (pass-through)
        StorefrontShell
          div.flex.h-dvh.w-full.overflow-hidden         <- VIEWPORT LOCK
            aside (sidebar, lg:w-60)
            main.flex.flex-1.flex-col.min-w-0.overflow-hidden
              StorefrontHeader
              div.flex.flex-col.min-h-0.flex-1.pb-16.md:pb-0  <- CHAT WRAPPER
                ErrorBoundary
                  ChatArea root
                    div.flex-col.flex-1.min-h-0.overflow-y-auto.overscroll-contain  <- SCROLL CONTAINER (L471)
                      div.flex-1.px-3.py-4  <- MESSAGES (L478)
                      SignupBanner          <- ENTRE messages e input (L828)
                      div.sticky.bottom-0   <- INPUT BAR DENTRO DEL SCROLL (L831) ** ANTIPATRON **
                      AuthWallModal
                      UpgradeModal
```

### 2.2 El Antipatron: `sticky bottom-0` dentro de `overflow-y-auto`

**Ubicacion**: ChatArea.tsx L471 (scroll container) + L831 (sticky input)

**Por que causa bounce/jitter:**

1. **Recalculo de sticky en cada frame de scroll.** El browser recalcula si el sticky element debe estar "stuck" (pinned al bottom del scroll viewport) o en su posicion natural de flow. Durante scroll rapido, la transicion stuck/unstuck causa layout shifts visibles.

2. **Scroll rapido hacia arriba — overshoot de unstick.** Al scrollear rapido arriba, el momentum puede overshoot. El sticky element momentaneamente calcula que su posicion natural esta ARRIBA del viewport bottom, causando que se "unstick" y siga al contenido arriba por 1-2 frames antes de re-stick. Esto produce jitter visible.

3. **iOS rubber-band overscroll.** En iOS Safari, el overscroll estira el scroll container (rubber-band). `overscroll-contain` (L473) previene propagacion al parent, pero el rubber-band DENTRO del contenedor sigue ocurriendo. El `bottom-0` del sticky se deforma elasticamente -> bounce visual del input bar.

4. **`backdrop-blur-xl` (L833) empeora performance.** Fuerza al browser a compositar el blur en cada frame durante scroll. Combinado con sticky recalculation = bottleneck de rendering en mobile.

5. **`SignupBanner` (L828) entre messages y sticky input** anade altura impredecible. Cuando aparece/desaparece, el sticky se unstick/restick.

### 2.3 Solucion: Patron Profesional de Chat (WhatsApp, Claude.ai, ChatGPT)

**Actual (roto):**
```
div.overflow-y-auto          <- TODO scrollea
  messages
  SignupBanner
  div.sticky.bottom-0        <- input DENTRO del scroll
```

**Correcto:**
```
div.flex.flex-col.flex-1.min-h-0    <- NO overflow aqui
  div.flex-1.min-h-0.overflow-y-auto.overscroll-contain  <- SOLO mensajes scrollean
    messages
    SignupBanner
    <div ref={messagesEndRef} />
  ChatInputBar.flex-shrink-0         <- FUERA del scroll, pinned por flexbox
```

**Por que funciona:**
- El input NUNCA se mueve — no esta en un scroll container
- No se necesita `sticky` — flexbox lo maneja
- `overscroll-contain` en el scroll area previene rubber-band, y el input esta FUERA de esa zona
- `backdrop-blur-xl` solo necesita compositar en paint, no en recalculos de sticky

### 2.4 Mobile-Specific Issues

| Issue | Detalle | Severidad |
|-------|---------|-----------|
| `pb-16` + `pb-3` overlap | Chat wrapper tiene `pb-16` para BottomNav + input bar tiene `pb-3` = espacio muerto excesivo en mobile | MEDIUM |
| No `safe-area-inset-bottom` | En iPhones con notch, BottomNav y chat input pueden solapar el home indicator | MEDIUM |
| iOS keyboard | `h-dvh` (100dvh) ajusta con keyboard, pero `overflow-hidden` en `<main>` puede prevenir propagacion correcta | HIGH |

### 2.5 CSS Token Compliance

**RESULTADO: ZERO tokens prohibidos.** Todos los colores usan tokens semanticos. PASS completo.

### 2.6 Touch Targets

| Elemento | Tamano | Estado |
|----------|--------|--------|
| Attach button | `h-11 w-11` (44x44px) | PASS |
| Voice button | `h-11 w-11` (44x44px) | PASS |
| Send button | `h-11 w-11` (44x44px) | PASS |
| Text input | `min-h-[40px]` | ACCEPTABLE (input, no boton) |

### 2.7 Responsive Breakpoints

| Breakpoint | Adaptacion | Issues |
|------------|-----------|--------|
| 375px (base) | `px-3 py-4`, `grid-cols-1`, BottomNav visible, `pb-16` | Excesivo bottom spacing |
| 640px (sm) | `sm:px-4`, `sm:grid-cols-2` prompts | OK |
| 768px (md) | `md:px-6 md:py-6`, `md:pb-0`, BottomNav hidden | Jump de 64px al cruzar breakpoint |
| 1024px (lg) | Sidebar 240px + optional detail panel 340px | Con ambos panels: solo 444px para chat (cramped pero funcional) |

---

## Phase 3: Data Flow & Tools

### 3.1 Tool-to-Artifact Pipeline (20+ tools en `tools.ts`)

| # | Tool | Artifact | Estado |
|---|------|----------|--------|
| 1 | `product_search` | `ProductGridArtifact` | OK |
| 2 | `browse_catalog` | `ProductGridArtifact` | OK |
| 3 | `get_product_detail` | `ProductDetailArtifact` | OK |
| 4 | `compare_products` | `ComparisonTableArtifact` | OK |
| 5 | `get_recommendations` | `ProductGridArtifact` | OK |
| 6 | `get_size_guide` | `SizeGuideArtifact` | OK |
| 7 | `check_availability` | — | Solo texto (OK) |
| 8 | `add_to_cart` | — | Side-effect (OK) |
| 9 | `get_cart` | `CartSummaryArtifact` | OK |
| 10 | `apply_coupon` | — | Solo texto (OK) |
| 11 | `estimate_shipping` | `PricingTableArtifact` | OK |
| 12 | `create_checkout` | `ApprovalCardArtifact` | OK (`needsApproval`) |
| 13 | `confirm_checkout` | — | Redirect a Stripe |
| 14 | `track_order` | `OrderTimelineArtifact` | OK |
| 15 | `get_order_history` | `OrderListArtifact` | OK |
| 16 | `request_return` | `ReturnRequestArtifact` | OK (`needsApproval`) |
| 17 | `generate_design` | `DesignPreviewArtifact` | OK |
| 18 | `customize_design` | `DesignPreviewArtifact` | OK |
| 19 | `remove_background` | `DesignPreviewArtifact` | OK |
| 20 | `add_to_wishlist` | — | Side-effect (OK) |
| 21 | `get_store_policies` | — | Solo texto (OK) |
| 22 | `switch_language` | — | Redirect action |
| 23 | `analyze_image` | — | Solo texto (OK) |
| 24 | `personalize_product` | — | Solo texto (OK) |
| 25 | `ai_design_generate` | **NINGUNO** | **BUG: NO registrado en registry, usa `image_url` en vez de `imageUrl`** |
| 26 | `apply_design_to_product` | **NINGUNO** | **BUG: tiene `needsApproval` pero sin artifact = approval UI nunca renderiza** |

### 3.2 Hallazgos Criticos de Data Flow

#### `ai_design_generate` vs `generate_design` — TOOL DUPLICADO Y ROTO
- `generate_design` (L1349): output `{ imageUrl, prompt, style, designId }` — registrado en registry, funciona
- `ai_design_generate` (L1804): output `{ image_url, provider, inference_ms }` — **NO registrado**, campo `image_url` en vez de `imageUrl`
- Resultado: `getArtifact('ai_design_generate')` retorna `null` → el output se pierde silenciosamente

#### `apply_design_to_product` — APPROVAL ROTO
- Tiene `needsApproval: true` (L1884) pero sin artifact en registry
- `getArtifact('apply_design_to_product')` retorna `null` → la UI de approve/deny nunca se muestra
- El usuario no puede aprobar ni rechazar esta accion

#### `ProductMockupArtifact` — CODIGO MUERTO
- Existe en filesystem (`src/components/artifacts/ProductMockupArtifact/`, 3 archivos)
- **NO registrado** en `registry.tsx`
- **Ningun tool** lo mapea
- Es dead code que debe eliminarse o conectarse

#### Checkout handler hardcodea locale y currency (L665-666)
```tsx
locale: 'en',      // HARDCODEADO — deberia usar variable `locale` de L112
currency: 'usd',   // HARDCODEADO — deberia usar STORE_DEFAULTS.stripeCurrency
```

### 3.3 Type Safety

| Issue | Ubicacion | Severidad |
|-------|-----------|-----------|
| `part.output as any` elimina toda seguridad de tipos | ChatArea.tsx:632 | **HIGH** |
| 19 `@ts-expect-error` suppressions en tools.ts | tools.ts (multiples) | **MEDIUM** |
| No hay tipo compartido entre tools.ts y artifact components | N/A | **MEDIUM** |
| `ArtifactRegistryEntry` usa `React.ComponentType<any>` | registry.tsx:24-27 | **LOW** |
| Output de `formatProduct()` no tiene tipo formal vs `ProductCard` de artifacts | tools.ts:13-26 | **MEDIUM** |

### 3.4 Streaming & Performance

- **Skeleton → resultado sin transicion**: El skeleton se reemplaza wholesale por el artifact, causando un "pop" visual. No hay fade de skeleton a contenido.
- **`serializeMessages` en cada token**: Durante streaming (~500 tokens), dispara ~500 veces `JSON.stringify` + `sessionStorage.setItem`. Fix: debounce o persistir solo cuando `status !== 'streaming'`.
- **`customFetch` estabilidad**: Correctamente wrapeado en `useCallback([])` y `transport` en `useMemo`. OK.

### 3.5 Session Persistence

| Aspecto | Estado | Nota |
|---------|--------|------|
| `sessionStorage` como almacen | ACEPTABLE | Tab-scoped, auto-clear on close |
| Tab duplication | **PROBLEMA** | `Ctrl+T` copia sessionStorage → dos tabs con mismo `conversationId` → message interleaving |
| TTL 3h desde PRIMER mensaje | **EDGE CASE** | Conversacion activa de 2.5h expira a las 3h del primer mensaje, no del ultimo |
| Quota exceeded | **SIN FEEDBACK** | `catch { /* ignore */ }` — usuario pierde datos sin saberlo |
| Tool errors no persisten | OK | `output-error` parts se filtran en serializacion |

### 3.6 Error Handling

| Escenario | Manejo | Estado |
|-----------|--------|--------|
| Tool `execute` throws | `part.state = 'output-error'` → mensaje generico | OK |
| Tool retorna `success: false` | L748: `return null` — **error silenciado sin feedback al usuario** | **BUG** |
| Stream desconecta | `error` state mostrado, pero **sin retry logic** | **MEDIUM** |
| Rate limit 429/403 | Fake empty SSE → modal engagement | CLEVER pero confuso |
| Network offline | **No detectado** — sin `navigator.onLine` ni `offline` event | **MEDIUM** |
| Stream timeout | Solo server-side `maxDuration=60` — cliente espera indefinidamente | **MEDIUM** |

---

## Phase 4: Hooks & Contexts

### 4.1 Context Provider Analysis

#### StorefrontContext (82 LOC)
- **Estado**: `selectedProduct`, `artifacts`, `activeArtifactId`
- **Scope**: Razonable — estado de layout compartido entre ChatArea, DetailPanel, sidebar
- **Issue menor**: `value` no wrapeado en `useMemo` — re-renders innecesarios si el provider re-renderiza por razones ajenas
- **Callbacks**: Correctamente memoizados con `useCallback`

#### ChatMessageContext (28 LOC) — SOBRE-INGENIERIA
- **Estado**: Un solo string `pendingChatMessage`
- **Existe SOLO** para pasar un mensaje del DetailPanel "Ask about" al ChatArea
- **Deberia**: Mergearse en StorefrontContext como `pendingChatMessage` + `setPendingChatMessage`
- **Eliminar** `ChatMessageContext.tsx` enteramente

#### FALTA: ChatContext
- ChatArea mantiene TODO su estado internamente (session, engagement, conversation ID)
- **Consecuencia**: Otros componentes (StorefrontHeader, BottomNav) no pueden acceder al estado del chat (ej: mostrar message count, indicador de chat activo)

### 4.2 Hook Inventory Completo en ChatArea — 30 HOOKS

| # | Hook | Linea | Grupo |
|---|------|-------|-------|
| 1 | `useTranslations('storefront')` | 109 | i18n |
| 2 | `useTranslations('engagement.chat')` | 110 | i18n |
| 3 | `useParams()` | 111 | Routing |
| 4 | `useStorefront()` | 113 | Context |
| 5 | `useChatMessage()` | 114 | Context |
| 6 | `useCart()` | 115 | Context |
| 7 | `useWishlist()` | 116 | Context |
| 8 | `useRef(messagesEndRef)` | 117 | Scroll (Grupo E) |
| 9 | `useRef(fileInputRef)` | 118 | Image (Grupo B) |
| 10 | `useState(inputValue)` | 119 | Submit |
| 11 | `useState(selectedImage)` | 120 | Image (Grupo B) |
| 12 | `useState(userData)` | 121-125 | Welcome (Grupo D) |
| 13 | `useState(initialMessages)` | 129-132 | Session (Grupo A) |
| 14 | `useState(showAuthWall)` | 135 | Engagement (Grupo C) |
| 15 | `useState(showUpgrade)` | 136 | Engagement (Grupo C) |
| 16 | `useState(isLimitReached)` | 137 | Engagement (Grupo C) |
| 17 | `useRef(conversationIdRef)` | 140-142 | Session (Grupo A) |
| 18 | `useRef(userRef)` | 143 | Workaround |
| 19 | `useEffect(userRef sync)` | 146-148 | Workaround |
| 20 | `useCallback(customFetch)` | 151-198 | Session (Grupo A) |
| 21 | `useMemo(transport)` | 201-203 | Session (Grupo A) |
| 22 | `useChat()` | 205-209 | Core |
| 23 | `useSpeechToText()` | 214-232 | Voice |
| 24 | `useEffect(fetchUserData)` | 235-258 | Welcome (Grupo D) |
| 25 | `useEffect(checkUsageOnMount)` | 261-278 | Engagement (Grupo C) |
| 26 | `useEffect(chat expiry)` | 282-308 | Session (Grupo A) |
| 27 | `useRef(scrollContainerRef)` | 311 | Scroll (Grupo E) |
| 28 | `useEffect(auto-scroll)` | 312-320 | Scroll (Grupo E) |
| 29 | `useEffect(persist messages)` | 323-333 | Session (Grupo A) |
| 30 | `useEffect(pending message)` | 336-341 | Bridge |

**30 hooks** — ~3x el umbral recomendado por el equipo de React (~10 hooks por componente).

### 4.3 Grupos de Hooks Acoplados

| Grupo | Hooks | Extraer a |
|-------|-------|-----------|
| A — Session | #13, #17, #19, #20, #21, #26, #29 (7 hooks) | `useChatSession` |
| B — Image Upload | #9, #11 + 7 handlers (L394-468) | `useImageUpload` |
| C — Engagement | #14, #15, #16, #25 | `useChatEngagement` (usar `useEngagement` existente!) |
| D — Welcome Data | #12, #24 | `useWelcomeData` |
| E — Scroll | #8, #27, #28 | `useChatScroll` |

### 4.4 Hallazgo Critico: ChatArea DUPLICA `useEngagement`

Existe `src/hooks/useEngagement.ts` (109 LOC) que ya provee `showAuthWall`, `setShowAuthWall`, `showUpgrade`, `setShowUpgrade`, `checkAction`.

**ChatArea NO lo importa.** En su lugar, re-implementa la misma logica manualmente en L135-137 y L261-278. Duplicacion completa.

### 4.5 Hallazgo Critico: CartContext DUPLICADO

Dos implementaciones incompatibles:
1. `src/hooks/useCart.tsx` (265 LOC) — usado por ChatArea y la mayoria de componentes
2. `src/contexts/CartContext.tsx` (167 LOC) — interfaz diferente (`addItem` vs `addToCart`, `productId` vs `product_id`)

**Uno de los dos es dead code o legado** que debe eliminarse.

### 4.6 Engagement Components

| Componente | Ubicacion en ChatArea | Layout Shift? | Notas |
|------------|----------------------|---------------|-------|
| `SignupBanner` | L828, entre messages e input | MINIMO (~40px fade-in) | Correcto en ChatArea |
| `AuthWallModal` | L933-938 | NO (modal overlay) | Podria moverse a StorefrontLayout |
| `UpgradeModal` | L939-943 | NO (modal overlay) | Podria moverse a StorefrontLayout |

### 4.7 Cart & Wishlist Integration

- `useCart().addToCart` — Integracion limpia. El fallback `VARIANT_REQUIRED → setSelectedProduct(productId)` es buen UX.
- `useWishlist().toggleWishlist` — OK, pero `handleAddToWishlist` (L390-392) es un wrapper innecesario que simplemente delega. Pasar `toggleWishlist` directamente.

### 4.8 Speech-to-Text (`useSpeechToText`)

**Estado: BIEN encapsulado** (213 LOC, hook propio)
- Maneja: no support, permission denied, no speech, user abort, network error, already recording
- Locale-aware: mapea `en/es/de` a BCP-47 (`en-US`, `es-ES`, `de-DE`)
- Cleanup correcto en unmount
- **Issue menor**: Effect sin deps (L90) para sync de callback refs — funciona pero un comentario ayudaria

### 4.9 Plan de Extraccion de Hooks

| Prioridad | Hook | Extraer de | LOC estimado | Interface |
|-----------|------|-----------|--------------|-----------|
| P1 | `useChatSession` | L50-106, L129-132, L140-142, L282-308, L323-333 | ~80 | `{ initialMessages, conversationIdRef, persistMessages, clearSession }` |
| P1 | `useChatImageUpload` | L118, L120, L394-468 | ~50 | `{ fileInputRef, selectedImage, handleImageSelect, handleAttachClick, handleRemoveImage, dragHandlers }` |
| P1 | `useChatEngagement` | L135-137, L261-278 (usar `useEngagement` existente) | ~40 | `{ showAuthWall, showUpgrade, isLimitReached, interceptLimitResponse }` |
| P2 | `useChatScroll` | L117, L311, L312-320 | ~40 | `{ messagesEndRef, scrollContainerRef }` |
| P2 | `useChatSubmit` | L119, L343-377 | ~30 | `{ inputValue, setInputValue, handleKeyDown, handleSubmit }` |
| P3 | `useWelcomeData` | L121-125, L235-258 | ~40 | `{ user, activeOrders, recentFavorites }` |

---

## Critical Findings Summary (CONSOLIDADO — 4 agentes)

| # | Finding | Severidad | Ubicacion | Fix |
|---|---------|-----------|-----------|-----|
| CF-01 | `sticky bottom-0` dentro de `overflow-y-auto` causa jitter/bounce en scroll | **CRITICAL** | ChatArea.tsx:471,831 | Reestructurar a flex-col con input FUERA del scroll |
| CF-02 | Auto-scroll `useEffect` dispara en cada token de streaming (`[messages]` en vez de `[messages.length]`) | **CRITICAL** | ChatArea.tsx:312-320 | Cambiar dep a `[messages.length]` + threshold |
| CF-03 | `ai_design_generate` tool output nunca renderiza — no registrado, campos incompatibles | **CRITICAL** | tools.ts:1804, registry.tsx | Registrar o eliminar tool duplicado |
| CF-04 | `apply_design_to_product` tiene `needsApproval` pero sin artifact — approval UI rota | **CRITICAL** | tools.ts:1884, registry.tsx | Crear artifact o quitar needsApproval |
| CF-05 | `sessionStorage.setItem(JSON.stringify(...))` en cada token de streaming | **HIGH** | ChatArea.tsx:322-333 | Debounce o cambiar dep |
| CF-06 | God component 975 LOC con 14+ responsabilidades, 30 hooks | **HIGH** | ChatArea.tsx (entero) | Decomposicion completa |
| CF-07 | Logica de checkout/returns embebida en render (85 LOC de API calls en JSX) | **HIGH** | ChatArea.tsx:650-745 | Extraer a handler modules |
| CF-08 | Side effect `window.location.href` durante render | **HIGH** | ChatArea.tsx:741-745 | Mover a useEffect o callback |
| CF-09 | ChatArea duplica `useEngagement` en vez de usarlo | **HIGH** | ChatArea.tsx:135-137,261-278 vs hooks/useEngagement.ts | Usar hook existente |
| CF-10 | Checkout handler hardcodea `locale: 'en'` y `currency: 'usd'` | **HIGH** | ChatArea.tsx:665-666 | Usar variables runtime |
| CF-11 | `part.output as any` elimina type safety para 15+ artifacts | **HIGH** | ChatArea.tsx:632 | Crear ToolOutputMap tipado |
| CF-12 | Tool `success: false` silenciado sin feedback al usuario | **HIGH** | ChatArea.tsx:748-750 | Mostrar error toast |
| CF-13 | `ProductMockupArtifact` es dead code (3 archivos) | **MEDIUM** | artifacts/ProductMockupArtifact/ | Eliminar o conectar |
| CF-14 | CartContext duplicado (2 implementaciones incompatibles) | **MEDIUM** | hooks/useCart.tsx vs contexts/CartContext.tsx | Eliminar uno |
| CF-15 | ChatMessageContext sobre-ingenieria (1 string = context entero) | **MEDIUM** | ChatMessageContext.tsx | Merge en StorefrontContext |
| CF-16 | Validacion de imagen duplicada (copy-paste) | **MEDIUM** | ChatArea.tsx:394-419 vs 438-468 | Extraer a `processImageFile()` |
| CF-17 | Sin AbortController en fetches de mount | **MEDIUM** | ChatArea.tsx:235-278 | Anadir abort en cleanup |
| CF-18 | Sin `safe-area-inset-bottom` para iPhone notch | **MEDIUM** | BottomNav + ChatArea input | Anadir CSS env() |
| CF-19 | 19 `@ts-expect-error` suppressions en tools.ts | **MEDIUM** | tools.ts | Tipar correctamente |
| CF-20 | Sin retry logic en stream disconnect | **MEDIUM** | ChatArea.tsx | Anadir retry con backoff |
| CF-21 | Sin deteccion de network offline | **MEDIUM** | ChatArea.tsx | Anadir `navigator.onLine` check |
| CF-22 | `alert()` para errores en vez de `toast()` | **LOW** | ChatArea.tsx:400,405,448,453 | Reemplazar con `toast.error()` |
| CF-23 | `handleAddToWishlist` wrapper innecesario | **LOW** | ChatArea.tsx:390-392 | Pasar `toggleWishlist` directamente |
| CF-24 | No hay transicion skeleton → artifact (visual "pop") | **LOW** | ChatArea.tsx:627-628,753 | Anadir fade transition |

---

## Proposed Refactoring Plan

| # | Finding | Severidad | Ubicacion | Fix |
|---|---------|-----------|-----------|-----|
| CF-01 | `sticky bottom-0` dentro de `overflow-y-auto` causa jitter/bounce en scroll | **CRITICAL** | ChatArea.tsx:471,831 | Reestructurar a flex-col con input FUERA del scroll |
| CF-02 | Auto-scroll `useEffect` dispara en cada token de streaming (`[messages]` en vez de `[messages.length]`) | **CRITICAL** | ChatArea.tsx:312-320 | Cambiar dep a `[messages.length]` + threshold |
| CF-03 | `sessionStorage.setItem(JSON.stringify(...))` en cada token de streaming | **HIGH** | ChatArea.tsx:322-333 | Debounce o cambiar dep a `[messages.length]` |
| CF-04 | God component 975 LOC con 14+ responsabilidades, 23 hooks | **HIGH** | ChatArea.tsx (entero) | Decomposicion completa |
| CF-05 | Logica de checkout/returns embebida en render (85 LOC de API calls en JSX) | **HIGH** | ChatArea.tsx:650-745 | Extraer a handler modules |
| CF-06 | Side effect `window.location.href` durante render | **HIGH** | ChatArea.tsx:741-745 | Mover a useEffect o callback |
| CF-07 | Validacion de imagen duplicada (copy-paste) | **MEDIUM** | ChatArea.tsx:394-419 vs 438-468 | Extraer a `processImageFile()` |
| CF-08 | Sin AbortController en fetches de mount | **MEDIUM** | ChatArea.tsx:235-278 | Anadir abort en cleanup |
| CF-09 | `pb-16` + `pb-3` overlap crea espacio muerto excesivo en mobile | **MEDIUM** | StorefrontLayout:115 + ChatArea:831 | Ajustar tras refactoring |
| CF-10 | Sin `safe-area-inset-bottom` para iPhone notch | **MEDIUM** | BottomNav + ChatArea input | Anadir CSS env() |
| CF-11 | `backdrop-blur-xl` en sticky element degrada scroll performance | **MEDIUM** | ChatArea.tsx:833 | Se resuelve al sacar input del scroll |
| CF-12 | `alert()` para errores en vez de `toast()` | **LOW** | ChatArea.tsx:400,405,448,453 | Reemplazar con `toast.error()` |

---

## Proposed Refactoring Plan

### Target Architecture

```
ChatArea.tsx (~80 LOC - orquestador)
  ChatWelcomeScreen.tsx (~120 LOC)
    SuggestedPrompt (ya existe, mover aqui)
    UserContextCards (orders + favorites)
  ChatMessageList.tsx (~60 LOC)
    ChatMessage.tsx (~80 LOC)
      ChatToolArtifact.tsx (~100 LOC - tool part rendering)
    TypingIndicator.tsx (~20 LOC)
    ErrorDisplay.tsx (~20 LOC)
  ChatInputBar.tsx (~120 LOC)
    ImagePreview (inline)
    VoiceButton (inline)

hooks/
  useChatSession.ts (~80 LOC)
    - serializeMessages / deserializeMessages
    - clearChatSession / isChatExpired
    - Ciclo de vida de expiracion
    - Conversation ID management
    - Persistencia sessionStorage (debounced)
  useChatScroll.ts (~40 LOC)
    - Auto-scroll con threshold
    - Comportamiento separado para streaming vs new messages
  useChatTransport.ts (~50 LOC)
    - customFetch con CSRF, conversation ID, engagement interception
    - Retorna DefaultChatTransport configurado
  useImageUpload.ts (~50 LOC)
    - File selection + drag-and-drop
    - Validacion (tipo, tamano)
    - FileReader conversion
    - Preview state
  useChatEngagement.ts (~40 LOC)
    - isLimitReached state
    - showAuthWall / showUpgrade state
    - Check de uso en mount
    - Intercepcion de limites (desde transport)

handlers/
  checkoutHandler.ts (~30 LOC)
    - handleCheckoutApprove(output, sendMessage)
    - handleCheckoutDeny(sendMessage)
  returnHandler.ts (~30 LOC)
    - handleReturnApprove(output, sendMessage)
    - handleReturnDeny(sendMessage)
```

### Refactored ChatArea.tsx (conceptual ~80 LOC)

```tsx
export function ChatArea() {
  const session = useChatSession()
  const transport = useChatTransport(session.conversationId)
  const engagement = useChatEngagement()
  const { messages, sendMessage, status, error } = useChat({
    transport,
    messages: session.initialMessages,
  })
  const scroll = useChatScroll(messages)
  const image = useImageUpload()

  session.sync(messages)

  return (
    <div className="flex flex-col flex-1 min-h-0"
         onDragOver={image.handleDragOver} onDrop={image.handleDrop}>

      {/* Scroll area — SOLO mensajes */}
      <div ref={scroll.containerRef}
           className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {messages.length === 0 ? (
          <ChatWelcomeScreen onPromptClick={sendMessage} />
        ) : (
          <ChatMessageList
            messages={messages}
            isLoading={status === 'streaming'}
            error={error}
            onSendMessage={sendMessage}
          />
        )}
        <div ref={scroll.endRef} />
      </div>

      <SignupBanner messageCount={messages.length} />

      {/* Input bar — FUERA del scroll, pinned por flexbox */}
      <ChatInputBar
        onSubmit={sendMessage}
        image={image}
        isLoading={status !== 'ready'}
        isLimitReached={engagement.isLimitReached}
      />

      {engagement.modals}
    </div>
  )
}
```

### Key Layout Fix

El cambio mas impactante es mover el input bar FUERA del scroll container:

```
ANTES (roto):
div.overflow-y-auto
  messages
  div.sticky.bottom-0  <- DENTRO del scroll

DESPUES (correcto):
div.flex.flex-col.flex-1.min-h-0
  div.flex-1.overflow-y-auto  <- SOLO mensajes
  InputBar.flex-shrink-0      <- FUERA del scroll
```

Esto elimina el antipatron sticky-inside-overflow por completo.

---

## Scorecard General

| Categoria | Score /10 | Notas |
|-----------|-----------|-------|
| Modularidad / SRP | 2/10 | 975 LOC, 30 hooks, 14+ responsabilidades en 1 componente |
| Layout / CSS | 3/10 | Antipatron sticky-inside-scroll, sin safe-area, tokens OK |
| Data Flow / Types | 3/10 | 2 tools rotos, dead code, `as any`, hardcoded values |
| Hooks / State | 2/10 | 30 hooks, duplica useEngagement, CartContext duplicado |
| Streaming / Performance | 4/10 | Funcional pero serialize en cada token, sin debounce |
| Error Handling | 3/10 | Errores silenciados, sin retry, sin offline detection |
| **TOTAL** | **17/60** | Requiere refactorizacion completa antes de produccion |

---

*Reporte generado por auditoria automatizada con 4 agentes paralelos — 2026-03-08*
*4/4 agentes completados. Reporte FINAL.*
