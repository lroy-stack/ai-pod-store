# 08 — Chat Generativo: Flujo UX Completo

**Fecha**: 2026-03-08
**Scope**: Experiencia de usuario del chat AI en SKAPARA, desde entry point hasta interaccion con artefactos.
**Tipo**: Documentacion descriptiva (sin propuestas de cambio).

---

## 1. Entry Point: Navegacion hacia /chat

### Desktop (lg:)
El usuario accede a `/chat` desde:
- **Sidebar izquierda** (`StorefrontSidebar`): Link "Chat" siempre visible en el menu de navegacion.
- **URL directa**: `/{locale}/chat`.

### Mobile (<md:)
- **Bottom navigation bar** (`BottomNav.tsx`): Barra fija en la parte inferior con 4 items: Chat, Shop, Cart, Profile. El icono de Chat (`MessageSquare`) se resalta con `text-primary` cuando la ruta activa es `/chat`.
- **Sidebar mobile** (Sheet drawer): Accesible desde el hamburger en el header.

### Mecanismo de montaje
El componente `ChatArea` NO vive dentro de `chat/page.tsx`. La pagina `chat/page.tsx` renderiza `null`. En su lugar:

- `ChatArea` esta siempre montado dentro de `StorefrontLayout` via `dynamic()` import (sin SSR).
- Su visibilidad se controla por CSS: cuando `isChatPage === true`, el contenedor obtiene `flex-1` (ocupa todo el espacio). Cuando no es la pagina de chat, obtiene `h-0 overflow-hidden pointer-events-none`.
- Esto preserva el estado del SSE stream y los mensajes al navegar entre paginas dentro de (app).

```
StorefrontLayout
  |-- aside (sidebar 240px, hidden en mobile)
  |-- main
  |     |-- StorefrontHeader
  |     |-- ChatArea container (CSS toggle: flex-1 vs h-0)
  |     |     |-- ChatArea (always mounted)
  |     |-- children container (visible cuando !isChatPage)
  |-- aside derecha (DetailPanel 340px, condicional)
  |-- BottomNav (solo mobile)
```

---

## 2. Pantalla Inicial del Chat (Welcome Screen)

Cuando el usuario entra a `/chat` y no hay mensajes previos, ve el componente `ChatWelcome`.

### Para usuarios anonimos (no logueados)
- **Logo SKAPARA** centrado (`BrandMark` con `size={32}`, nombre visible).
- **Titulo**: Texto generico de bienvenida (`welcomeSubtitle` del i18n).
- **Sin cards de contexto**: No se muestran pedidos ni favoritos.
- **Centrado vertical**: El contenido ocupa `min-h-[40vh]` en mobile, `min-h-[50vh]` en desktop, dando una sensacion limpia tipo ChatGPT.

### Para usuarios logueados (returning users)
- **Saludo personalizado**: "Welcome back, {nombre}" (`welcomeBackTitle`), usando el primer nombre del usuario.
- **Subtitulo contextual**: `welcomeBackSubtitle`.
- **Cards de contexto** (si hay datos):
  - **Active Orders card**: Muestra hasta 2 pedidos activos (status processing/pending) con ID truncado, badge de estado, y total en EUR.
  - **Recent Favorites card**: Muestra hasta 2 items de wishlists con nombre truncado y precio.
  - Layout: `flex-col` en mobile, `sm:flex-row` en tablets+.

### Prompt Suggestions (ChatInputBar)
Debajo del area de welcome, en el `ChatInputBar`, aparecen 4 chips de sugerencias en un scroll horizontal:
1. `"Design a custom..."` (icono sparkles)
2. `"Show me t-shirts..."` (icono camiseta)
3. `"What's trending..."` (icono paleta)
4. `"Gift ideas..."` (icono regalo)

Estos chips desaparecen en cuanto hay al menos 1 mensaje en la conversacion (`messages.length === 0`).

### WelcomePopup (First-Time Experience)
Para usuarios anonimos que visitan `/chat` por primera vez en la sesion:
- Se muestra un `Dialog` modal (`WelcomePopup`).
- Contenido: Logo SKAPARA, titulo con nombre de marca, descripcion, 3 beneficios con checkmarks, teaser de suscripcion.
- CTAs: "Sign Up" (primary), "Log In" (outline), "Continue as Guest" (text link).
- Persistencia: Se guarda en `sessionStorage` bajo key `pod-welcome-seen`. Reaparece en nuevas sesiones de navegador.
- NO se muestra a usuarios logueados.

