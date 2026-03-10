---
description: Validacion completa del frontend e-commerce antes de produccion
---

# SKAPARA Frontend — Validacion Pre-Produccion E2E

Validacion exhaustiva de TODOS los flujos del e-commerce: auth, usuarios, sesiones, IA generativa, pagos, envios, pedidos, planes, productos, sync, precios y UX completa.

**Requisito**: El servidor de desarrollo debe estar corriendo en `localhost:3000`.
**Credenciales test**: `l.roy.lwe@gmail.com` / `TestPass123456!`
**Modelo AI**: Gemini 2.5 Flash (24 tools, 12 artifacts, 6 image providers)
**Stack**: Next.js 16 + Supabase Auth + Stripe + Printful + AI SDK v6
**Locales**: en/es/de (EUR, multi-locale formatting)
**Paginas**: 40 pages en 4 route groups: (landing), (app), (focused), (editor)

## INSTRUCCIONES DE EJECUCION

Ejecutar las fases EN ORDEN, de mas rapida a mas lenta. Usar tool calls de Bash para cada comando. NO ejecutar todo en paralelo — seguir el orden de fases. Dentro de cada fase, puedes paralelizar comandos independientes.

Si una fase falla criticamente (errores de compilacion, tests rotos), PARAR y reportar antes de continuar.

---

## FASE 1: Analisis Estatico (Lint + Types)

### 1.1 ESLint
```bash
cd frontend && npm run lint 2>&1 | tail -20
```

### 1.2 TypeScript strict
```bash
cd frontend && npm run type-check 2>&1 | tail -30
```

---

## FASE 2: Tests Unitarios (Vitest)

### 2.1 Ejecutar tests unitarios con coverage
```bash
cd frontend && npm test 2>&1 | tail -30
```

### 2.2 Verificar thresholds de coverage (70% lines, 60% branches)
```bash
cd frontend && npx vitest run --coverage 2>&1 | grep -E "(Statements|Branches|Functions|Lines|FAIL|ERROR|All files)" | head -15
```

### 2.3 Tests unitarios criticos — verificar que pasan
- `currency.test.ts` — formateo EUR multi-locale
- `SafeMarkdown.test.tsx` — XSS sanitization
- `zod-schemas.test.ts` — validacion de schemas
- `printful-mapper.test.ts` — mapeo de datos POD
- `sync-engine.test.ts` — motor de sincronizacion
- `webhook-router.test.ts` — routing de webhooks
- `webhook-verification.test.ts` — verificacion de firmas

---

## FASE 3: Verificacion de API Routes (Existencia + Health)

Ejecutar estos curls para verificar que las rutas responden (200, 401, 405 — NO 404/500).

### 3.1 Health y Ping
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health && echo " /api/health"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/ping && echo " /api/ping"
```

### 3.2 Auth Routes (9 endpoints)
```bash
for route in auth/login auth/register auth/logout auth/me auth/session auth/verify-email auth/forgot-password auth/reset-password auth/providers; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

### 3.3 Products & Catalog (7 endpoints)
```bash
for route in products categories "products/trending"; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

### 3.4 Cart & Checkout (5 endpoints)
```bash
for route in cart "cart/shipping-estimate" "checkout/create-session" "checkout/calculate-tax" "coupons/validate"; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

### 3.5 Orders & Returns (3 endpoints)
```bash
for route in orders "returns" notifications; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

### 3.6 User Profile (7 endpoints)
```bash
for route in "user/profile" "profile/avatar" "profile/payment-methods" "profile/export" "profile/change-email" "profile/change-password" "profile/delete"; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

### 3.7 AI & Designs (10 endpoints)
```bash
for route in chat "designs" "designs/ai-generate" "designs/compose" "designs/compose-v2" "designs/mockup" "designs/remove-bg" "designs/estimate" "designs/history" "design-assets/templates"; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

### 3.8 RAG (6 endpoints)
```bash
for route in "rag/search" "rag/stats" "rag/verify-schema" "rag/list-all" "rag/index" "rag/add-documents"; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

### 3.9 Subscription & Billing (4 endpoints)
```bash
for route in "subscription/create" "subscription/portal" "subscription/usage" "billing/portal"; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

### 3.10 Wishlist (5 endpoints)
```bash
for route in wishlist "wishlist/items" "wishlist/share" "wishlist/sync"; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

### 3.11 Newsletter (5 endpoints)
```bash
for route in "newsletter/subscribe" "newsletter/unsubscribe" "newsletter/campaigns" "newsletter/drip-sequence-docs"; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

### 3.12 Analytics & Notifications (5 endpoints)
```bash
for route in "analytics/track" "notifications" "notifications/count" "notifications/unread-count" "notifications/read-all"; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

### 3.13 Storefront Config (4 endpoints)
```bash
for route in "storefront/branding" "storefront/theme" "storefront/personalization-surcharge" "policies"; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

### 3.14 Webhooks (5 endpoints)
```bash
for route in "webhooks/stripe" "webhooks/telegram" "webhooks/whatsapp" "webhooks/cache-invalidate"; do code=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/$route); echo "$code /api/$route (POST)"; done
```

### 3.15 Cron Jobs (10 endpoints)
```bash
for route in "cron/sync-printify" "cron/retry-printify-orders" "cron/cleanup" "cron/abandoned-cart-recovery" "cron/product-metrics" "cron/zombie-reaper" "cron/drip" "cron/cleanup-personal" "cron/cleanup-temp-products" "cron/check-delivery-status"; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

