# Plan 10 — Growth, Engagement, Funnels & Social Proof

**Prioridad**: P2
**Estimacion**: 30-40h
**Dependencias**: Plan 04 (Frontend Ecommerce — SSR homepage, paginas faltantes), Plan 05 (Categorias — landing pages por categoria)
**Bloquea**: Plan 11 (Multi-Tenant — necesita analytics y funnels por tenant)

---

## 1. Objetivo

Transformar la tienda de un storefront funcional a una maquina de conversion: social proof en homepage, reviews con fotos, cross-sell inteligente, recuperacion de carritos abandonados, email marketing localizado con double opt-in (obligatorio para DE), sistema de blog/contenido SEO, integracion social real, y tracking de funnels completo. Cada mejora debe ser medible con eventos de analytics.

## 2. Estado Actual (Validado)

| Area | Score | Evidencia |
|------|-------|-----------|
| Testimonials/Social Proof en homepage | 0/10 | Landing page solo tiene hero + how-it-works + carousel + CTA — sin reviews, sin trust signals, sin contadores |
| Newsletter capture en homepage | 0/10 | No existe formulario de email en landing ni footer |
| Reviews de producto | 4/10 | `ReviewForm.tsx` y `api/reviews/route.ts` existen — texto + rating, pero sin fotos, sin moderacion real, usa `mockUserId` hardcoded |
| "Customers also bought" | 0/10 | `relatedProducts` en product detail son por misma categoria — no por co-purchase analysis |
| Recently Viewed | 0/10 | No existe ningun tracking de productos vistos |
| Quick View | 8/10 | `QuickViewModal.tsx` completo — galeria, tallas, add to cart, wishlist |
| Guest Checkout | 7/10 | `CheckoutView.tsx` tiene `guestEmail` + `guestCheckoutDescription` i18n — funcional |
| Save for Later | 0/10 | No existe — wishlists cubren parcialmente pero no es "save from cart" |
| Abandoned Cart Recovery | 0/10 | No hay tracking de carritos abandonados ni emails de recovery |
| Email Drip Sequence | 5/10 | `email-drip.ts` con 3 steps (welcome, tips, credit_offer), templates hardcoded en ingles |
| Double Opt-in Newsletter | 0/10 | **NON-COMPLIANT** — requerido por UWG (Alemania). Bloqueante pre-launch EU |
| Blog/Content | 0/10 | No existe sistema de blog — `(focused)/blog/page.tsx` listado en Plan 04 como placeholder |
| Social Media Links | 1/10 | Footer enlaza a URLs genericas (`facebook.com`, `twitter.com`) — no a cuentas reales |
| Share Buttons | 2/10 | Wishlists tienen sharing (`api/wishlist/share`), pero productos no tienen share buttons |
| Loyalty/Referral | 3/10 | `api/referral/route.ts` existe — 3 creditos por referido, pero sin UI, sin dashboard, sin programa formal |
| A/B Testing | 4/10 | Infraestructura `ab_experiments` + `ab_events` en DB, APIs existen pero retornan 404 en produccion |
| Analytics Events | 2/10 | `api/analytics/[type]` ejecuta scripts Python para admin (RFM, demand, pricing) — pero no hay tracking de funnel frontend |

### Infraestructura existente reutilizable:
- **DB**: `product_reviews`, `newsletter_subscribers`, `newsletter_campaigns`, `marketing_content`, `drip_queue`, `referrals`, `credit_transactions`, `ab_experiments`, `ab_events`
- **APIs**: `/api/reviews` (GET/POST), `/api/referral` (POST), `/api/newsletter/*` (10+ endpoints), `/api/ab-test/*` (3 endpoints), `/api/cron/drip`
- **Componentes**: `ReviewForm.tsx`, `QuickViewModal.tsx`, `WelcomePopup.tsx`, `InstallPrompt.tsx`, `PushPermissionPrompt.tsx`
- **Email**: Resend integrado, `List-Unsubscribe` headers, unsubscribe tokens, drip queue processor
- **i18n**: 988 claves x 3 locales — necesita extension para nuevas secciones

## 3. Gap Estructural