---

## 3. Input Bar (ChatInputBar)

### Estructura visual
Barra fija en la parte inferior del area de chat (fuera del scroll container, `flex-shrink-0`):

```
[Prompt chips (horizontal scroll, solo si 0 mensajes)]
+---------------------------------------------------+
| [Paperclip] [__________Input__________] [Mic] [>] |
+---------------------------------------------------+
[AI disclaimer text, centered, 10px]
```

### Elementos del input bar
- **Boton Paperclip** (izquierda): Abre el file picker nativo (`<input type="file" accept="image/*">`). Ghost button, `h-9 w-9` mobile, `h-10 w-10` desktop.
- **Campo de texto**: `Input` de shadcn, sin bordes (`border-0 bg-transparent`), placeholder i18n (`inputPlaceholder`). Disabled cuando `isLoading` o `isLimitReached`.
- **Boton Mic** (condicional): Solo aparece si `SpeechRecognition` API esta soportada en el navegador (Chrome/Edge). Toggle on/off con animacion `animate-pulse` en rojo cuando graba.
- **Boton Send** (derecha): Circular primary, disabled si no hay texto ni imagen.
- **AI Disclaimer**: Texto minusculo centrado debajo del input (`aiDisclaimer` i18n).

### Image Preview
Cuando se selecciona una imagen (por file picker o drag-and-drop), aparece un thumbnail (`h-14 w-14`) dentro del input bar, encima del formulario, con un boton X (destructive) para removerla.

### Comportamiento del input
- **Enter**: Envia mensaje (sin Shift).
- **Shift+Enter**: No hay soporte explicito para multilinea (usa `<Input>` no `<Textarea>`).
- **Drag & Drop**: El contenedor entero de ChatArea soporta `onDragOver`/`onDrop` para imagenes.

### Limites alcanzados
Cuando el usuario alcanza su limite:
- El placeholder cambia a un mensaje de limite (`limitReached` o `limitReachedFree`).
- El input se deshabilita con `opacity-50`.
- Los botones Send y Mic se deshabilitan.

---

## 4. Flujo de Conversacion

### Envio de mensaje
1. Usuario escribe texto y/o adjunta imagen.
2. `handleSubmit` en ChatArea decide:
   - Con imagen: Llama `sendMessage({ text, files: [{ type: 'file', filename, mediaType, url }] })`.
   - Sin imagen: Llama `sendMessage({ text })`.
3. La imagen seleccionada se limpia inmediatamente despues del envio.

### Transporte (useChatTransport)
- Usa AI SDK 6 (`useChat` con `DefaultChatTransport`).
- API endpoint: `POST /api/chat`.
- Custom fetch wrapper anade:
  - Header `x-csrf-token` (CSRF protection).
  - Header `x-conversation-id` (session continuity).
- El conversation ID se extrae de la respuesta (`x-conversation-id` header) y se persiste en `sessionStorage`.

### Visualizacion de mensajes (ChatMessages)

**Mensaje del usuario**:
- Alineado a la derecha (`justify-end`).
- Burbuja `rounded-2xl bg-primary text-primary-foreground`, max-width 80%.
- Avatar: Circulo con icono `User` de lucide, a la derecha.
- Si incluye imagen: Se muestra como `<img>` debajo del texto, `max-w-xs rounded-lg`.

**Mensaje del asistente**:
- Alineado a la izquierda (`justify-start`).
- Avatar de marca SKAPARA a la izquierda (`h-8 w-8`), con fallback a la primera letra del nombre.
- Soporte para tema: Logo light visible en modo claro, logo dark en modo oscuro.
- Texto renderizado con `SafeMarkdown` dentro de burbuja `bg-muted rounded-2xl`, con soporte prose (listas, headers, etc.).
- Cada parte del mensaje se renderiza secuencialmente: texto, archivos, tool artifacts.