### 3.16 Misc Routes (8 endpoints)
```bash
for route in "consent" "referral" "session/migrate" "tenant-resolve" "tenant/gate" "errors/report" "proxy-image" "verify-domain"; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$route); echo "$code /api/$route"; done
```

**Criterio**: Todos deben responder (200, 401, 405 — NO 404/500). Un 404 significa que la ruta no existe.

---

## FASE 4: E2E — Autenticacion, Sesiones y CSRF

### 4.1 Registro de usuario
Navegar a `/en/auth/register`. Verificar:
- Formulario visible: email, password, nombre
- Validacion client-side (email invalido, password debil)
- Turnstile/captcha presente o graceful skip en dev (TURNSTILE_SECRET_KEY comentada → skip)
- Submit con datos validos → respuesta del servidor (201 o error controlado)
- Redirect post-registro
- **Rate limit**: max 3 registros / 60 min por IP

### 4.2 Login
Navegar a `/en/auth/login`. Verificar:
- Formulario visible: email, password
- Login con credenciales invalidas → error amigable (NO stack trace)
- Login con credenciales validas → redirect a `/en/chat` o `/en/shop`
- **httpOnly cookies**: access token (1h TTL) + refresh token (7d TTL)
- Persistencia de sesion tras refresh
- **Rate limit**: max 5 intentos / 15 min por IP (brute force protection)

### 4.3 CSRF Protection (Double-Submit Cookie)
- Verificar que login/register envian CSRF token
- **Token**: 64 caracteres, 8h TTL, httpOnly cookie
- Request sin CSRF token → 403 Forbidden
- Request con CSRF token expirado → 403 Forbidden

### 4.4 Cross-Tab Auth Sync
- Login en Tab A → Tab B detecta sesion via localStorage broadcast
- Logout en Tab A → Tab B cierra sesion automaticamente
- Token refresh cada 5 minutos (silencioso)

### 4.5 Logout
- Click en logout → sesion destruida
- Redirect a landing o login
- Rutas protegidas ya no accesibles
- Cookies eliminadas correctamente

### 4.6 Forgot/Reset Password
- Navegar a `/en/auth/forgot-password`
- Submit email → mensaje de confirmacion (NO revelar si email existe)
- Pagina `/en/auth/reset-password` acepta token

### 4.7 Verify Email
- Pagina `/en/auth/verify-email` acepta token de verificacion
- UI muestra estado de verificacion

### 4.8 Session Persistence
- Login → cerrar tab → reabrir → sesion activa
- `/api/auth/me` devuelve datos del usuario autenticado
- `/api/auth/session` devuelve sesion valida

### 4.9 Proteccion de Rutas
- Acceder a `/en/profile` sin auth → redirect a login
- Acceder a `/en/orders` sin auth → redirect a login
- Acceder a `/en/wishlist` sin auth → redirect a login
- Acceder a `/en/settings/billing` sin auth → redirect a login
- Acceder a `/en/designs` sin auth → redirect a login

### Ejecutar tests E2E de auth existentes:
```bash
cd frontend && npx playwright test tests/e2e/auth/ --project=chromium --reporter=list 2>&1 | tail -30
```
```bash
cd frontend && npx playwright test tests/e2e/api/auth.spec.ts --project=chromium --reporter=list 2>&1 | tail -20
```

---

## FASE 5: E2E — Catalogo de Productos

### 5.1 Shop Page
Navegar a `/en/shop`. Verificar:
- Grid de productos carga con imagenes
- Cada ProductCard muestra: imagen, nombre, precio, badge de categoria
- Paginacion o infinite scroll funciona
- Loading skeleton visible durante carga

### 5.2 Filtros y Busqueda (Hybrid Search: Gemini 768-dim + PostgreSQL FTS)
- Filtrar por categoria (camisetas, gorras, hoodies, etc.)
- Buscar producto por nombre → resultados relevantes (RRF scoring: vector + FTS)
- Busqueda semantica: "something for summer" → productos relevantes via pgvector 768-dim
- Filtrar por precio (rango)
- Sort: precio asc/desc, newest, popular
- URL refleja filtros aplicados (query params)

### 5.3 Categorias
- Navegar a `/en/shop/category/[slug]` → productos filtrados
- Breadcrumb correcto
- Categoria vacia muestra mensaje adecuado

### 5.4 Product Detail
Navegar a `/en/shop/[id]`. Verificar:
- Imagenes del producto (carousel/gallery) — 3 estrategias de image mapping
- Nombre, descripcion, precio visible
- Selector de talla funcional
- Selector de color funcional (color swatches via `product_variants.image_url`)
- Variantes actualizan precio e imagen (variant pricing detection)
- Boton "Add to Cart" funcional
- **GPSR info** visible en product_details JSONB: safety_information, material, care_instructions, manufacturing_country
- Cross-sell / productos relacionados cargados
- Social proof (reviews count, sold count)
- Size guide link funcional

### 5.5 Productos trending
- `/api/products/trending` devuelve productos
- Seccion trending visible en landing o shop

### 5.6 Precios y Margenes
- Precios muestran EUR con formato correcto (ej: €29.99)
- Precios de variantes se actualizan al cambiar seleccion
- No hay precios en 0 ni negativos
- Si hay descuento, se muestra precio original tachado
- **Margen minimo 40%** en todos los productos (margin auditor)
- Precios terminan en .99 (rounding rule)