El storefront tiene la funcionalidad de compra pero carece de la capa de persuasion que diferencia una tienda exitosa de un prototipo. La homepage no tiene ningun elemento de social proof — ni un solo testimonio, badge de confianza o contador de clientes. El sistema de reviews existe pero es rudimentario: solo texto + rating, sin fotos, sin verificacion de compra real (usa `mockUserId`), sin moderacion. No hay ningun mecanismo de recuperacion de carritos abandonados, que tipicamente representa el 60-80% de intencion de compra perdida. El sistema de drip emails esta en ingles solamente, y lo mas critico: **no hay double opt-in para newsletter, lo cual es ilegal en Alemania (UWG Sec. 7) y acarrea multas de hasta 300K EUR**. El programa de referidos tiene backend pero cero UI. No hay tracking de funnel que permita medir donde se pierden los usuarios.

## 4. Decision Arquitectonica

### Social Proof: Componentes Server-Side para SEO + Client interactivity

**Justificacion**:
- Los testimonials, contadores y trust signals son contenido estatico/semi-estatico — deben ser SSR para que Google los indexe
- Depende de que Plan 04 complete el refactor de homepage a Server Component hibrido (Bloque A de Plan 04)
- Las reviews con fotos se renderizan client-side porque requieren interaccion (upload, lightbox)

### Double Opt-in: Implementar ANTES de cualquier envio marketing a EU

**Justificacion**:
- UWG Sec. 7 (Alemania) exige consentimiento explicito confirmado — no basta con un checkbox
- Flujo: formulario → insert con `confirmed=false` → email con token → click confirma → drip arranca
- Tabla `newsletter_subscribers` ya existe con campo `subscribed` — agregar `confirmed_at` y `confirmation_token`
- Este es el unico item **bloqueante legal** de todo el plan

### Abandoned Cart: Cron + Redis tracking (NO third-party service)

**Justificacion**:
- El stack ya tiene Redis desplegado — usar para tracking de estado de carrito
- Cron cada 30 min revisa carritos con items que no progresaron a checkout en X horas
- Requiere que el usuario tenga email (auth o guest con email)
- Maximo 2 emails de recovery: 1h despues + 24h despues

### Blog: Tabla + Admin CRUD + SSR pages (NO CMS externo)

**Justificacion**:
- El admin panel ya tiene infraestructura de edicion i18n (legal pages con tabs EN/ES/DE)
- Reutilizar patron de `legal/[slug]/page.tsx` para editor de blog posts
- SSR con `generateMetadata()` y JSON-LD `Article` para SEO
- Sin dependencias externas (no Contentful, no Sanity)

### Analytics: Custom events con tabla dedicada (NO Google Analytics)

**Justificacion**:
- GDPR requiere consentimiento para GA — muchos usuarios DE rechazan analytics
- Eventos propios en Supabase no requieren consentimiento (son datos first-party operacionales)
- Tabla `funnel_events` con: step, session_id, user_id, metadata, timestamp
- Dashboard en admin panel para visualizar conversion funnel

## 5. Plan de Implementacion

### Bloque A: Homepage Social Proof & Trust (6h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| A1 | Crear componente `TrustSignals` — badges de seguridad (SSL, pagos seguros, garantia), contador de "X productos creados", "Y clientes satisfechos" | Nuevo: `frontend/src/components/marketing/TrustSignals.tsx` | 1.5h | CONV-01 |
| A2 | Crear componente `TestimonialsCarousel` — 6-8 testimonios con avatar, nombre, rating, texto, enlace a producto comprado | Nuevo: `frontend/src/components/marketing/TestimonialsCarousel.tsx` | 2h | CONV-02 |
| A3 | Crear componente `NewsletterCapture` — email input + CTA, validacion, consentimiento GDPR, i18n 3 locales | Nuevo: `frontend/src/components/marketing/NewsletterCapture.tsx` | 1.5h | CONV-03 |
| A4 | Integrar A1, A2, A3 en homepage entre carousel y CTA (depende de Plan 04 Bloque A — homepage SSR) | `frontend/src/app/[locale]/(landing)/page.tsx` (o `LandingClient.tsx` post-refactor) | 30min | CONV-04 |
| A5 | Anadir `NewsletterCapture` en Footer | `frontend/src/components/Footer.tsx` | 30min | CONV-05 |