**Typing Indicator**:
- Aparece cuando `isLoading === true` (status === 'submitted' o 'streaming').
- Tres dots animados con `animate-bounce` escalonado (`[animation-delay:-0.3s]`, `-0.15s`, `0`).
- Avatar de SKAPARA a la izquierda, burbuja `bg-muted`.

**Error Display**:
- Avatar con `!` en fondo destructive.
- Burbuja con borde `border-destructive/20`, fondo `bg-destructive/10`.
- Texto de error generico + detalle del error.

### Auto-scroll
- Scroll automatico al ultimo mensaje via `scrollIntoView({ behavior: 'smooth' })`.
- Respeta la posicion del usuario: Si el usuario ha scrolleado >150px hacia arriba (`userScrolledUpRef`), no fuerza auto-scroll.
- Se recalcula en cada cambio de `messages.length`.

---

## 5. Transicion Mensaje a Artefacto

### Mecanismo de deteccion
Dentro de `ChatMessages`, cada `message.parts` se itera. Cuando una parte tiene tipo `tool-invocation` (detectado por `isToolUIPart(part)`), se busca en el `artifactRegistry` el componente correspondiente al nombre de la herramienta.

### Estados del artefacto

1. **Input streaming / Input available** (`part.state`):
   - Se muestra el `Skeleton` del artefacto registrado.
   - Para `ProductGrid`: Grid de 6 cards con `animate-pulse` (aspect-square gris, barras de texto).
   - Para `DesignPreview`: Card con header y area de imagen pulsando.

2. **Output available** (`part.state === 'output-available'`):
   - Transicion con animacion: `animate-in fade-in slide-in-from-bottom-2 duration-300`.
   - Se renderiza el `Component` completo con los datos del output.

3. **Output error**:
   - Texto `text-destructive` con mensaje generico.

4. **Tool execution failure** (`output.success === false`):
   - Se muestra el error inline en el chat, no como artefacto.

### Artefactos disponibles (Registry)

| Tool Name | Componente | Uso |
|---|---|---|
| `product_search` | ProductGridArtifact | Busqueda de productos |
| `browse_catalog` | ProductGridArtifact | Navegacion del catalogo |
| `get_recommendations` | ProductGridArtifact | Recomendaciones personalizadas |
| `get_product_detail` | ProductDetailArtifact | Detalle de un producto |
| `compare_products` | ComparisonTableArtifact | Tabla comparativa |
| `get_size_guide` | SizeGuideArtifact | Guia de tallas |
| `get_cart` | CartSummaryArtifact | Resumen del carrito |
| `estimate_shipping` | PricingTableArtifact | Estimacion de envio |
| `create_checkout` | ApprovalCardArtifact | Aprobacion de checkout |
| `track_order` | OrderTimelineArtifact | Timeline de un pedido |
| `get_order_history` | OrderListArtifact | Lista de pedidos |
| `request_return` | ReturnRequestArtifact | Solicitud de devolucion |
| `generate_design` | DesignPreviewArtifact | Preview de diseno generado |
| `customize_design` | DesignPreviewArtifact | Preview de diseno personalizado |
| `remove_background` | DesignPreviewArtifact | Preview con fondo removido |
| `ai_design_generate` | DesignPreviewArtifact | Diseno AI alternativo |
| `apply_design_to_product` | ProductMockupArtifact | Mockup de producto con diseno |

### Flujos especiales en artefactos

**Checkout Approval** (`create_checkout` con `needsApproval`):
- El artefacto muestra un `ApprovalCard` con boton Approve/Deny.
- Al aprobar: POST a `/api/checkout/create-session`, redirige a Stripe Checkout.
- Al denegar: Envia mensaje de cancelacion al chat.

**Return Request** (`request_return` con `needsApproval`):
- Similar a checkout, con formulario de razon.
- Al aprobar: POST a `/api/orders/{id}/returns`.

**Checkout Redirect** (`confirm_checkout` con `checkoutUrl`):
- Componente `CheckoutRedirect` usa `useEffect` para `window.location.href = url`.
- Muestra "Redirecting to checkout..." mientras navega.

---

## 6. Layout Split: Chat vs Artefacto (Detail Panel)

### Desktop (lg:)
Layout de 3 columnas flexibles:

```
+----------+------------------+----------+
| Sidebar  |   Chat Area      | Detail   |
| 240px    |   flex-1         | Panel    |
| (toggle) |   (scrollable)   | 340px    |
|          |                  | (condi-  |
|          |                  |  cional) |
+----------+------------------+----------+
```

- **Sidebar izquierda**: 240px fijo, colapsable a 0px con transicion CSS de 300ms.
- **Chat area**: `flex-1`, ocupa todo el espacio disponible.
- **Detail Panel derecho**: 340px fijo, aparece solo cuando `showDetailPanel === true` (hay artifacts en StorefrontContext o selectedProduct). Animacion de entrada: `animate-in slide-in-from-right duration-300`.
- **No es resizable**: Los anchos son fijos, no hay drag handles.

### Mobile (<lg:)
- **Detail Panel**: Se muestra como overlay fullscreen (`fixed inset-0 z-50 bg-background animate-in slide-in-from-bottom`).
- El chat queda oculto detras del overlay.
- El usuario cierra el panel con el boton X en el header del DetailPanel.

### Activacion del Detail Panel
El panel se activa cuando:
1. Un producto es clickeado en un artefacto inline (`onSelectProduct`). Esto:
   - Llama `setSelectedProduct(productId)`.
   - Llama `addArtifact()` para agregar al stack de artefactos.
2. Desde el sidebar (click en producto recomendado).
3. Desde el boton "Ask about this product" en el DetailPanel (envia mensaje al chat via `ChatMessageContext`).

### Tabs multiples en Detail Panel
Si hay multiples artefactos abiertos:
- Se muestran como tabs horizontales con `Tabs/TabsList/TabsTrigger/TabsContent` de shadcn.
- Cada tab tiene un boton X para cerrar (opacity 0 por defecto, visible en hover).
- Max-width de 180px por tab, titulo truncado.
- El artefacto activo se controla via `activeArtifactId` en `StorefrontContext`.

---

## 7. Interaccion con Artefactos

### ProductGridArtifact (busquedas, recomendaciones)
- Grid responsive: `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`.
- Max 6 productos para `variant="inline"`.
- Cada card:
  - **Imagen**: Aspect-square, hover scale 1.03. Soporta color swatches si hay `colorImages`.
  - **Wishlist heart**: Boton absolute en esquina superior derecha.
  - **Info**: Categoria (uppercase 10px), titulo (1 linea truncada), rating con estrellas, precio con soporte a compare-at.
  - **Botones de accion** (siempre visibles):
    - **Add to Cart** (icono ShoppingCart, primary accent): Agrega al carrito con 1 unidad. Si el producto requiere seleccion de variante, abre el DetailPanel.
    - **View Details** (icono Eye, outline): Abre el DetailPanel con el producto.
- **Click en la card entera**: Tambien abre el DetailPanel.

### DesignPreviewArtifact (disenos generados)
Dentro del chat se muestra un `Card` con:
- **Header**: Icono Sparkles + titulo "Your Design" + badges (provider, style, bg removed).
- **Imagen**: Aspect-square, renderizada con Next.js `Image`. Si el fondo fue removido, se muestra un patron de tablero de ajedrez detras.
- **Prompt**: Se muestra el prompt original debajo de la imagen.
- **4 botones de accion**:
  1. **Download**: Abre la URL de la imagen en nueva pestana.
  2. **Remove BG**: POST a `/api/designs/remove-bg`. Muestra estado de carga. El boton se deshabilita despues de remover.
  3. **View on Mockup**: POST a `/api/designs/mockup`. Genera un mockup en camiseta.
  4. **Add to Product**: Callback `onAddToProduct` (no implementado inline, requiere flujo externo).

### Checkout ApprovalCardArtifact
- Muestra resumen del carrito con items, cantidades, precios.
- Dos botones: "Approve" (crea Stripe Checkout session) y "Deny" (cancela).
- Al aprobar, redirige a la URL de Stripe Checkout.

### OrderTimelineArtifact
- Timeline visual del pedido con estados (pending, processing, shipped, delivered).
- Inline en el chat.

