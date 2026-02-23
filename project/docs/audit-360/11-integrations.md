# 11 — Integraciones Externas: Auditoria Completa

> Fecha: 2026-02-23 | Auditor: Claude Opus 4.6 | Rama: master

---

## 1. Estado Actual — Mapa de Integraciones

```
                         ┌────────────────────────────────┐
                         │         Supabase Cloud          │
                         │  PostgreSQL + pgvector + RLS    │
                         └───────┬──────────┬──────────────┘
                                 │          │
              ┌──────────────────▼──┐   ┌──▼──────────────┐
              │     Frontend         │   │     PodClaw      │
              │   (Next.js 16)       │   │  (9 agents)      │
              └─┬──┬──┬──┬──┬──┬───┘   └─┬──┬──┬──┬──┬───┘
                │  │  │  │  │  │         │  │  │  │  │
   ┌────────────▼┐ │  │  │  │  │    ┌────▼┐ │  │  │  │
   │   Stripe    │ │  │  │  │  │    │fal.ai│ │  │  │  │
   │  (pagos)    │ │  │  │  │  │    │FLUX.1│ │  │  │  │
   └─────────────┘ │  │  │  │  │    └──────┘ │  │  │  │
      ┌────────────▼┐ │  │  │  │    ┌────────▼┐ │  │  │
      │  Printify   │ │  │  │  │    │  Gemini  │ │  │  │
      │  (POD)      │ │  │  │  │    │(embeddings)│ │  │
      └─────────────┘ │  │  │  │    └──────────┘ │  │  │
         ┌────────────▼┐ │  │  │       ┌─────────▼┐ │  │
         │   Resend    │ │  │  │       │   Redis   │ │  │
         │  (email)    │ │  │  │       │  (cache)  │ │  │
         └─────────────┘ │  │  │       └───────────┘ │  │
            ┌────────────▼┐ │  │          ┌──────────▼┐ │
            │   Gemini    │ │  │          │  Crawl4AI  │ │
            │ (chat SDK)  │ │  │          │  (scraper) │ │
            └─────────────┘ │  │          └────────────┘ │
               ┌────────────▼┐ │             ┌──────────▼┐
               │  Turnstile  │ │             │  Telegram  │
               │  (CAPTCHA)  │ │             │  WhatsApp  │
               └─────────────┘ │             └────────────┘
                  ┌────────────▼┐
                  │    rembg     │
                  │  (local, BG) │
                  └──────────────┘
```

### Resumen de Madurez

| Integracion | Madurez | Frontend | PodClaw | Tests |
|-------------|---------|----------|---------|-------|
| Stripe | Produccion | Checkout, webhooks, tax | Charges, refunds, balance | Playwright |
| Printify | Produccion | Webhooks, sync, orders | Product creation, pricing | Playwright |
| fal.ai | Produccion | Provider router | FLUX.1 generate, BG remove | Unit tests |
| Gemini | Produccion | AI SDK chat | Embeddings, quality check | Unit tests |
| Resend | Produccion | Transactional + drip | Newsletter, marketing | Parcial |
| Redis | Produccion | Cache + rate limit | (via bridge) | Health check |
| Jina | Stub | Reranker en RAG search | (no usado directamente) | Ninguno |
| Telegram | Parcial | -- | Bot send/broadcast | Unit tests |
| WhatsApp | Stub | -- | Send message | Ninguno |
| Crawl4AI | Produccion | -- | Web scraping + screenshots | Unit tests |
| rembg | Produccion | Provider router | BG removal via HTTP | Health check |

---

## 2. Stripe

### 2.1 Archivos Clave

| Archivo | Ruta |
|---------|------|
| Cliente singleton | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/stripe.ts` |
| Checkout | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/stripe-checkout.ts` |
| Webhook handler | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/stripe/route.ts` |
| Tax calculation | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/checkout/calculate-tax/route.ts` |
| Create session | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/checkout/create-session/route.ts` |
| Credits purchase | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/credits/purchase/route.ts` |
| Billing portal | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/billing/portal/route.ts` |
| Payment methods | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/profile/payment-methods/route.ts` |
| Subscription | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/subscription/create/route.ts` |
| PodClaw connector | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/connectors/stripe_connector.py` |
| MCP checkout tool | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/tools/create-checkout.ts` |
| Tests | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/tests/integration/webhooks/stripe.spec.ts` |