### Bloque B: Double Opt-in Newsletter (4h) — BLOQUEANTE LEGAL

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| B1 | Migracion: `ALTER TABLE newsletter_subscribers ADD confirmed_at timestamptz, ADD confirmation_token text` | Nueva migracion en `supabase/migrations/` | 30min | LEGAL-01 |
| B2 | Crear endpoint `POST /api/newsletter/subscribe` — inserta con `subscribed=false`, genera token, envia email de confirmacion localizado (en/es/de) | Nuevo: `frontend/src/app/api/newsletter/subscribe/route.ts` | 1.5h | LEGAL-02 |
| B3 | Crear endpoint `GET /api/newsletter/confirm?token=X` — valida token, marca `confirmed_at=now()`, `subscribed=true`, dispara drip sequence | Nuevo: `frontend/src/app/api/newsletter/confirm/route.ts` | 1h | LEGAL-03 |
| B4 | Crear pagina `/(focused)/newsletter/confirm/page.tsx` — UI de confirmacion exitosa/error con i18n | Nuevo: `frontend/src/app/[locale]/(focused)/newsletter/confirm/page.tsx` | 30min | LEGAL-04 |
| B5 | Actualizar `triggerDripSequence()` para solo ejecutar si `confirmed_at IS NOT NULL` | `frontend/src/lib/email-drip.ts` | 30min | LEGAL-05 |

### Bloque C: Reviews con Fotos & Moderacion (5h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| C1 | Migracion: `ALTER TABLE product_reviews ADD photos text[], ADD helpful_count int DEFAULT 0, ADD reported boolean DEFAULT false` | Nueva migracion | 30min | REVIEW-01 |
| C2 | Actualizar `ReviewForm.tsx` — reemplazar `mockUserId` con user real de sesion, anadir upload de hasta 3 fotos (Supabase Storage o presigned URLs) | `frontend/src/components/products/ReviewForm.tsx` | 2h | REVIEW-02 |
| C3 | Actualizar `api/reviews/route.ts` — usar `requireAuth()`, insertar con user real, guardar URLs de fotos, marcar `is_verified_purchase` si hay order del user para ese producto | `frontend/src/app/api/reviews/route.ts` | 1h | REVIEW-03 |
| C4 | Crear componente `ReviewCard` — foto del usuario, rating, texto, fotos adjuntas con lightbox, badge "Compra verificada", boton "Util" | Nuevo: `frontend/src/components/products/ReviewCard.tsx` | 1h | REVIEW-04 |
| C5 | Anadir seccion "Reviews destacados" en homepage (top 3 reviews con 5 estrellas de productos diferentes) | Nuevo: `frontend/src/components/marketing/FeaturedReviews.tsx` | 30min | REVIEW-05 |

### Bloque D: Product Engagement — Cross-sell & Recently Viewed (5h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| D1 | Crear hook `useRecentlyViewed()` — localStorage con ultimos 10 product IDs + timestamps, FIFO | Nuevo: `frontend/src/hooks/useRecentlyViewed.ts` | 1h | ENGAGE-01 |
| D2 | Crear componente `RecentlyViewed` — carrusel horizontal con ProductCard mini, aparece en sidebar o debajo de producto | Nuevo: `frontend/src/components/products/RecentlyViewed.tsx` | 1h | ENGAGE-02 |
| D3 | Integrar `RecentlyViewed` en product detail page (debajo de related products) y opcionalmente en `StorefrontSidebar.tsx` | `frontend/src/components/products/ProductDetailClient.tsx`, `StorefrontSidebar.tsx` | 30min | ENGAGE-03 |
| D4 | Crear endpoint `GET /api/products/also-bought?productId=X` — consulta ordenes que incluyen el producto X y retorna los otros productos comprados juntos (co-purchase frequency) | Nuevo: `frontend/src/app/api/products/also-bought/route.ts` | 1.5h | ENGAGE-04 |
| D5 | Crear componente `AlsoBought` — grid de 4 productos con badge "Clientes tambien compraron" | Nuevo: `frontend/src/components/products/AlsoBought.tsx` | 1h | ENGAGE-05 |