### ProductView en DetailPanel
Cuando un producto se abre en el DetailPanel:
- **Galeria de imagenes** con thumbnails, soporte a variant-based image filtering.
- **Variant selectors**: Tallas y colores con estados available/unavailable.
- **Quantity selector**.
- **Footer actions**: Add to Cart (primary), Link a Design Studio (`/design/{productId}`), Wishlist toggle, "Ask about this product" (envia mensaje al chat).
- **Precio reactivo**: Cambia segun la combinacion de variantes seleccionada.
- **Especificaciones**: Materials, print technique, manufacturing country, care instructions, safety info.

---

## 8. Image Upload

### Metodos de upload
1. **File picker**: Click en boton Paperclip en el input bar. Abre `<input type="file" accept="image/*">`.
2. **Drag and drop**: Arrastrar imagen sobre todo el area de ChatArea (`onDragOver`/`onDrop`).

### Validaciones (useImageUpload)
- Solo archivos de tipo `image/*`.
- SVG rechazado explicitamente (prevencion XSS).
- Tamano maximo: 5MB.
- Los errores se muestran via `toast.error()` de Sonner.

### Flujo
1. Archivo seleccionado o dropeado.
2. `FileReader.readAsDataURL()` convierte a base64.
3. Preview aparece como thumbnail `h-14 w-14` en el input bar.
4. Al enviar, se incluye como `files` array en el payload del mensaje: `{ type: 'file', filename: 'uploaded-image.png', mediaType: 'image/png', url: dataURL }`.
5. El preview se limpia inmediatamente despues del envio.
6. En el historial de chat, la imagen del usuario se muestra como `<img>` con `max-w-xs rounded-lg`.

### Cleanup
- `FileReader` anterior se aborta si se selecciona una nueva imagen antes de terminar la lectura.
- `FileReader` se aborta en unmount del hook para prevenir memory leaks.

---

## 9. Mobile Experience

### Layout mobile (<md:)
- **No hay sidebar visible**: Se accede via Sheet drawer (hamburger en header).
- **Chat ocupa toda la pantalla**: El area de chat es `flex-1` con `pb-16` para dejar espacio al BottomNav.
- **BottomNav**: Barra fija en la parte inferior con 4 iconos (Chat, Shop, Cart, Profile), `min-h-[56px]`. Incluye badge de cantidad en Cart.
- **Input bar**: Pegado al bottom, encima del BottomNav. Padding reducido (`px-3 pb-2 pt-1`). Botones `h-9 w-9` (vs `h-10 w-10` en desktop).

### Chat vs artefactos en mobile
- Los artefactos inline (ProductGrid, DesignPreview, etc.) se renderizan dentro del scroll del chat.
- Si el usuario hace click en "View Details" o click en una card:
  - Se abre el DetailPanel como **overlay fullscreen** (`fixed inset-0 z-50`).
  - Animacion: `slide-in-from-bottom duration-300`.
  - El chat queda oculto detras.
  - Se cierra con el boton X en la cabecera del panel.
- **No hay tabs visibles en mobile**: El DetailPanel ocupa toda la pantalla, solo un artefacto a la vez.

### Prompt chips en mobile
- Scroll horizontal con `overflow-x-auto scrollbar-hide`.
- `whitespace-nowrap shrink-0` para que no hagan wrap.
- Touch-friendly: `active:scale-95` feedback.

### Responsive breakpoints del chat
- `px-3 py-4` (mobile) -> `sm:px-4` (small) -> `md:px-6 md:py-6` (tablet+).
- Max-width de mensajes: `max-w-4xl mx-auto`.
- Burbujas de usuario: `max-w-[80%]`.

---

## 10. Persistencia de Conversaciones

### SessionStorage (cliente)
Hook `useChatSession` gestiona:
- **Serializacion**: Mensajes se guardan en `sessionStorage` bajo key `pod-chat-messages`. Solo se guardan partes `text` y tool parts con `state === 'output-available'` (no streaming intermedios).
- **Debounced write**: Se escribe con 500ms de debounce para evitar escrituras en cada token de streaming.
- **Timestamp**: `pod-chat-ts` guarda el epoch del inicio de la conversacion.
- **Conversation ID**: `pod-conversation-id` persiste el ID de la conversacion.