### 2.2 Evaluacion

**Checkout Flow**:
- `create-session/route.ts` crea `checkout.session` con line items del carrito
- Metadata incluye `locale`, `cart_items`, `user_id`
- Redirect a pagina de exito post-pago
- Soporta checkout para suscripciones y credits

**Webhook Handler**:
- Verifica firma con `stripe.webhooks.constructEvent()`
- Eventos manejados: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- Crea orden en Supabase + envia a Printify
- Email de confirmacion via Resend

**Tax**:
- Stripe Tax API con `stripe.tax.calculations.create()`
- Tax code `txcd_20030000` (Apparel) para productos POD
- Shipping como line item taxable (`txcd_92010001`)
- Fallback con rates hardcoded por estado US si Stripe Tax no esta activado

**Refunds (PodClaw)**:
- `stripe_create_refund` tool en `StripeMCPConnector`
- Requiere aprobacion para refunds > $100
- `stripe_list_charges`, `stripe_get_balance`, `stripe_get_revenue_report`

**API Version**: `2026-01-28.clover` (reciente y fijada)

### 2.3 Gaps

1. **Sin idempotency keys** en creacion de checkout sessions
2. **Fallback de tax** usa rates hardcoded — deberia ser configurable o deshabilitarse en produccion
3. **Sin `invoice.payment_failed`** handler — suscripciones podrian quedar activas sin pago
4. **Sin `charge.dispute.created`** handler — disputas no se procesan automaticamente
5. **Sin Stripe Customer sync** — no se crea `stripe_customer_id` en tabla `users` al registrarse

---

## 3. Printify

### 3.1 Archivos Clave

| Archivo | Ruta |
|---------|------|
| Cliente API | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/printify.ts` |
| Sync service | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/printify-sync.ts` |
| Webhook handler | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/printify/route.ts` |
| Create product | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/designs/[id]/create-product/route.ts` |
| Cron retry | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/cron/retry-printify-orders/route.ts` |
| PodClaw connector | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/connectors/printify_connector.py` |
| Pricing module | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/pricing.py` |
| Tests | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/tests/integration/webhooks/printify.spec.ts` |

### 3.2 Evaluacion

**Product Creation Flow** (PodClaw designer -> frontend):
1. PodClaw designer genera imagen con fal.ai
2. Upload imagen a Printify via `printify_upload_image`
3. Crea producto en Printify con blueprint, variants, print areas
4. Publica producto en la tienda
5. Frontend recibe webhook `product:publish:succeeded`
6. `syncProductFromPrintify()` sincroniza a Supabase

**Order Fulfillment Flow** (checkout -> Printify -> envio):
1. Stripe webhook `checkout.session.completed`
2. Frontend crea orden en Supabase
3. Frontend envia orden a Printify API
4. Printify fabrica y envia
5. Webhook `order:shipped` actualiza estado + envia email + crea notificacion
6. Webhook `order:delivered` marca como entregado

**Webhook Events Manejados**:
- `order:created` — confirmacion
- `order:shipped` — actualiza tracking, email, notificacion, audit log
- `order:delivered` — marca delivered, audit log
- `order:cancelled` — marca cancelled, audit log
- `product:publish:started` — confirma publicacion a Printify
- `product:publish:succeeded` / `product:created` / `product:updated` — sync completo
- `product:deleted` — cascade delete en Supabase

**Verificacion de firma**: HMAC-SHA256 con `X-Printify-Hmac-SHA256` header.

**Cron de retry**: `/api/cron/retry-printify-orders` para ordenes fallidas.

### 3.3 Gaps

1. **Sin manejo de `order:failed`** — si Printify no puede cumplir, no hay handler
2. **Sin stock tracking** — no se verifica stock antes de checkout
3. **Sin sync bidireccional de precios** — precios se gestionan manualmente
4. **Rate limiting de Printify API** no esta implementado (API tiene limite de 100 req/min)
5. **`publishingSucceeded` timing** — puede haber race condition si producto no existe aun en Supabase

---

## 4. fal.ai

### 4.1 Archivos Clave