### Bloque E: Checkout Optimization — Save for Later & Cart Recovery (5h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| E1 | Crear funcion "Save for Later" en cart — mueve item de cart a wishlist con tag `saved_from_cart` | `frontend/src/components/cart/CartView.tsx`, `frontend/src/hooks/useCart.tsx` | 1h | CART-01 |
| E2 | Migracion: `CREATE TABLE abandoned_carts (id, user_id, email, cart_snapshot jsonb, abandoned_at timestamptz, recovery_email_1_sent boolean, recovery_email_2_sent boolean, recovered boolean, recovered_at timestamptz)` | Nueva migracion | 30min | CART-02 |
| E3 | Crear cron `api/cron/abandoned-cart/route.ts` — cada 30 min, detecta carts con items que llevan >1h sin checkout, inserta en `abandoned_carts`, envia primer email de recovery (localizado) | Nuevo: `frontend/src/app/api/cron/abandoned-cart/route.ts` | 2h | CART-03 |
| E4 | Segundo email de recovery (24h despues) con descuento opcional — mismo cron, busca `recovery_email_1_sent=true AND recovery_email_2_sent=false AND abandoned_at < now() - 24h` | Mismo archivo que E3 | 1h | CART-04 |
| E5 | Endpoint `GET /api/cart/recover?token=X` — restaura carrito desde snapshot y redirige a checkout | Nuevo: `frontend/src/app/api/cart/recover/route.ts` | 30min | CART-05 |

### Bloque F: Email Marketing Localizado (4h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| F1 | Localizar templates de drip sequence — crear versiones en/es/de para welcome, tips, credit_offer | `frontend/src/lib/email-drip.ts` + nuevo: `frontend/src/lib/email-templates/` (3 archivos por locale) | 2h | EMAIL-01 |
| F2 | Actualizar cron drip para seleccionar template segun locale del subscriber | `frontend/src/app/api/cron/drip/route.ts` | 30min | EMAIL-02 |
| F3 | Anadir `company_address` a footer de TODOS los email templates (CAN-SPAM compliance) | `frontend/src/lib/email-templates/` | 30min | EMAIL-03 |
| F4 | Crear secuencia de drip "post_purchase" — 3 steps: thank you (1h), review request (7d), cross-sell (14d) | `frontend/src/lib/email-drip.ts` | 1h | EMAIL-04 |

### Bloque G: Blog / Content Marketing (5h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| G1 | Migracion: `CREATE TABLE blog_posts (id, slug text UNIQUE, title_en text, title_es text, title_de text, body_en text, body_es text, body_de text, excerpt_en text, excerpt_es text, excerpt_de text, cover_image text, author text, tags text[], status text DEFAULT 'draft', published_at timestamptz, seo_title text, seo_description text, created_at timestamptz, updated_at timestamptz)` | Nueva migracion | 30min | BLOG-01 |
| G2 | Crear endpoint `GET /api/blog` (listado paginado por locale, filtro por tag) y `GET /api/blog/[slug]` (post individual) | Nuevo: `frontend/src/app/api/blog/route.ts`, `frontend/src/app/api/blog/[slug]/route.ts` | 1.5h | BLOG-02 |
| G3 | Crear pagina `/blog` — listado SSR con `generateMetadata()`, grid de cards con cover image, titulo, excerpt, fecha, tags | Nuevo: `frontend/src/app/[locale]/(focused)/blog/page.tsx` | 1h | BLOG-03 |
| G4 | Crear pagina `/blog/[slug]` — post SSR con `generateMetadata()`, JSON-LD `Article`, SafeMarkdown para body, share buttons, related posts | Nuevo: `frontend/src/app/[locale]/(focused)/blog/[slug]/page.tsx` | 1.5h | BLOG-04 |
| G5 | Crear pagina admin `admin/src/app/blog/page.tsx` — CRUD con editor Markdown, tabs de locale (reutilizar patron de `legal/[slug]`) | Nuevo: `admin/src/app/blog/page.tsx`, `admin/src/app/blog/[id]/page.tsx` | *Se estima en Plan 02 si no existe* | BLOG-05 |

**Nota sobre G5**: El editor del admin reutiliza la infraestructura existente de `legal/[slug]/page.tsx` (tabs EN/ES/DE, Markdown + preview, historial). Estimacion incluida aqui solo si Plan 02 no lo cubre: +2h.