### Ejecutar tests existentes:
```bash
cd frontend && npx playwright test tests/e2e/shop/ --project=chromium --reporter=list 2>&1 | tail -30
```
```bash
cd frontend && npx playwright test tests/e2e/api/products.spec.ts --project=chromium --reporter=list 2>&1 | tail -20
```

---

## FASE 6: E2E — Carrito de Compras

### 6.1 Agregar al carrito
- Desde product detail: seleccionar talla + color → Add to Cart
- Toast de confirmacion aparece
- Badge del carrito en header se actualiza
- Producto aparece en `/en/cart`
- **Cookie**: `cart-session-id` (30 dias TTL, httpOnly)
- **Limite**: MAX_CART_QUANTITY por item (no infinito)

### 6.2 CartView
Navegar a `/en/cart`. Verificar:
- Lista de items con imagen, nombre, talla, color, precio, cantidad
- Cambiar cantidad (incrementar/decrementar) → subtotal se actualiza
- Eliminar item → se remueve de la lista
- Carrito vacio muestra mensaje y CTA hacia shop
- **Server-side price authority**: precios calculados en backend, no confiados del frontend
- Subtotal calculado correctamente
- Estimacion de envio visible
- **Envio gratis >= €50** (umbral visible en UI)

### 6.3 Cupon / Descuento (7-step validation)
- Input de cupon visible en cart o checkout
- Cupon invalido → error message
- Cupon valido → descuento aplicado, total actualizado
- Cupon expirado → error message
- **Cupon personal (another user)** → mismo error generico (privacy: no revelar si cupon existe para otro usuario)
- Validacion: codigo, fecha, uso maximo, minimo de compra, categoria, usuario, estado

### 6.4 Guest Cart vs Auth Cart
- Agregar items como guest → items persisten con cart-session-id cookie
- Login → cart merge (guest items + server items)
- `/api/cart/merge` o `/api/session/migrate` funciona correctamente

### 6.5 Personalizacion
- Si producto permite personalizacion (texto custom, imagen)
- Surcharge de personalizacion se muestra
- `/api/storefront/personalization-surcharge` devuelve precio

### 6.6 Abandoned Cart Recovery
- Carrito abandonado 1h → primer email de recuperacion
- Carrito abandonado 24h → segundo email de recuperacion
- `/api/cron/abandoned-cart-recovery` ejecuta el proceso

### Ejecutar tests existentes:
```bash
cd frontend && npx playwright test tests/e2e/cart/ --project=chromium --reporter=list 2>&1 | tail -30
```
```bash
cd frontend && npx playwright test tests/e2e/api/cart.spec.ts --project=chromium --reporter=list 2>&1 | tail -20
```
```bash
cd frontend && npx playwright test tests/e2e/coupons/ --project=chromium --reporter=list 2>&1 | tail -20
```

---

## FASE 7: E2E — Checkout y Pagos (Stripe)

### 7.1 Checkout Flow
Navegar a `/en/checkout`. Verificar:
- Formulario de direccion: nombre, calle, ciudad, codigo postal, pais, telefono
- Direcciones guardadas se cargan para usuarios autenticados
- Validacion de campos obligatorios
- Seleccion de metodo de envio
- Resumen del pedido visible (items, subtotal, envio, impuestos, total)

### 7.2 Crear Checkout Session (Stripe)
- `/api/checkout/create-session` crea sesion de Stripe
- Redirect a Stripe Checkout funciona
- Parametros correctos: line_items, shipping, metadata

### 7.3 Calculo de Impuestos
- `/api/checkout/calculate-tax` calcula impuestos por pais
- VAT para paises EU
- Tax-free para paises aplicables

### 7.4 Shipping Addresses
- CRUD de direcciones guardadas
- `/api/shipping-addresses` lista direcciones
- Crear nueva direccion
- Editar direccion existente
- Eliminar direccion

### 7.5 Success & Cancel Pages
- `/en/checkout/success` muestra confirmacion de pedido
- `/en/checkout/cancel` muestra mensaje de cancelacion con CTA

### 7.6 Payment Methods
- `/api/profile/payment-methods` lista metodos guardados
- Eliminar metodo de pago

### 7.7 Webhooks de Pago
- `POST /api/webhooks/stripe` procesa eventos:
  - `checkout.session.completed` → crea orden
  - `payment_intent.succeeded` → actualiza estado
  - `charge.refunded` → procesa reembolso
- Verificacion de firma Stripe (webhook secret)
- Idempotencia (mismo evento 2x no duplica orden)

### 7.8 Atomic Refund Guard
- **Double-refund prevention**: DB RPC atomico antes de Stripe refund
- Si DB write falla despues de Stripe refund → cancela refund en Stripe automaticamente
- Verificar que refund parcial funciona correctamente

### 7.9 Order Retry Cron
- `/api/cron/retry-printify-orders` reintenta ordenes POD fallidas
- **Max 3 intentos** → despues auto-refund al cliente
- Notificacion al admin de ordenes con fallo permanente

### Ejecutar tests existentes:
```bash
cd frontend && npx playwright test tests/e2e/api/orders.spec.ts --project=chromium --reporter=list 2>&1 | tail -20
```
```bash
cd frontend && npx playwright test tests/integration/webhooks/ --project=chromium --reporter=list 2>&1 | tail -30
```