| Archivo | Ruta |
|---------|------|
| PodClaw connector | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/connectors/fal_connector.py` |
| Frontend provider | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/providers/fal-provider.ts` |
| Provider router | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/providers/router.ts` |
| BG removal | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/providers/background-removal.ts` |
| Tests | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/tests/connectors/test_fal_connector.py` |

### 4.2 Evaluacion

**Modelos soportados**:
- FLUX.1 schnell (rapido, barato ~$0.003)
- FLUX.1 dev (calidad media)
- FLUX.1 Pro v1.1 (default, alta calidad ~$0.05)
- FLUX.1 Pro v2 (ultima version)

**Flow de generacion** (PodClaw designer):
1. Agente designer construye prompt con contexto de marca
2. `fal_generate` envia prompt a fal.ai queue API
3. Resultado: URL de imagen temporal
4. Quality check via Gemini (`gemini_check_image`)
5. BG removal via rembg local (gratis)
6. Upscale opcional via fal.ai (`fal_upscale`, ~$0.003)
7. Upload a Printify + Supabase storage

**Flow frontend** (personalizer):
- `fal-provider.ts` para generacion directa desde frontend
- Provider router abstrae el backend de generacion
- Background removal via provider abstraction

**Cost tracking**:
- Rate limits en `podclaw/config.py`: `fal_generate: 8`, `fal_remove_bg: 30`, `fal_upscale: 15`
- Costos trackeados por la transparency_hook de PodClaw
- Budget diario del designer: $3.00 EUR

### 4.3 Gaps

1. **Sin cola de espera** — generaciones son sincronas (queue API espera resultado)
2. **Sin retry automatico** — si fal.ai falla, la generacion se pierde
3. **Sin cache de imagenes** — mismos prompts regeneran imagenes nuevas
4. **URLs temporales** — fal.ai devuelve URLs con expiracion, requieren download inmediato
5. **Sin watermark** en previews (toda imagen generada es final)

---

## 5. Google Gemini

### 5.1 Archivos Clave

| Archivo | Ruta |
|---------|------|
| Embedding service | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/services/embedding_service.py` |
| PodClaw connector | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/connectors/gemini_connector.py` |
| RAG search | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/rag/search/route.ts` |
| RAG seed products | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/rag/seed-products/route.ts` |
| RAG seed FAQs | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/rag/seed-faqs-policies/route.ts` |
| RAG add documents | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/rag/add-documents/route.ts` |
| Chat route (AI SDK) | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/chat/route.ts` |
| Tests | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/tests/connectors/test_gemini_connector.py` |

### 5.2 Evaluacion

**Embeddings**:
- Modelo: `text-embedding-004` (768-dim, free tier de Google)
- Provider-agnostico: `BaseEmbeddingProvider` -> `GeminiEmbeddingProvider`
- Cache en SQLite keyed por SHA256(content)
- Formato: float32 BLOB (3 KB per 768-dim vs 6 KB JSON)
- Almacenamiento en pgvector (Supabase)

**RAG Pipeline**:
1. Query del usuario
2. Embed query con Gemini
3. Busqueda vectorial en pgvector (cosine similarity)
4. (Opcional) Rerank con Jina
5. Contexto inyectado en prompt del chat

**Chat (Frontend)**:
- AI SDK 6 con Google Generative AI provider
- `GOOGLE_GENERATIVE_AI_API_KEY` en frontend
- Streaming responses

**Quality Check (PodClaw)**:
- `gemini_check_image` tool en designer agent
- Verifica calidad visual de imagenes generadas

### 5.3 Gaps

1. **Sin batch embedding** — productos se embeden uno por uno (lento para catalogo grande)
2. **Sin semantic cache en frontend** — cada query RAG re-embede
3. **Cache SQLite solo en PodClaw** — frontend no cachea embeddings
4. **Sin fallback** si Gemini esta caido — chat y RAG dejan de funcionar
5. **Dos API keys separadas** — `GEMINI_API_KEY` (PodClaw) y `GOOGLE_GENERATIVE_AI_API_KEY` (frontend)

---

## 6. Resend (Email)

### 6.1 Archivos Clave

| Archivo | Ruta |
|---------|------|
| Cliente + templates | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/resend.ts` |
| Drip sequences | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/email-drip.ts` |
| Unsubscribe | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/newsletter/unsubscribe/route.ts` |
| Cron drip | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/cron/drip/route.ts` |
| PodClaw connector | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/connectors/resend_connector.py` |