### TTL (Time To Live)
- **Usuarios anonimos**: TTL de 3 horas. Despues de 3 horas, la conversacion se borra de sessionStorage al volver a la pagina/tab.
- **Usuarios logueados**: Sin TTL, la conversacion persiste mientras la sesion de navegador este activa.
- **Comprobaciones de expiracion**: En mount, en `visibilitychange` (volver a la tab), en `focus`, y cada 10 minutos via `setInterval`.
- **Efecto de expiracion**: Cuando expira, `sessionExpired` se pone a `true`, y un `useEffect` one-shot en ChatArea limpia los mensajes con `setMessages([])`.

### Server-side (Supabase)
- Cada conversacion se upserta en tabla `conversations` (fire-and-forget, no bloquea).
- Cada mensaje del usuario se inserta en tabla `messages` (fire-and-forget).
- Los mensajes del asistente se guardan via `onFinish` callback del `streamText`.
- Cliente de escritura: User-scoped JWT para usuarios autenticados (RLS), service key para anonimos.

### Restauracion
- Al montar ChatArea, `useChatSession` deserializa los mensajes desde `sessionStorage` y los pasa como `initialMessages` a `useChat`.
- Si la sesion ha expirado (anon + >3h), no se restauran mensajes.

### Limitaciones actuales
- **No hay historial de conversaciones**: El usuario no puede ver conversaciones anteriores. Solo la conversacion actual se mantiene en sessionStorage.
- **Una conversacion a la vez**: No hay UI para crear "nueva conversacion" ni para cambiar entre conversaciones.
- **sessionStorage, no localStorage**: Se pierde al cerrar la pestana/navegador.

---

## 11. Engagement y Monetizacion

### Flujo de engagement por niveles

**Nivel 1 — WelcomePopup** (primera visita, anonimo):
- Dialog modal con beneficios de registro.
- CTA: Sign Up, Log In, Continue as Guest.
- Se muestra una vez por sesion de navegador.

**Nivel 2 — SignupBanner** (50%+ de uso, anonimo):
- Banner inline sutil entre el area de mensajes y el input bar.
- Formato pill: "X of Y messages used. [Sign up free]".
- Dismissable con X. Polling cada 30s via `/api/usage/status`.
- Se re-fetcha despues de cada mensaje enviado.

**Nivel 3 — AuthWallModal** (limite alcanzado, anonimo):
- Dialog modal con 5 beneficios de registro.
- CTA: Sign Up, Log In, Continue Browsing.
- Se activa cuando el servidor responde `429` con `code: LIMIT_REACHED` y el usuario no esta logueado.

**Nivel 4 — UpgradeModal** (limite alcanzado, usuario free):
- Dialog modal con comparativa Free vs Premium (2 columnas).
- Features listadas con checkmarks.
- CTA: "Upgrade Now" (redirige a Stripe via `/api/subscription/create`).
- Se activa cuando el servidor responde `429` con `code: LIMIT_REACHED` y el usuario esta logueado.

### Intercepcion en el transporte
`useChatTransport` intercepta respuestas `429`/`403`:
1. Clona la response y lee el body.
2. Si `body.code === 'LIMIT_REACHED'`:
   - Marca `isLimitReached = true` (deshabilita input).
   - Si anonimo: muestra `AuthWallModal`.
   - Si logueado: muestra `UpgradeModal`.
   - Retorna una response vacia con `text/event-stream` para que `useChat` no muestre error raw.

### Pre-check en mount
Para usuarios anonimos, al montar `useChatTransport` se hace un GET a `/api/usage/status`. Si `chat.remaining <= 0`, se marca `isLimitReached` inmediatamente para bloquear el input antes de que el usuario intente enviar un mensaje.

---

## 12. Voice Input

### Implementacion (useSpeechToText)
- Usa `Web Speech API` (`SpeechRecognition` / `webkitSpeechRecognition`).
- **Soporte**: Chrome/Edge (completo), Safari (limitado), Firefox (no soportado).
- **Progressive enhancement**: Si no esta soportado, `isSupported === false` y el boton Mic no se renderiza.

### Flujo
1. Usuario presiona boton Mic.
2. Se solicita permiso de microfono via `navigator.mediaDevices.getUserMedia({ audio: true })`.
3. Si permitido, inicia reconocimiento con locale mapeado: `en` -> `en-US`, `es` -> `es-ES`, `de` -> `de-DE`.
4. Resultados intermedios se ignoran en el UI (solo se usa el transcript final).
5. Al finalizar, el texto reconocido se concatena al contenido actual del input.
6. El boton Mic cambia a estado "recording": fondo `bg-destructive/10`, icono con `animate-pulse`.
7. Segundo click detiene la grabacion.