---

## FASE 8: E2E — Pedidos y Devoluciones

### 8.1 Order History
Navegar a `/en/orders`. Verificar:
- Lista de pedidos con estado, fecha, total, items
- Paginacion si hay muchos pedidos
- Empty state si no hay pedidos

### 8.2 Order Detail
Navegar a `/en/orders/[id]`. Verificar:
- Detalles completos: items, direccion, pago, estado
- Timeline de estado del pedido
- Tracking link si disponible
- Boton de reorder

### 8.3 Invoice
- `/api/orders/[id]/invoice` genera factura
- PDF o vista HTML con datos completos

### 8.4 Reorder
- Boton reorder agrega items al carrito actual
- Verifica disponibilidad de variantes

### 8.5 Returns
- Flujo de devolucion desde order detail
- Seleccion de items a devolver
- Razon de devolucion
- `/api/orders/[id]/returns` procesa solicitud
- Tracking de devolucion via `/api/returns/[id]/tracking`

### 8.6 Order State Machine (transition() RPC)
- `/api/cron/check-delivery-status` actualiza estados
- **Maquina de estados**: pending → paid → in_production → shipped → delivered
- Transiciones invalidas rechazadas (no se puede ir de delivered a pending)
- `transition()` es un RPC atomico en Supabase (no UPDATE directo)
- Cada transicion genera notificacion al usuario

### Ejecutar tests existentes:
```bash
cd frontend && npx playwright test tests/e2e/orders/ --project=chromium --reporter=list 2>&1 | tail -20
```

---

## FASE 9: E2E — IA Generativa (Chat + Disenos)

**Modelo**: Gemini 2.5 Flash | **24 tools** | **12 artifact types** | **6 image providers**

### 9.1 Chat Interface
Navegar a `/en/chat`. Verificar:
- Area de chat visible con input
- Enviar mensaje → respuesta streaming del AI (Gemini 2.5 Flash)
- Mensajes se renderizan con markdown correcto
- SafeMarkdown sanitiza HTML/XSS (DOMPurify)
- History de conversacion persiste
- **Session TTL**: 3h para anonimos, persistente para autenticados

### 9.2 AI Tools (24 tools)
El asistente tiene herramientas. Verificar que responde a:
- "Show me t-shirts" → **ProductGridArtifact** con productos
- "Compare these products" → **ComparisonTable** artifact
- "What size should I get?" → **SizeGuide** artifact
- "Show my cart" → **CartSummary** artifact
- "Show my orders" → **OrderList** / **OrderTimeline** artifact
- "Add [product] to cart" → item agregado al carrito
- Busqueda de productos por contexto natural (CAG + RAG pattern)
- Recomendaciones basadas en preferencias

### 9.3 Content Safety
- **Trademark blocking**: Mensajes con "Nike", "Disney", "Gucci", etc. → rechazados
- **NSFW filtering**: Contenido sexual/violento → bloqueado
- **Hate speech filtering**: Contenido de odio → bloqueado
- **Design intent routing**: Requests de diseno redirigidos al pipeline correcto

### 9.4 Rate Limiting AI (4 capas)
- **Burst limit**: max requests por ventana corta
- **Velocity limit**: max requests por ventana media
- **Daily usage limit**: cuota diaria por usuario
- **Token budget**: max tokens por sesion
- **Anomaly detection**: 5+ rate limit hits en 5min → auto-block usuario

### 9.5 AI Usage Tiers (3 niveles)
- **Anonymous**: funcionalidad limitada, session TTL 3h
- **Free**: cuota diaria con limite
- **Premium**: cuota ampliada, acceso a todos los providers de imagen

### 9.6 Image Generation (6 providers con fallback chain)
- FAL Schnell (rapido), FAL Dev (calidad), FAL Flux Pro (premium)
- DALL-E 3, Ideogram, Recraft
- Fallback automatico si un provider falla

### 9.7 Chat Session Management
- `/api/conversations` lista conversaciones
- `/api/conversations/[id]` carga conversacion especifica
- Nueva conversacion se crea automaticamente
- Session persiste tras refresh

### 9.8 Design Studio
Navegar a `/en/designs`. Verificar:
- UI de creacion de disenos visible
- `/api/designs/ai-generate` genera disenos con IA
- `/api/designs/compose` compone capas de diseno
- `/api/designs/mockup` genera previews del producto
- `/api/designs/remove-bg` remueve fondo de imagenes (rembg sidecar)
- `/api/designs/estimate` estima costos
- History de disenos guardados

### 9.9 Product Personalization
- Desde product detail → personalizar producto
- Canvas de edicion funcional
- Preview del producto personalizado
- Surcharge de personalizacion calculado
- Agregar producto personalizado al carrito

### 9.10 RAG (Knowledge Base)
- `/api/rag/search` busca en knowledge base (pgvector 768-dim + Gemini embeddings)
- `/api/rag/stats` muestra estadisticas
- El chat utiliza RAG para respuestas contextuales sobre productos

### 9.11 Credits & Usage
- `/api/credits/purchase` permite comprar creditos AI
- `/api/subscription/usage` muestra uso actual
- `/api/usage/status` devuelve estado del plan