### Bloque H: Social Media & Sharing (3h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| H1 | Actualizar social media links en Footer con URLs reales configurables via env vars (`NEXT_PUBLIC_SOCIAL_FACEBOOK`, etc.) | `frontend/src/components/Footer.tsx` | 30min | SOCIAL-01 |
| H2 | Crear componente `ShareButtons` — Web Share API (mobile) con fallback a links directos (Facebook, Twitter/X, Pinterest, WhatsApp, email) | Nuevo: `frontend/src/components/marketing/ShareButtons.tsx` | 1h | SOCIAL-02 |
| H3 | Integrar `ShareButtons` en product detail page, blog posts, y wishlists compartidas | `ProductDetailClient.tsx`, `blog/[slug]/page.tsx`, `wishlist/shared/[token]/page.tsx` | 30min | SOCIAL-03 |
| H4 | Crear componente `UGCGallery` — grid de imagenes de clientes con sus productos (curado desde reviews con fotos + Instagram embeds) | Nuevo: `frontend/src/components/marketing/UGCGallery.tsx` | 1h | SOCIAL-04 |

### Bloque I: Loyalty & Referral Program UI (3h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| I1 | Crear componente `ReferralCard` — muestra codigo de referido del usuario, creditos ganados, link para copiar/compartir | Nuevo: `frontend/src/components/marketing/ReferralCard.tsx` | 1h | LOYALTY-01 |
| I2 | Integrar `ReferralCard` en pagina de perfil (nueva seccion "Programa de Referidos") | `frontend/src/app/[locale]/(app)/profile/page.tsx` o componente delegado | 30min | LOYALTY-02 |
| I3 | Crear endpoint `GET /api/referral/stats` — total referidos, creditos ganados, historial de referidos | Nuevo: `frontend/src/app/api/referral/stats/route.ts` | 1h | LOYALTY-03 |
| I4 | Anadir banner "Invita amigos, gana creditos" en sidebar o post-checkout success | `StorefrontSidebar.tsx` o `checkout/success/page.tsx` | 30min | LOYALTY-04 |

### Bloque J: Funnel Analytics & Event Tracking (4h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| J1 | Migracion: `CREATE TABLE funnel_events (id, session_id text, user_id uuid, event_name text, event_category text, properties jsonb, page_url text, referrer text, created_at timestamptz)` con indices en `event_name`, `session_id`, `created_at` | Nueva migracion | 30min | ANALYTICS-01 |
| J2 | Crear lib `trackEvent()` — wrapper client-side que envia POST a `/api/analytics/events` con session ID (cookie), user ID (si auth), y propiedades | Nuevo: `frontend/src/lib/analytics.ts` | 1h | ANALYTICS-02 |
| J3 | Crear endpoint `POST /api/analytics/events` — inserta en `funnel_events`, rate limit 100/min por session | Nuevo: `frontend/src/app/api/analytics/events/route.ts` | 1h | ANALYTICS-03 |
| J4 | Instrumentar funnel completo: `page_view`, `product_view`, `add_to_cart`, `begin_checkout`, `purchase_complete`, `newsletter_subscribe`, `review_submit`, `share_click`, `referral_copy` | Multiples archivos (ProductDetailClient, CartView, CheckoutView, NewsletterCapture, ReviewForm, ShareButtons, ReferralCard) | 1h | ANALYTICS-04 |
| J5 | Crear dashboard basico en admin: funnel visualization (visits → product views → add to cart → checkout → purchase), conversion rates por step | Nuevo: `admin/src/app/analytics/funnel/page.tsx` o seccion en `admin/src/app/analytics/page.tsx` | 30min | ANALYTICS-05 |

## 6. Orden de Ejecucion

```
Bloque B (4h) ─────────────────────────────────────────────→ (LEGAL — double opt-in, PRIMERO)
       ↓
Bloque J (4h) ─────→ (analytics base — necesario para medir todo lo demas)
       ↓
Bloque A (6h) ──→ Bloque C (5h) ──→ Bloque H (3h)
                                          ↓
Bloque D (5h) ──→ Bloque E (5h) ──→ Bloque F (4h)
                                          ↓
Bloque G (5h) ──→ Bloque I (3h) ──→ Validacion
```