### Manejo de errores
- `not-allowed`: "Microphone access denied. Please enable microphone permissions."
- `no-speech`: "No speech detected. Please try again."
- `network`: "Network error. Please check your connection."
- `aborted`: Silencioso (no muestra error).
- Todos los errores se muestran via `toast.error()`.

---

## 13. Journey Map Consolidado

```
USUARIO ANONIMO (primera visita)
=================================

1. Entra a /chat
   |
2. Ve WelcomePopup (Dialog modal)
   |-- Sign Up -> /auth/register
   |-- Log In -> /auth/login
   |-- Continue as Guest -> dismiss
   |
3. Ve ChatWelcome (logo + titulo generico)
   + 4 prompt chips horizontales
   |
4. Escribe mensaje o clickea un chip
   |
5. Mensaje aparece en burbuja primary (derecha)
   + Avatar User
   |
6. Typing indicator (3 dots bounce)
   |
7. Respuesta AI aparece:
   |-- Texto: burbuja bg-muted con SafeMarkdown
   |-- Artefacto: skeleton pulsante -> fade-in del componente
   |
8. Si artefacto es ProductGrid:
   |-- Ve grid de 1-6 productos
   |-- Click en card o "View Details":
   |     |-- Desktop: DetailPanel 340px aparece a la derecha (slide-in)
   |     |-- Mobile: Overlay fullscreen (slide-in-from-bottom)
   |-- Click "Add to Cart": Agrega al carrito directamente
   |-- Click wishlist heart: Toggle wishlist
   |
9. Si artefacto es DesignPreview:
   |-- Ve card con imagen generada
   |-- Puede: Download, Remove BG, View Mockup, Add to Product
   |
10. Despues de ~50% de mensajes usados:
    |-- SignupBanner aparece entre mensajes e input
    |
11. Al alcanzar limite:
    |-- AuthWallModal se muestra
    |-- Input se deshabilita
    |-- Opciones: Sign Up, Log In, Continue Browsing
    |
12. Navegacion interna:
    |-- BottomNav (mobile) o Sidebar (desktop)
    |-- Al volver a /chat, el estado de la conversacion persiste
    |-- Despues de 3h sin actividad, se borra


USUARIO LOGUEADO (returning)
=============================

1. Entra a /chat
   |
2. NO ve WelcomePopup
   |
3. Ve ChatWelcome personalizado:
   |-- "Welcome back, {nombre}"
   |-- Cards: Active Orders + Recent Favorites
   |-- 4 prompt chips
   |
4-9. Mismo flujo de conversacion
   |
10. En DetailPanel, acciones adicionales:
    |-- Link a Design Studio (/design/{id})
    |-- "Ask about this product" -> envia mensaje al chat
    |
11. Si alcanza limite (free tier):
    |-- UpgradeModal (Free vs Premium comparison)
    |-- CTA: Upgrade Now -> Stripe subscription
    |
12. Conversacion persiste sin TTL (mientras session activa)


INTERACCION CON DETAIL PANEL
==============================

1. Click en producto (artefacto o sidebar)
   |
2. addArtifact() en StorefrontContext
   + setSelectedProduct(id)
   |
3. showDetailPanel = true
   |-- Desktop: aside 340px con slide-in-from-right
   |-- Mobile: fixed inset-0 overlay
   |
4. Contenido del panel:
   |-- Galeria de imagenes (con variant filtering)
   |-- Titulo, rating, precio (reactivo a variantes)
   |-- Descripcion
   |-- Especificaciones (materials, care, safety)
   |-- Variant selectors (tallas, colores)
   |-- Quantity selector
   |-- Footer: Add to Cart | Design Studio link | Wishlist | Ask AI
   |
5. Si multiples artefactos:
   |-- Tabs horizontales en el header del panel
   |-- Cada tab closeable con X (hover-visible)
   |-- Click entre tabs cambia el contenido
   |
6. Cerrar panel:
   |-- Boton X en header
   |-- clearArtifacts() + setSelectedProduct(null)
```

---