### Ejecutar tests existentes:
```bash
cd frontend && npx playwright test tests/e2e/chat/ --project=chromium --reporter=list 2>&1 | tail -30
```
```bash
cd frontend && npx playwright test tests/e2e/api/chat.spec.ts --project=chromium --reporter=list 2>&1 | tail -20
```
```bash
cd frontend && npx playwright test tests/e2e/designs/ --project=chromium --reporter=list 2>&1 | tail -20
```
```bash
cd frontend && npx playwright test tests/e2e/api/designs.spec.ts --project=chromium --reporter=list 2>&1 | tail -20
```

---

## FASE 10: E2E — Perfil de Usuario y Settings

### 10.1 Profile Page
Navegar a `/en/profile`. Verificar:
- Datos del usuario visibles (nombre, email, avatar)
- Editar nombre → se guarda
- Upload de avatar → se actualiza

### 10.2 Change Email
- Formulario de cambio de email
- Requiere verificacion del nuevo email
- Email anterior sigue funcionando hasta confirmacion

### 10.3 Change Password
- Formulario: password actual + nueva password (2x)
- Validacion de password strength
- Password actual incorrecta → error

### 10.4 Avatar Upload
- Upload de imagen → procesada con Sharp: 256x256 WebP
- Formato forzado WebP independiente del input
- Imagenes invalidas o muy grandes → error controlado

### 10.5 Account Deletion (GDPR)
- Boton de eliminar cuenta visible
- Requiere confirmacion
- **Periodo de gracia: 30 dias** antes de eliminacion permanente
- Login durante periodo de gracia **NO cancela automaticamente** la eliminacion
- `/api/profile/cancel-deletion` cancela eliminacion pendiente (accion explicita)
- `/api/cron/hard-delete-accounts` ejecuta eliminacion definitiva

### 10.6 Data Export (GDPR)
- `/api/profile/export` genera export de datos personales como **ZIP**
- Incluye: perfil, pedidos, direcciones, conversaciones
- **Rate limit**: 1 export por dia por usuario

### 10.6 Shipping Addresses
- CRUD completo de direcciones de envio
- Direccion por defecto

### 10.7 Notifications
- `/en/profile/notifications` muestra notificaciones
- Mark as read funciona
- Read all funciona
- Unread count correcto en badge

### 10.8 Billing & Subscription
- `/en/settings/billing` muestra plan actual
- Portal de facturacion (Stripe Customer Portal)
- Upgrade/downgrade de plan

---

## FASE 11: E2E — Planes y Subscripciones

### 11.1 Pricing Page
Navegar a `/en/pricing`. Verificar:
- Planes visibles con features y precios
- Comparacion de planes
- CTA de suscripcion funcional

### 11.2 Subscription Flow
- `/api/subscription/create` crea sesion de suscripcion
- Redirect a Stripe para pago
- Post-pago: plan activo en perfil

### 11.3 Usage Tracking
- `/api/subscription/usage` muestra uso vs limites
- Limites se aplican correctamente (AI generations, products, etc.)
- Warning cuando cerca del limite
- Bloqueo cuando se excede el limite

### 11.4 Billing Portal
- `/api/billing/portal` redirect a Stripe portal
- Gestion de metodos de pago
- Historial de facturas
- Cancelacion de suscripcion

---

## FASE 12: E2E — Wishlist

### 12.1 Wishlist Operations
- Agregar producto a wishlist desde ProductCard (corazon)
- Agregar desde ProductDetail
- Navegar a `/en/wishlist` → lista de productos guardados
- Eliminar de wishlist

### 12.2 Wishlist Sharing
- Compartir wishlist genera link publico
- `/en/wishlist/shared/[token]` muestra wishlist compartida
- Visitantes pueden ver pero no editar

### 12.3 Sync
- Wishlist guest se sincroniza al login
- `/api/wishlist/sync` merge items

### Ejecutar tests existentes:
```bash
cd frontend && npx playwright test tests/e2e/wishlist/ --project=chromium --reporter=list 2>&1 | tail -20
```
```bash
cd frontend && npx playwright test tests/e2e/api/wishlist.spec.ts --project=chromium --reporter=list 2>&1 | tail -20
```

---

## FASE 13: E2E — Sync POD y Precios

### 13.1 Printful Sync (7-step flow)
- `/api/cron/sync-printify` (mapea a Printful) sincroniza productos
- **7 pasos**: fetch → compare → update variants → update images → update prices → update GPSR → mark synced
- Verifica que productos tienen imagenes, variantes, precios
- **Admin edit preservation**: cambios manuales del admin NO se sobreescriben por sync
- GPSR data populated en product_details JSONB (safety_information, material, care_instructions)

### 13.2 Margin Auditor
- **Margen minimo 40%** en todos los productos
- Precios terminan en .99 (rounding rule aplicada)
- Precio en Printful es la autoridad — Supabase refleja post-sync
- Margin fixer sobreescribe si margen <40%

### 13.3 Order Fulfillment
- `/api/cron/retry-printify-orders` reintenta ordenes POD fallidas
- **Max 3 intentos** → despues auto-refund
- Estado de produccion se actualiza via webhook

### 13.4 Product Metrics
- `/api/cron/product-metrics` calcula metricas de productos
- Views, conversiones, revenue por producto