- **B primero obligatorio**: el double opt-in es bloqueante legal para mercado EU. Ningun email marketing se envia hasta que esto este implementado
- **J segundo**: los analytics deben estar listos antes de implementar features de conversion para poder medir impacto baseline vs post-implementacion
- **A depende de Plan 04 Bloque A**: los componentes de social proof se integran en la homepage refactorizada a SSR
- **C y D en paralelo**: reviews con fotos y cross-sell no tienen dependencias cruzadas
- **E depende de D parcialmente**: el "save for later" mueve items a wishlist, que ya existe
- **F depende de B**: la localizacion de email templates requiere que el flujo de double opt-in este resuelto
- **G independiente**: el blog se puede construir en cualquier momento, pero beneficia de J para tracking
- **H depende de C**: los share buttons aprovechan las fotos de reviews (UGC)
- **I independiente**: el referral ya tiene backend, solo necesita UI

## 7. Validaciones Tecnicas

| # | Validacion | Criterio de Exito |
|---|-----------|-------------------|
| V1 | Double opt-in funcional | `POST /api/newsletter/subscribe` con email → recibe email de confirmacion → click en link → `confirmed_at IS NOT NULL` en DB |
| V2 | Drip no arranca sin confirmacion | Insertar subscriber con `confirmed_at=NULL` → cron drip ignora al usuario (0 emails enviados) |
| V3 | Trust signals en homepage | `curl localhost:3000/en` contiene "ssl", "guarantee", "customers" (text de trust signals en SSR) |
| V4 | Testimonials renderizados SSR | `curl localhost:3000/en \| grep 'testimonial'` devuelve contenido (no vacio pre-hydration) |
| V5 | Newsletter capture funcional | Formulario en homepage y footer → submit → inserta en `newsletter_subscribers` con `subscribed=false` |
| V6 | Reviews con fotos | Subir review con 2 fotos → `product_reviews.photos` contiene 2 URLs validas → fotos visibles en lightbox |
| V7 | Reviews usa user real | Submit review sin auth → 401. Con auth → `user_id` correcto en DB (no `mockUserId`) |
| V8 | Recently Viewed persiste | Visitar 3 productos → `localStorage` contiene 3 IDs → carrusel muestra 3 productos en sidebar |
| V9 | Also Bought funcional | `GET /api/products/also-bought?productId=X` → retorna productos de ordenes que incluyen X |
| V10 | Save for Later | Click "Guardar para despues" en cart → item removido de cart, aparece en wishlist con tag |
| V11 | Abandoned cart email | Cart con items >1h sin checkout + email conocido → registro en `abandoned_carts` + email enviado |
| V12 | Cart recovery link | Click en link de email de recovery → carrito restaurado → redirect a checkout |
| V13 | Blog SSR | `curl localhost:3000/en/blog/[slug] \| grep 'article'` contiene JSON-LD Article |
| V14 | Share buttons | Product detail tiene botones de compartir → click abre Web Share API en mobile o link directo en desktop |
| V15 | Referral UI | Perfil muestra codigo de referido + boton copiar + estadisticas de creditos ganados |
| V16 | Funnel events | Navegar producto → add to cart → checkout → `funnel_events` contiene 3+ registros con mismo `session_id` |
| V17 | Funnel dashboard | Admin muestra grafico de embudo con % de conversion por paso |
| V18 | Email templates localizados | Subscriber con `locale=de` recibe email en aleman con `List-Unsubscribe` header |

## 8. Validaciones de Negocio

- Un visitante nuevo en la homepage ve testimonios reales, badges de confianza y un contador de productos creados — generando credibilidad antes de hacer scroll al catalogo
- Un usuario aleman que se suscribe al newsletter recibe email de confirmacion en aleman antes de recibir cualquier marketing — cumpliendo UWG Sec. 7
- Un comprador que deja items en el carrito recibe un email de recordatorio personalizado 1h despues, y un segundo con incentivo a las 24h — recuperando hasta 15-20% de carritos abandonados
- Las reviews de producto muestran fotos reales de clientes con badge "Compra verificada" — aumentando confianza y conversion
- Los productos muestran "Clientes tambien compraron" basado en datos reales de co-purchase — no solo "misma categoria"
- El blog genera trafico organico para long-tail keywords ("como disenar una camiseta personalizada", "mejores regalos personalizados")
- Cada paso del funnel (visit → product view → add to cart → checkout → purchase) es medible en el dashboard de admin — permitiendo optimizacion data-driven
- El programa de referidos tiene UI visible en perfil y post-compra — incentivando word-of-mouth con creditos de diseno