## 14. Server-Side: API /api/chat

### Pipeline de procesamiento
Orden de operaciones al recibir un mensaje:

1. **Rate limiting** (IP + fingerprint).
2. **Auth resolution**: Cookie `sb-access-token` -> Supabase user ID + tier.
3. **Block check**: Anomaly monitor auto-block.
4. **Velocity check**: Anti-bot (5+ msgs en <3s).
5. **Concurrent limit**: Max 2 streaming requests simultaneos por identifier.
6. **Usage check**: Per-tier daily limits (conversations + messages).
7. **Token budget check**: Per-tier daily token limit.
8. **Input validation**: Max 4000 caracteres.
9. **Sliding window**: Cap a 40 mensajes de contexto.
10. **Conversation persistence**: Upsert en DB (fire-and-forget).
11. **Message save**: Insert user message en DB (fire-and-forget).
12. **Content safety**: Prompt safety check (regex patterns).
13. **FAQ context**: Carga de FAQ para CAG.
14. **RAG**: Busqueda semantica de productos relevantes.
15. **System prompt**: Construccion con locale + FAQ + RAG.
16. **Tools**: Carga de tools con contexto de usuario.
17. **Streaming**: `streamText` con Gemini 2.5 Flash, max tool loops (3 free, 5 premium).
18. **Response**: SSE stream con header `x-conversation-id`.

### Modelo
- **LLM**: Gemini 2.5 Flash (Google).
- **Token budget**: Tier-based (definido en `TOKEN_BUDGET`).
- **Tool loops**: Max 3 steps (free), 5 steps (premium) via `stopWhen: stepCountIs()`.

---

## 15. Archivos Clave

| Archivo | Responsabilidad |
|---|---|
| `src/app/[locale]/(app)/chat/page.tsx` | Pagina que renderiza null (metadata only) |
| `src/app/[locale]/(app)/layout.tsx` | Envuelve children en StorefrontLayout |
| `src/components/storefront/StorefrontLayout.tsx` | AppShell: sidebar + header + ChatArea + DetailPanel + BottomNav |
| `src/components/storefront/StorefrontContext.tsx` | Estado global: selectedProduct, artifacts, activeArtifactId |
| `src/components/storefront/ChatMessageContext.tsx` | Puente: mensajes pendientes entre DetailPanel y ChatArea |
| `src/components/storefront/ChatArea.tsx` | Orquestador: compone hooks + subcomponentes |
| `src/components/storefront/ChatWelcome.tsx` | Welcome screen (brand + greeting + context cards) |
| `src/components/storefront/ChatMessages.tsx` | Renderizado de mensajes + tool artifacts + typing indicator |
| `src/components/storefront/ChatInputBar.tsx` | Input bar: texto, voz, imagen, prompt chips |
| `src/components/storefront/DetailPanel.tsx` | Panel derecho: ProductView + ArtifactContent + tabs |
| `src/components/storefront/BottomNav.tsx` | Barra de navegacion mobile (4 items) |
| `src/hooks/useChatSession.ts` | Persistencia sessionStorage, TTL, conversation ID |
| `src/hooks/useChatTransport.ts` | AI SDK 6 transport, CSRF, engagement intercept |
| `src/hooks/useImageUpload.ts` | File picker, drag-drop, validacion, FileReader |
| `src/hooks/useSpeechToText.ts` | Web Speech API, locale-aware, progressive enhancement |
| `src/components/artifacts/registry.tsx` | Mapeo tool name -> componente + skeleton |
| `src/components/artifacts/DesignPreviewArtifact/DesignPreviewArtifact.tsx` | Preview de diseno con acciones |
| `src/components/artifacts/ProductGridArtifact/ProductGridArtifact.tsx` | Grid de productos con cards interactivas |
| `src/components/engagement/WelcomePopup.tsx` | First-time dialog para anonimos |
| `src/components/engagement/SignupBanner.tsx` | Banner sutil de uso al 50%+ |
| `src/components/engagement/AuthWallModal.tsx` | Modal de registro al alcanzar limite |
| `src/components/engagement/UpgradeModal.tsx` | Modal de upgrade Free vs Premium |
| `src/app/api/chat/route.ts` | API endpoint: auth, rate limit, RAG, streaming |