### 13.5 Data Integrity
- Todos los productos tienen precio > 0
- Todos los productos tienen al menos 1 variante
- Ninguna variante con price_cents = 0
- Imagenes de productos cargan correctamente (no 404)
- Categorias asignadas correctamente
- **product_variants.image_url** no es NULL (requerido para color swatches)
- **product_details JSONB** tiene safety_information en TODOS los productos activos

### Ejecutar tests de integridad:
```bash
cd frontend && npx playwright test tests/integration/phase2-data-integrity.spec.ts --project=chromium --reporter=list 2>&1 | tail -30
```

---

## FASE 14: E2E — SEO y Metadata

### 14.1 Meta Tags
- Landing page tiene: title, description, og:image, og:title, og:description
- Product pages tienen: structured data (JSON-LD Product), og:image
- Canonical URLs correctas
- Hreflang tags para multi-idioma

### 14.2 Sitemap
- `/api/seo/[locale]` genera sitemap XML valido
- Incluye todas las paginas publicas
- Excluye paginas protegidas

### 14.3 Robots.txt / Sitemap
- `robots.txt` existe y referencia sitemap
- No bloquea paginas publicas

### 14.4 Structured Data
- Product pages: JSON-LD `@type: Product` con name, image, price, availability
- Organization: JSON-LD con logo, contacto
- BreadcrumbList en paginas de categoria

---

## FASE 15: E2E — Internacionalizacion (i18n)

### 15.1 Locale Switching
- Navegar a `/en/` → contenido en ingles
- Navegar a `/es/` → contenido en espanol
- Navegar a `/de/` → contenido en aleman
- Switcher de idioma funciona

### 15.2 Translation Completeness
```bash
cd frontend && node -e "
const en = require('./messages/en.json');
const es = require('./messages/es.json');
const de = require('./messages/de.json');
function getKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? getKeys(v, prefix + k + '.') : [prefix + k]
  );
}
const enKeys = new Set(getKeys(en));
const esKeys = new Set(getKeys(es));
const deKeys = new Set(getKeys(de));
const missingEs = [...enKeys].filter(k => !esKeys.has(k));
const missingDe = [...enKeys].filter(k => !deKeys.has(k));
const extraEs = [...esKeys].filter(k => !enKeys.has(k));
const extraDe = [...deKeys].filter(k => !enKeys.has(k));
console.log('EN keys:', enKeys.size);
console.log('ES keys:', esKeys.size, missingEs.length ? 'MISSING: ' + missingEs.length + ' keys' : 'OK');
console.log('DE keys:', deKeys.size, missingDe.length ? 'MISSING: ' + missingDe.length + ' keys' : 'OK');
if (extraEs.length) console.log('ES extra (orphaned):', extraEs.length);
if (extraDe.length) console.log('DE extra (orphaned):', extraDe.length);
if (missingEs.length > 0) { console.log('Missing ES sample:', missingEs.slice(0,10).join(', ')); }
if (missingDe.length > 0) { console.log('Missing DE sample:', missingDe.slice(0,10).join(', ')); }
" 2>&1
```

### 15.3 Precios en formato local (locale-aware)
- EN (en-IE): €29.99 (dot separator, symbol before)
- DE (de-DE): 29,99 € (comma separator, symbol after)
- ES (es-ES): 29,99 € (comma separator, symbol after)

### 15.4 URLs i18n
- `/en/shop` → ingles
- `/es/shop` → espanol
- `/de/shop` → aleman
- Redireccion automatica basada en Accept-Language

### Ejecutar tests i18n:
```bash
cd frontend && npx playwright test tests/e2e/navigation/i18n.spec.ts --project=chromium --reporter=list 2>&1 | tail -20
```

---

## FASE 16: E2E — Responsive y Mobile UX

### 16.1 Mobile Navigation (375px)
- Header hamburger menu visible
- **Sheet sidebar** se abre/cierra (shadcn/ui Sheet)
- Touch targets minimo 44px (padding p-3)
- Scroll suave sin glitches
- **BottomNav**: 56px, 5 iconos principales visibles
- **Skip navigation** link para accesibilidad

### 16.2 Tablet (768px)
- Grid 2 columnas en shop (`md:grid-cols-2`)
- Navigation adaptada

### 16.3 Desktop (1024px+)
- Grid 3-4 columnas en shop (`lg:grid-cols-3` o `lg:grid-cols-4`)
- Sidebar permanente
- Hover effects en ProductCards
- **CommandPalette** (CMD+K) funcional

### 16.4 Mobile-specific
- Checkout funcional en mobile
- Cart drawer accesible
- Product images swipeable
- Forms usables con teclado virtual

### 16.5 PWA & Service Worker
- **Serwist** service worker registrado
- Offline fallback page visible cuando sin conexion
- Manifest correcto (`/manifest.json` o `manifest.webmanifest`)
- Icons y theme_color definidos

### 16.6 Theme & FOUC
- **Zero FOUC** (Flash of Unstyled Content): tema inyectado antes del render
- Dark mode toggle funcional
- Cookie consent no causa layout shift

### Ejecutar tests responsive:
```bash
cd frontend && npx playwright test tests/e2e/navigation/responsive.spec.ts --project=chromium --reporter=list 2>&1 | tail -20
```
```bash
cd frontend && npx playwright test tests/e2e/navigation/ --project=mobile-chrome --reporter=list 2>&1 | tail -20
```

---

## FASE 17: E2E — Newsletter y Notificaciones