### 6.2 Tipos de Email

| Tipo | Trigger | Locale-aware | Template |
|------|---------|-------------|----------|
| Order confirmation | Stripe webhook | Si (en/es/de) | HTML inline |
| Order shipped | Printify webhook | Si (en/es/de) | HTML inline |
| Welcome drip (1h) | Registro | No | `welcome` |
| Tips drip (3d) | Post-registro | No | `tips` |
| Upgrade drip (7d) | Post-registro | No | `credit_offer` |
| Newsletter | PodClaw agent | N/A | Generado por AI |
| Marketing | PodClaw agent | N/A | Generado por AI |

### 6.3 Evaluacion

**Fortalezas**:
- Lazy singleton (no falla si key no esta)
- Emails transaccionales locale-aware (3 idiomas)
- Drip sequence con tabla `drip_queue` y cron
- Unsubscribe RFC 8058 (one-click token)
- CAN-SPAM compliance: honor inmediato, audit log
- Rate limiting en endpoint unsubscribe
- Palette de colores centralizada (`EMAIL_COLORS`)

**Debilidades**:
- Templates en HTML inline (no React Email ni MJML)
- Drip sequences no son locale-aware (solo en ingles)
- PodClaw newsletter agent genera emails via AI, pero sin preview/approval workflow
- Sin email de password reset (manejado por Supabase Auth)

### 6.3 Gaps

1. **Drip emails solo en ingles** — falta i18n en `DRIP_SEQUENCES`
2. **Sin bounce handling** — Resend webhooks para bounces no procesados
3. **Sin email verification** — no se verifica dominio del remitente (SPF/DKIM via Resend dashboard)
4. **Templates no son componentes** — HTML inline es fragil y dificil de mantener

---

## 7. Redis

### 7.1 Archivos Clave