## 9. Metricas de Exito

| Metrica | Antes | Despues |
|---------|-------|---------|
| Elementos de social proof en homepage | 0 | 4+ (trust signals, testimonials, newsletter, featured reviews) |
| Newsletter subscribers con double opt-in | 0 (no compliant) | Flujo completo EU-legal |
| Reviews con fotos | 0 | Habilitado (upload hasta 3 fotos por review) |
| Reviews con user real (no mock) | 0% | 100% |
| Modelos de cross-sell | 1 (same category) | 2 (same category + co-purchase) |
| Recently Viewed tracking | No existe | localStorage + carrusel en sidebar |
| Abandoned cart recovery emails | 0 | 2 emails automaticos (1h + 24h) |
| Email drip templates localizados | 1 locale (EN) | 3 locales (en/es/de) |
| Blog posts (estructura) | No existe | Tabla + CRUD admin + SSR pages con JSON-LD |
| Social media links reales | 0 (genericas) | 4+ (configurables via env) |
| Share buttons en productos | 0 | Web Share API + fallbacks |
| Referral program UI | 0 (solo API backend) | Card en perfil + stats + post-checkout banner |
| Funnel events tracked | 0 | 9+ eventos (page_view → purchase_complete) |
| Funnel dashboard admin | No existe | Embudo visual con % conversion por step |
| A/B testing habilitado en prod | No (404 en prod) | Habilitado con feature flag |

## 10. Estimacion Total

| Bloque | Horas | Paralelizable |
|--------|-------|---------------|
| A — Homepage Social Proof & Trust | 6h | No (depende de Plan 04) |
| B — Double Opt-in Newsletter | 4h | Si (independiente, PRIMERO) |
| C — Reviews con Fotos & Moderacion | 5h | Si (con D) |
| D — Cross-sell & Recently Viewed | 5h | Si (con C) |
| E — Save for Later & Cart Recovery | 5h | No (depende de D parcial) |
| F — Email Marketing Localizado | 4h | No (depende de B) |
| G — Blog / Content Marketing | 5h | Si (independiente) |
| H — Social Media & Sharing | 3h | No (depende de C) |
| I — Loyalty & Referral Program UI | 3h | Si (independiente) |
| J — Funnel Analytics & Tracking | 4h | Si (independiente, SEGUNDO) |
| **Total** | **44h** | — |

**Rango realista con contingencia**: 35-44h (los bloques B, I y J son quick wins de alta certeza; C y E pueden requerir iteracion en upload de fotos y email templates)

**Esfuerzo con 2 agentes paralelos**: ~26h elapsed (B+J en paralelo fase 1, luego A+C+D+G en paralelo fase 2, luego E+F+H+I fase 3)

**Dependencias externas**:
- Plan 04 Bloque A completado (homepage SSR) → desbloquea Bloque A de este plan
- Plan 05 completado (categorias) → enriquece blog con links a categorias y cross-sell por vertical
- Supabase Storage configurado → necesario para upload de fotos en reviews (Bloque C)
- Variables de entorno `NEXT_PUBLIC_SOCIAL_*` configuradas → necesario para Bloque H

---

*Plan derivado de audit-360/02 (Frontend Ecommerce) y audit-360/09 (i18n, Legal, GDPR). Hallazgos CONV-01 a CONV-05, LEGAL-01 a LEGAL-05, REVIEW-01 a REVIEW-05, ENGAGE-01 a ENGAGE-05, CART-01 a CART-05, EMAIL-01 a EMAIL-04, BLOG-01 a BLOG-05, SOCIAL-01 a SOCIAL-04, LOYALTY-01 a LOYALTY-04, ANALYTICS-01 a ANALYTICS-05 confirmados contra codigo fuente real 2026-02-23.*