### 17.1 Newsletter Subscribe
- Formulario de email en footer o landing
- `/api/newsletter/subscribe` acepta email
- Email duplicado → error amigable
- Confirmacion por email (double opt-in)
- `/api/newsletter/confirm/[token]` confirma suscripcion

### 17.2 Newsletter Unsubscribe
- Link de unsub en emails
- `/api/newsletter/unsubscribe` funciona
- CAN-SPAM compliance

### 17.3 Push Notifications
- `/api/push/subscribe` registra suscripcion
- Service worker registrado
- Permiso de notificaciones solicitado

### 17.4 In-App Notifications
- Badge de notificaciones no leidas
- Lista de notificaciones
- Mark as read individual y masivo

---

## FASE 18: E2E — Paginas Legales y Compliance

### 18.1 Paginas legales accesibles
```bash
for page in terms privacy cookies returns shipping legal contact faq about size-guide; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/$page); echo "$code /en/$page"; done
```

### 18.2 GDPR Compliance
- Cookie consent banner visible en primera visita
- `/api/consent` guarda preferencias
- **3 categorias**: necessary (siempre), analytics (opt-in), marketing (opt-in)
- No tracking sin consentimiento explicito
- Cambiar preferencias desde pagina de cookies
- Banner NO causa layout shift en la pagina

### 18.3 GPSR (EU Product Safety)
- Cada producto tiene manufacturer info
- Material y care instructions visibles
- Pais de fabricacion indicado

### 18.4 CAN-SPAM
- Footer de emails tiene unsubscribe link
- Direccion fisica del negocio
- Subject lines no enganosas

---

## FASE 19: E2E — Analytics y Error Tracking

### 19.1 Analytics Events
- `/api/analytics/track` acepta eventos
- Page views registrados
- Add to cart events
- Purchase events
- Search events

### 19.2 Error Reporting
- `/api/errors/report` acepta error reports
- Errores client-side se capturan (error boundary)
- Error pages (404, 500) muestran UI amigable

### 19.3 A/B Testing
- `/api/ab-test/experiments` lista experimentos activos
- Asignacion de variante consistente por usuario

---

## FASE 20: E2E — Seguridad

### 20.1 Input Validation (OWASP Top 10)
- SQL injection en search: `'; DROP TABLE products;--` → sin efecto
- XSS en chat: `<script>alert(1)</script>` → sanitizado por SafeMarkdown (DOMPurify)
- XSS en nombre de usuario: `<img onerror=alert(1)>` → sanitizado
- Path traversal en URLs: `/../../../etc/passwd` → 404
- Command injection en design params: `; rm -rf /` → validacion rechaza

### 20.2 Rate Limiting (Especifico por ruta)
- **Login**: max 5 intentos / 15 min por IP
- **Register**: max 3 intentos / 60 min por IP
- **AI Chat**: 4 capas (burst, velocity, daily, token budget)
- **Data export**: max 1/dia por usuario
- **Anomaly detection**: 5+ rate limit hits en 5 min → auto-block temporal

### 20.3 CSRF Protection
- **Double-submit cookie**: token 64 chars, 8h TTL
- Todas las mutaciones (POST/PUT/DELETE) requieren CSRF token
- Cookie httpOnly impide lectura desde JavaScript

### 20.4 CORS
- API rechaza requests de origenes no autorizados
- Preflight OPTIONS responde correctamente
- `Access-Control-Allow-Origin` no es `*` en produccion

### 20.5 Auth Token Security
- Tokens no expuestos en URLs (NUNCA en query params)
- **httpOnly cookies**: access token (1h) + refresh token (7d)
- Refresh token rotation en cada uso
- **Cross-tab sync** via localStorage broadcast (no tokens en localStorage)

### 20.6 Content Safety (AI)
- **Trademark blocking**: Nike, Adidas, Disney, Gucci, Louis Vuitton, Supreme, etc.
- **NSFW/hate speech filter** activo en todos los prompts de generacion
- **Design intent routing**: requests de diseno detectados y redirigidos

### 20.7 Middleware Chain
- Orden: i18n → tenant → A/B testing → CSRF → auth
- Cada capa es independiente y fail-safe

### 20.8 Admin Routes Protected
- `/api/admin/*` requiere rol admin
- No accesible con usuario regular
- Admin session separada del frontend

---

## FASE 21: Build de Produccion

### 21.1 Build Next.js
```bash
cd frontend && npm run build 2>&1 | tail -30
```

### 21.2 Verificar output
```bash
ls -la frontend/.next/standalone/ 2>/dev/null && echo "Standalone build OK" || echo "No standalone build"
```

### 21.3 Verificar que no hay errores de build
- Zero warnings criticos
- Todas las paginas generadas
- Static optimization aplicada donde corresponde

---

## FASE 22: Ejecutar Suite Completa Playwright

Ejecutar cada suite individualmente y reportar resultados.

### 22.1 API tests (rapidos, sin browser)
```bash
cd frontend && npx playwright test tests/e2e/api/ --project=chromium --reporter=list 2>&1 | tail -40
```

### 22.2 Auth E2E
```bash
cd frontend && npx playwright test tests/e2e/auth/ --project=chromium --reporter=list 2>&1 | tail -30
```

### 22.3 Shop E2E
```bash
cd frontend && npx playwright test tests/e2e/shop/ --project=chromium --reporter=list 2>&1 | tail -30
```