| Archivo | Ruta |
|---------|------|
| Cliente frontend | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/redis.ts` |
| Cliente MCP | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/lib/redis.ts` |
| Rate limiter | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/middleware/rate-limit.ts` |
| Translation cache | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/translation-cache.ts` |
| Usage limiter | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/usage-limiter.ts` |
| SSE emitter (admin) | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/admin/src/lib/sse-emitter.ts` |
| OAuth sessions | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/auth/session.ts` |

### 7.2 Evaluacion

**Uso en frontend**:
- Cache de productos (`product-detail-cache.ts`)
- Cache de traducciones
- Rate limiting por IP
- Usage tracking por usuario
- Health check status

**Uso en MCP server**:
- OAuth session storage
- Rate limiting por endpoint
- General caching

**Uso en admin**:
- SSE (Server-Sent Events) emitter para real-time updates

**Fallback graceful**:
- `getRedisClient()` retorna `null` si REDIS_URL no esta configurado
- Todas las operaciones (`getCached`, `setCached`, `deleteCached`) fallan silenciosamente
- `isRedisAvailable()` flag global
- App funciona sin Redis (sin cache, rate limiting fallback a in-memory)

### 7.3 Gaps

1. **Sin semantic cache** — RAG queries no se cachean en Redis (cada query va a pgvector)
2. **`clearPattern` usa `KEYS`** — `KEYS *` bloquea Redis en produccion; deberia usar `SCAN`
3. **Sin connection pooling** — una sola conexion ioredis por proceso
4. **Sin pub/sub** — SSE del admin podria beneficiarse de Redis pub/sub entre instancias
5. **TTL hardcoded** — `3600` (1h) default, no configurable por tipo de cache

---

## 8. Jina

### 8.1 Estado

**Uso**: Reranker opcional en pipeline RAG (`/api/rag/search/route.ts`)

**Implementacion**: Se busca en el RAG search route como paso de reranking post-vectorial.

### 8.2 Evaluacion

- **No hay API key** configurada en `.env.example`
- **No hay connector dedicado** en PodClaw
- **Opcional**: Si Jina no esta disponible, el pipeline RAG funciona sin rerank
- **Web search**: Mencionado en SKILL.md del researcher, pero implementacion real usa Crawl4AI

### 8.3 Gaps

1. **Sin API key management** — Jina key no aparece en `.env.example`
2. **Integracion minima** — podria eliminarse o formalizarse

---

## 9. Telegram / WhatsApp

### 9.1 Telegram

**Archivos**:
- Tools en `podclaw/config.py`: `telegram_send`, `telegram_send_photo`, `telegram_broadcast`
- Rate limits: 50 sends, 20 photos, 50 broadcast por ciclo

**Estado**: PARCIAL
- Bot token configurable via `TELEGRAM_BOT_TOKEN`
- Chat ID via `PODCLAW_ADMIN_TELEGRAM_CHAT_ID`
- Usado por marketing agent para broadcasts
- Notificaciones admin (alertas)

### 9.2 WhatsApp

**Archivos**:
- Tools en `podclaw/config.py`: `whatsapp_send`
- Rate limits: 50 sends por ciclo

**Estado**: STUB
- Token configurable via `WHATSAPP_ACCESS_TOKEN`
- Phone number ID via `WHATSAPP_PHONE_NUMBER_ID`
- Variables opcionales (default vacio)
- Implementacion basica — sin templates, sin session management

### 9.3 Gaps

1. **Telegram sin webhook** — solo push, no recibe mensajes de usuarios
2. **WhatsApp sin templates aprobados** — Meta requiere templates pre-aprobados
3. **Sin opt-in management** — no se verifica consentimiento para mensajes
4. **Sin delivery tracking** — no se sabe si mensajes fueron entregados

---

## 10. Integration Health

### 10.1 Error Handling

| Integracion | Try/catch | Logging | Graceful degradation |
|-------------|-----------|---------|---------------------|
| Stripe | Si | Si | Parcial (webhook retorna 200 siempre) |
| Printify | Si | Si | Si (retorna 200 para evitar retries) |
| fal.ai | Si | Si | No (fallo = no imagen) |
| Gemini | Si | Si | No (fallo = no embeddings) |
| Resend | Si | Si | Si (warn, app continua) |
| Redis | Si | Si | Si (fallback completo) |
| Crawl4AI | Si | Si | Si (retry con backoff) |

### 10.2 Retries y Circuit Breakers

**Con retry/backoff**:
- PodClaw `core.py` — retry con exponential backoff para llamadas a Claude SDK
- `crawl4ai_connector.py` — retry con backoff
- `delegate_connector.py` — retry para delegacion entre agentes
- `heartbeat.py` — retry para ciclos de heartbeat
- `sync_hook.py` — retry para sincronizacion
- `llm_helper.py` — retry para llamadas LLM

**Sin retry**:
- Stripe checkout creation
- Printify order submission
- fal.ai generation
- Resend email sending
- Gemini embeddings

**Circuit breaker**: NO implementado en ningun servicio. Solo PodClaw tiene patron similar con `cost_guard_hook` que detiene agentes si exceden budget.

### 10.3 Health Checks

| Servicio | Endpoint | Verificaciones |
|----------|----------|---------------|
| Frontend | `/api/health` | Supabase, Redis, Stripe status |
| Admin | `/panel/api/health` | Supabase connection |
| PodClaw | `/health` | Bridge API running |
| MCP Server | `/health` | Redis, Supabase |
| rembg | `/health` | Model loaded |
| Crawl4AI | `/monitor/health` | Service status |

---

## 11. Gaps Detectados

### Criticos

1. **Sin circuit breaker** en ninguna integracion — un servicio externo caido puede cascadear
2. **Sin idempotency keys** en Stripe — checkout duplicado = cobro duplicado
3. **Sin `invoice.payment_failed`** handler — suscripciones sin pago activas
4. **Sin retry para Printify orders** en real-time (solo cron cada X minutos)

### Importantes

5. **Sin webhook retry queue** — si webhook processing falla internamente, se pierde el evento
6. **Sin Stripe Customer sync** — no se mapea `stripe_customer_id` en registro
7. **KEYS command en Redis** — bloquea produccion con muchas keys
8. **Sin semantic cache** — RAG repite embeddings para queries similares
9. **Sin batch embedding** — catalogo nuevo tarda mucho en indexarse
10. **Jina sin formalizar** — ni integrado completamente ni eliminado

### Menores

11. **Drip emails solo en ingles**
12. **HTML templates inline** — fragiles
13. **WhatsApp es stub** — no funcional en produccion
14. **Sin delivery tracking** de Telegram/WhatsApp
15. **fal.ai sin cache de prompts** — regeneraciones innecesarias

---

## 12. Quick Wins

1. **Agregar idempotency key** en `checkout/create-session/route.ts`: `idempotencyKey: cartHash`
2. **Reemplazar `KEYS`** por `SCAN` en `clearPattern()` de `frontend/src/lib/redis.ts`
3. **Agregar `invoice.payment_failed`** handler en webhook Stripe
4. **Agregar `charge.dispute.created`** handler en webhook Stripe
5. **Localizar drip sequences** — agregar subjects/templates en es/de
6. **Formalizar o eliminar Jina** — agregar `JINA_API_KEY` a `.env.example` o remover
7. **Semantic cache en RAG** — hash de query embedding -> resultado cacheado en Redis (TTL 5min)

---

## 13. Roadmap por Fases

### Fase 1: Resiliencia Basica (1-2 dias)

- [ ] Idempotency keys en Stripe checkout
- [ ] `invoice.payment_failed` + `charge.dispute.created` webhooks
- [ ] Reemplazar `KEYS` por `SCAN` en Redis
- [ ] Retry con backoff para Printify order submission
- [ ] Retry con backoff para Resend email sending

### Fase 2: Observabilidad de Integraciones (1 semana)

- [ ] Dashboard de estado de integraciones (health check aggregado)
- [ ] Metricas por integracion: latencia, errores, llamadas/minuto
- [ ] Alertas cuando una integracion tiene >5% error rate
- [ ] Webhook event log (tabla `webhook_events` con status/retry count)
- [ ] Dead letter queue para webhooks fallidos

### Fase 3: Circuit Breaker Pattern (1-2 semanas)

- [ ] Implementar circuit breaker generico (half-open/open/closed)
- [ ] Aplicar a: Stripe, Printify, fal.ai, Gemini, Resend
- [ ] Fallback graceful: Stripe caido -> cola offline; fal.ai caido -> mensaje al usuario
- [ ] Dashboard de estado de circuits

### Fase 4: Email & Messaging Maturity (2-3 semanas)

- [ ] Migrar templates de HTML inline a React Email o MJML
- [ ] Localizar drip sequences completas (en/es/de)
- [ ] Resend bounce/complaint webhooks
- [ ] Telegram: recibir mensajes (webhook mode)
- [ ] WhatsApp: templates aprobados por Meta, session management
- [ ] Opt-in management para todos los canales

### Fase 5: Integracion Avanzada (1 mes)

- [ ] Stripe Connect para multi-tenant (comisiones automaticas)
- [ ] Printify Shop abstraction para multi-tenant
- [ ] Semantic cache completo en RAG pipeline
- [ ] Batch embedding pipeline para catalogo
- [ ] Jina reranker formal o eliminacion
- [ ] fal.ai prompt cache (hash -> imagen URL)

---

## Archivos Clave Auditados

| Area | Archivo | Ruta absoluta |
|------|---------|---------------|
| Stripe | Cliente | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/stripe.ts` |
| Stripe | Webhook | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/stripe/route.ts` |
| Stripe | PodClaw | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/connectors/stripe_connector.py` |
| Printify | Cliente | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/printify.ts` |
| Printify | Webhook | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/printify/route.ts` |
| Printify | Sync | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/printify-sync.ts` |
| fal.ai | PodClaw | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/connectors/fal_connector.py` |
| fal.ai | Frontend | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/providers/fal-provider.ts` |
| Gemini | Embeddings | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/services/embedding_service.py` |
| Gemini | PodClaw | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/connectors/gemini_connector.py` |
| Resend | Cliente | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/resend.ts` |
| Resend | Drip | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/email-drip.ts` |
| Redis | Frontend | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/redis.ts` |
| Redis | MCP | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/lib/redis.ts` |
| Newsletter | Unsubscribe | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/newsletter/unsubscribe/route.ts` |
| Tests | Stripe | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/tests/integration/webhooks/stripe.spec.ts` |
| Tests | Printify | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/tests/integration/webhooks/printify.spec.ts` |