### 22.4 Cart & Checkout E2E
```bash
cd frontend && npx playwright test tests/e2e/cart/ --project=chromium --reporter=list 2>&1 | tail -30
```

### 22.5 Chat & AI E2E
```bash
cd frontend && npx playwright test tests/e2e/chat/ --project=chromium --reporter=list 2>&1 | tail -30
```

### 22.6 Orders E2E
```bash
cd frontend && npx playwright test tests/e2e/orders/ --project=chromium --reporter=list 2>&1 | tail -20
```

### 22.7 Wishlist E2E
```bash
cd frontend && npx playwright test tests/e2e/wishlist/ --project=chromium --reporter=list 2>&1 | tail -20
```

### 22.8 Designs E2E
```bash
cd frontend && npx playwright test tests/e2e/designs/ --project=chromium --reporter=list 2>&1 | tail -20
```

### 22.9 Coupons E2E
```bash
cd frontend && npx playwright test tests/e2e/coupons/ --project=chromium --reporter=list 2>&1 | tail -20
```

### 22.10 Admin E2E
```bash
cd frontend && npx playwright test tests/e2e/admin/ --project=chromium --reporter=list 2>&1 | tail -30
```

### 22.11 Navigation & i18n E2E
```bash
cd frontend && npx playwright test tests/e2e/navigation/ --project=chromium --reporter=list 2>&1 | tail -20
```

### 22.12 Integration Tests
```bash
cd frontend && npx playwright test tests/integration/ --project=chromium --reporter=list 2>&1 | tail -30
```

### 22.13 Mobile E2E
```bash
cd frontend && npx playwright test tests/e2e/shop/ --project=mobile-chrome --reporter=list 2>&1 | tail -20
```

---

## Resumen de Cobertura

| Area | APIs | Pages | E2E Specs | Checks clave |
|------|------|-------|-----------|--------------|
| Auth & Sessions | 9 routes | 6 pages | 5 specs | CSRF 64-char, rate limit 5/15min, httpOnly 1h+7d |
| Products & Catalog | 7 routes | 4 pages | 4 specs | Hybrid search (vector+FTS), GPSR JSONB, margin 40% |
| Cart & Coupons | 5 routes | 1 page | 4 specs | Server-side price, cart cookie 30d, 7-step coupon |
| Checkout & Payments | 5 routes + webhooks | 3 pages | 2 specs | Atomic refund guard, free ship >=50EUR, retry 3x |
| Orders & Returns | 5 routes | 2 pages | 1 spec | State machine RPC, order timeline, reorder |
| AI Chat (24 tools) | 3 routes | 1 page | 5 specs | 12 artifacts, 4-layer RL, trademark blocking |
| Design Studio | 10 routes | 1 page | 1 spec | 6 image providers, rembg sidecar, design intent |
| User Profile | 7 routes | 2 pages | 0 specs | GDPR delete 30d, export ZIP 1/day, avatar 256x256 |
| Subscription & Plans | 4 routes | 2 pages | 0 specs | 3 tiers (anon/free/premium), usage tracking |
| Wishlist | 5 routes | 2 pages | 1 spec | Share link, guest sync on login |
| Newsletter | 5 routes | 0 pages | 0 specs | Double opt-in, CAN-SPAM, drip sequence |
| Notifications | 5 routes | 1 page | 0 specs | Unread badge, mark all read |
| Analytics | 3 routes | 0 pages | 0 specs | A/B testing, event tracking |
| RAG | 6 routes | 0 pages | 0 specs | pgvector 768-dim, Gemini embeddings |
| Cron/Sync | 10 routes | 0 pages | 1 spec | 7-step sync, margin auditor, abandoned cart |
| SEO & i18n | 4 routes | 0 pages | 2 specs | hreflang, JSON-LD, locale currency (en-IE/es-ES/de-DE) |
| Admin (frontend) | 5 routes | 0 pages | 5 specs | RBAC, admin session separated |
| Legal Pages | 1 route | 9 pages | 0 specs | GDPR consent 3 categories, GPSR manufacturer |
| Storefront Config | 4 routes | 0 pages | 0 specs | Theme injection zero FOUC |
| Webhooks | 5 routes | 0 pages | 3 specs | Stripe signature, idempotency |
| Responsive/PWA | — | — | 4 specs | BottomNav 56px, Serwist SW, CMD+K, skip nav |
| Security | — | — | — | CSRF, CORS, XSS DOMPurify, anomaly detection |
| **TOTAL** | **~113 routes** | **~39 pages** | **~45 specs** | |

**Criterio de aprobacion**: TODAS las fases deben pasar sin errores criticos. Warnings son aceptables si se documentan. Ningun 500 en produccion.

---

## Metricas Criticas de Negocio

| Metrica | Valor esperado |
|---------|---------------|
| Margen minimo | >= 40% en todos los productos |
| Precios | Terminan en .99, todos en EUR |
| GPSR | 100% productos activos con safety_information |
| Rate limits | Login 5/15min, Register 3/60min, Export 1/day |
| CSRF | Token 64 chars, 8h TTL, double-submit cookie |
| Session | Access 1h, Refresh 7d, cross-tab sync |
| AI anomaly | Auto-block tras 5+ hits en 5min |
| Account deletion | 30 dias gracia, NO auto-cancel on login |
| Abandoned cart | 1h primer email, 24h segundo email |
| Order retry | Max 3 intentos, despues auto-refund |
