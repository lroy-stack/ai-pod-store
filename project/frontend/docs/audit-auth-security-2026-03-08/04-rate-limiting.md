# Rate Limiting Analysis — 2026-03-08

## Resumen Ejecutivo

El sistema de rate limiting tiene **tres capas** complementarias:

1. **Burst limiter** (in-memory `Map`) — proteccion per-instance contra rafagas rapidas
2. **Usage limiter** (Supabase-backed) — limites diarios/mensuales persistentes por tier (anonymous/free/premium)
3. **Anomaly monitor** (in-memory `Map`) — deteccion de bots y auto-bloqueo temporal

La cobertura es **buena en rutas de auth y AI/design**, pero hay **gaps significativos** en rutas de cart, orders, admin, profile mutations, y otros endpoints sensibles que carecen de cualquier rate limiting.

**Archivo principal**: `src/lib/rate-limit.ts`
**Usage limiter**: `src/lib/usage-limiter.ts`
**Anomaly monitor**: `src/lib/anomaly-monitor.ts`

---

## 1. Rate Limiter Implementation

### 1.1 Arquitectura (in-memory Map)

```
src/lib/rate-limit.ts
```

Clase `RateLimiter` con sliding window simplificado:
- Almacena `Map<string, { count: number, resetAt: number }>` en memoria del proceso
- Cada key tiene un contador y un timestamp de reset
- Si el timestamp expira, el contador se reinicia a 1
- Cleanup probabilistico: 1% de las llamadas recorre el Map y elimina entradas expiradas

**Concurrency tracker adicional**: `acquireSlot(key, maxConcurrent)` / `releaseSlot(key)` — previene que un usuario tenga mas de N requests streaming simultaneos. Solo se usa en `/api/chat` (max 2 concurrent).

**Helper `getClientIP()`**: Extrae IP de `cf-connecting-ip` > `x-real-ip` > `x-forwarded-for` > `'unknown'`.

**Helper `verifyCronSecret()`**: Timing-safe comparison para tokens de cron (no es rate limiting per se, pero protege cron routes).

### 1.2 Pre-configured Limiters

| Limiter | Limit | Window | Exportado como |
|---|---|---|---|
| `authLimiter` | 5 req | 15 min | auth login |
| `registerLimiter` | 3 req | 60 min | auth register |
| `forgotPasswordLimiter` | 3 req | 60 min | forgot password |
| `chatLimiter` | 20 msg | 1 min | chat (con fingerprint) |
| `noFpChatLimiter` | 5 msg | 1 min | chat (sin fingerprint) |
| `couponLimiter` | 10 req | 5 min | coupon validation |
| `apiLimiter` | 100 req | 1 min | generic (NO SE USA en ningun endpoint) |
| `designGenerateLimiter` | 5 req | 1 min | design generation |
| `mockupGenerateLimiter` | 10 req | 1 min | mockup generation |
| `newsletterLimiter` | 10 req | 1 min | newsletter ops |
| `previewTextLimiter` | 20 req | 1 min | canvas rendering (NO SE USA) |
| `changePasswordLimiter` | 5 req | 15 min | password change |
| `designSaveLimiter` | 30 req | 1 min | design save |
| `personalizeLimiter` | 20 req | 1 min | personalization (NO SE USA) |
| `reviewLimiter` | 5 req | 60 min | product reviews |
| `avatarUploadLimiter` | 5 req | 15 min | avatar upload |
| `changeEmailLimiter` | 3 req | 60 min | email change |
| `subscriptionCreateLimiter` | 3 req | 60 min | Stripe checkout spam |
| `checkoutLimiter` | 5 req | 1 min | checkout session creation |

**NOTA**: `apiLimiter`, `previewTextLimiter`, y `personalizeLimiter` estan definidos pero **no se importan en ninguna ruta**. Son codigo muerto.

### 1.3 Test Bypass

```typescript
if (process.env.NODE_ENV === 'test' && (process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.CI)) {
  return { success: true, remaining: this.limit }
}
```

Bypass condicional: requiere AMBOS `NODE_ENV=test` Y (`PLAYWRIGHT_TEST_BASE_URL` o `CI`). Seguro — no se activa en produccion a menos que alguien configure `NODE_ENV=test` en prod.

El mismo bypass existe en `acquireSlot()`.

### 1.4 Limitaciones (per-instance)

- **In-memory Map** = cada instancia del servidor (o serverless function) tiene su propio Map
- En un deploy multi-instancia, un atacante puede distribuir requests entre instancias y evadir limites
- **Mitigacion parcial**: El usage limiter (Supabase-backed) actua como segunda capa persistente para chat y designs
- **Para self-hosted single-instance**: El burst limiter in-memory es suficiente, ya que todas las requests van al mismo proceso

---

## 2. Coverage Matrix

### 2.1 Endpoints CON Rate Limiting (Burst Limiter)

| API Route | Limiter | Key | Limit | Window |
|---|---|---|---|---|
| `POST /api/auth/login` | `authLimiter` | IP | 5 | 15 min |
| `POST /api/auth/register` | `registerLimiter` | IP | 3 | 60 min |
| `POST /api/auth/forgot-password` | `forgotPasswordLimiter` | IP | 3 | 60 min |
| `POST /api/chat` | `chatLimiter` / `noFpChatLimiter` | IP | 20 / 5 | 1 min |
| `POST /api/coupons/validate` | `couponLimiter` | IP | 10 | 5 min |
| `POST /api/reviews` | `reviewLimiter` | `review:{userId}` | 5 | 60 min |
| `POST /api/profile/change-password` | `changePasswordLimiter` | `password:{userId}` | 5 | 15 min |
| `POST /api/profile/change-email` | `changeEmailLimiter` | `email:{userId}` | 3 | 60 min |
| `POST /api/profile/avatar` | `avatarUploadLimiter` | `avatar:{userId}` | 5 | 15 min |
| `POST /api/subscription/create` | `subscriptionCreateLimiter` | `sub-create:{userId}` | 3 | 60 min |
| `POST /api/checkout/create-session` | `checkoutLimiter` | IP | 5 | 1 min |
| `POST /api/designs` (save) | `designSaveLimiter` | `design:save:{userId\|ip}` | 30 | 1 min |
| `POST /api/designs/generate` | `designGenerateLimiter` | `design:generate:{userId}` | 5 | 1 min |
| `POST /api/designs/ai-generate` | `designGenerateLimiter` | `design:ai-generate:{userId}` | 5 | 1 min |
| `POST /api/designs/ai-generate/refine` | `designGenerateLimiter` | `design:refine:{userId}` | 5 | 1 min |
| `POST /api/designs/mockup` | `mockupGenerateLimiter` | `mockup:{userId\|ip}` | 10 | 1 min |
| `POST /api/newsletter/campaigns` | `newsletterLimiter` | `newsletter:{IP}` | 10 | 1 min |
| `POST /api/newsletter/unsubscribe` | `newsletterLimiter` | `newsletter:{IP}` | 10 | 1 min |
| `GET /api/newsletter/unsubscribe` | `newsletterLimiter` | `newsletter:{IP}` | 10 | 1 min |

### 2.2 Endpoints protegidos con `verifyCronSecret` (no rate limit, pero autenticados por token)

| API Route | Proteccion |
|---|---|
| `GET /api/cron/sync-printify` | `verifyCronSecret` |
| `GET /api/cron/product-metrics` | `verifyCronSecret` |
| `GET /api/cron/hard-delete-accounts` | `verifyCronSecret` |
| `GET /api/cron/abandoned-cart-recovery` | `verifyCronSecret` |
| `GET /api/cron/check-delivery-status` | `verifyCronSecret` |
| `GET /api/cron/cleanup` | `verifyCronSecret` |
| `GET /api/cron/cleanup-temp-products` | `verifyCronSecret` |
| `GET /api/cron/cleanup-personal` | `verifyCronSecret` |
| `GET /api/cron/zombie-reaper` | `verifyCronSecret` |
| `GET /api/cron/retry-printify-orders` | `verifyCronSecret` |
| `GET /api/cron/drip` | `verifyCronSecret` |
| `POST /api/revalidate/theme` | `verifyCronSecret` |
| `POST /api/designs/[id]/create-product` | `verifyCronSecret` |

### 2.3 Endpoints con Usage Limiter (Supabase-backed, ademas del burst limiter)

| API Route | Usage Action | Anonymous | Free | Premium |
|---|---|---|---|---|
| `POST /api/chat` | `chat` (conversations) | 5/dia | 30/dia | 100/dia |
| `POST /api/chat` | `chat:messages` | 20/dia | 200/dia | unlimited |
| `POST /api/chat` | `chat:tokens` (pre-check) | 50K/dia | 500K/dia | 2M/dia |
| `POST /api/designs/generate` | `design:generate` | 0/mes | 5/mes | 50/mes |
| `POST /api/designs/ai-generate` | `design:ai-generate` | 0/mes | 5/mes | 50/mes |
| `POST /api/designs/ai-generate/refine` | `design:refine` | 0/mes | 10/mes | 100/mes |
| `POST /api/designs/mockup` | `design:mockup` | 3/dia | 10/mes | 100/mes |

---

## 3. Endpoints SIN Rate Limiting (GAPS)

| API Route | Metodo | Riesgo | Por que necesita RL |
|---|---|---|---|
| `POST /api/auth/reset-password` | POST | **ALTO** | Password reset sin rate limit permite brute force del access token |
| `POST /api/auth/verify-email` | POST | **MEDIO** | Verificacion de email sin rate limit — menor riesgo porque requiere access token valido |
| `POST /api/auth/logout` | POST | **BAJO** | Logout no es sensible, pero sin RL permite DoS de sesiones |
| `POST /api/cart` | POST | **MEDIO** | Cart add sin RL permite llenar DB de items basura (anonymous carts) |
| `PATCH /api/cart` | PATCH | **MEDIO** | Cart update sin RL |
| `DELETE /api/cart` | DELETE | **BAJO** | Cart delete |
| `POST /api/cart/merge` | POST | **BAJO** | Cart merge |
| `POST /api/cart/shipping-estimate` | POST | **MEDIO** | Puede hacer llamadas a servicios externos de shipping |
| `POST /api/checkout/calculate-tax` | POST | **MEDIO** | Tax calculation puede ser costoso computacionalmente |
| `POST /api/orders/[id]/returns` | POST | **MEDIO** | Return requests sin RL permite spam |
| `POST /api/orders/[id]/reorder` | POST | **MEDIO** | Reorder sin RL |
| `POST /api/returns/[id]/tracking` | POST | **BAJO** | Tracking update |
| `POST /api/profile/delete` | POST | **ALTO** | Account deletion sin RL — requiere auth pero no burst protection |
| `POST /api/profile/cancel-deletion` | POST | **BAJO** | Cancel deletion |
| `PATCH /api/user/profile` | PATCH | **MEDIO** | Profile update sin RL |
| `POST /api/wishlist` | POST | **BAJO** | Wishlist create |
| `POST /api/wishlist/items` | POST | **BAJO** | Wishlist item add |
| `POST /api/wishlist/share` | POST | **BAJO** | Wishlist share |
| `POST /api/wishlist/sync` | POST | **BAJO** | Wishlist sync |
| `POST /api/newsletter/subscribe` | POST | **ALTO** | Newsletter subscribe sin RL permite spam masivo de emails de confirmacion |
| `POST /api/referral` | POST | **MEDIO** | Referral creation sin RL |
| `POST /api/credits/purchase` | POST | **ALTO** | Credit purchase (Stripe) sin RL permite spam de Stripe sessions |
| `POST /api/subscription/portal` | POST | **MEDIO** | Stripe portal creation |
| `POST /api/billing/portal` | POST | **MEDIO** | Billing portal creation |
| `POST /api/designs/remove-bg` | POST | **ALTO** | Background removal llama servicio externo (rembg) — sin RL permite DoS del sidecar |
| `POST /api/designs/compose` | POST | **MEDIO** | Design composition |
| `POST /api/designs/compose-v2` | POST | **MEDIO** | Design composition v2 |
| `POST /api/rag/search` | POST | **MEDIO** | RAG search (embeddings) — puede ser costoso |
| `POST /api/rag/add-documents` | POST | **ALTO** | RAG document indexing — puede ser muy costoso |
| `POST /api/rag/index` | POST | **ALTO** | RAG full index — puede ser muy costoso |
| `POST /api/push/subscribe` | POST | **BAJO** | Push notification subscribe |
| `POST /api/push/send` | POST | **ALTO** | Push notification send — sin RL permite spam de notificaciones |
| `POST /api/analytics/track` | POST | **MEDIO** | Analytics event tracking — sin RL permite inflacion de metricas |
| `POST /api/errors/report` | POST | **MEDIO** | Error reporting — sin RL permite flooding de logs |
| `POST /api/session/migrate` | POST | **BAJO** | Session migration |
| `POST /api/consent` | POST | **BAJO** | GDPR consent |
| `POST /api/ab-test/events` | POST | **BAJO** | A/B test event tracking |
| `POST /api/ab-test/experiments` | POST | **MEDIO** | Experiment creation (admin) |
| `PUT /api/ab-test/experiments/[id]` | PUT | **BAJO** | Experiment update (admin) |
| `POST /api/captcha/verify` | POST | **MEDIO** | Captcha verification sin RL permite brute force |
| `POST /api/marketing/test-ad-copy` | POST | **ALTO** | AI ad copy generation — usa LLM, sin RL permite abuso costoso |
| `POST /api/telegram/test-command` | POST | **MEDIO** | Telegram test command |
| `POST /api/tenant/gate` | POST | **BAJO** | Tenant gating |
| `POST /api/reviews/upload-photos` | POST | **ALTO** | Photo upload sin RL permite storage abuse |
| `DELETE /api/conversations/[id]` | DELETE | **BAJO** | Conversation delete |
| `PATCH /api/notifications/[id]/read` | PATCH | **BAJO** | Notification read |
| `PATCH /api/notifications/read-all` | PATCH | **BAJO** | Bulk notification read |
| `DELETE /api/profile/payment-methods/[id]` | DELETE | **BAJO** | Payment method delete |
| `PUT /api/shipping-addresses/[id]` | PUT | **BAJO** | Address update |
| `DELETE /api/shipping-addresses/[id]` | DELETE | **BAJO** | Address delete |
| `POST /api/shipping-addresses` | POST | **BAJO** | Address create |
| `POST /api/products` | POST | **ALTO** | Product creation (admin) |
| `POST /api/admin/migrate` | POST | **ALTO** | Admin migration — sin RL permite ejecucion repetida |
| `POST /api/admin/alert` | POST | **MEDIO** | Admin alert |
| `POST /api/admin/sitemap` | POST | **BAJO** | Sitemap generation |
| `PUT /api/admin/returns/[id]` | PUT | **BAJO** | Admin return update |
| `POST /api/admin/designs/moderate` | POST | **MEDIO** | Design moderation |
| `POST /api/webhooks/stripe` | POST | **N/A** | Protegido por signature verification (Stripe) |
| `POST /api/webhooks/whatsapp` | POST | **N/A** | Protegido por signature verification |
| `POST /api/webhooks/telegram` | POST | **N/A** | Protegido por secret token |
| `POST /api/webhooks/pod/[provider]` | POST | **N/A** | Protegido por signature verification |
| `POST /api/webhooks/cache-invalidate` | POST | **N/A** | Protegido por secret header |

**Resumen de gaps CRITICOS (riesgo ALTO)**:
1. `/api/auth/reset-password` — brute force risk
2. `/api/newsletter/subscribe` — email spam amplification
3. `/api/credits/purchase` — Stripe session spam
4. `/api/designs/remove-bg` — DoS del servicio rembg
5. `/api/rag/add-documents` y `/api/rag/index` — DoS via embeddings costosos
6. `/api/push/send` — notification spam
7. `/api/marketing/test-ad-copy` — LLM abuse
8. `/api/reviews/upload-photos` — storage abuse
9. `/api/products` y `/api/admin/migrate` — admin routes sin RL (aunque requieren auth)

---

## 4. AI/Chat Rate Limiting

### 4.1 Burst limiting

`/api/chat` tiene el sistema de rate limiting mas completo del proyecto:

1. **Burst limiter** (in-memory): 20 msg/min con fingerprint, 5 msg/min sin fingerprint
2. **Active block check**: Consulta `anomaly-monitor.ts` — si el identifier esta bloqueado, rechaza inmediatamente
3. **Velocity check**: Anti-bot — 5+ mensajes en <3 segundos = auto-bloqueo 30 min
4. **Concurrent slot limiter**: Max 2 requests streaming simultaneos por identifier

### 4.2 Daily usage limits

Despues del burst limiter, el chat tiene **tres capas de Supabase-backed limits**:

| Check | Anonymous | Free | Premium |
|---|---|---|---|
| Conversations/dia | 5 | 30 | 100 |
| Messages/dia | 20 | 200 | unlimited (-1) |
| Tokens/dia (pre-check) | 50,000 | 500,000 | 2,000,000 |

- Los limites son **persistentes** (Supabase table `user_usage`, atomic RPC `increment_usage`)
- **Fail-CLOSED**: Si Supabase falla, el request se DENIEGA (no se deja pasar)
- Premium users pueden usar **creditos** como overflow cuando agotan el limite mensual/diario
- Los tokens se rastrean post-streaming con `incrementTokenUsage()` (best-effort, no bloquea)
- **Anomaly detection**: Si un usuario consume >80% de su limite, se loguea un warning

### 4.3 Image generation limits

| Endpoint | Burst Limit | Usage Limit (Free) | Usage Limit (Premium) |
|---|---|---|---|
| `/api/designs/generate` | 5/min | 5/mes | 50/mes |
| `/api/designs/ai-generate` | 5/min | 5/mes | 50/mes |
| `/api/designs/ai-generate/refine` | 5/min | 10/mes | 100/mes |
| `/api/designs/mockup` | 10/min | 10/mes | 100/mes |
| `/api/designs/remove-bg` | **NINGUNO** | **NINGUNO** | **NINGUNO** |

**GAP CRITICO**: `/api/designs/remove-bg` no tiene burst limiter NI usage limiter. Solo requiere auth (`requireAuth`). Un usuario autenticado puede enviar requests ilimitados al servicio rembg.

---

## 5. Middleware-level Rate Limiting

**No existe rate limiting a nivel de middleware.**

El archivo `src/middleware.ts` solo maneja:
- i18n routing (next-intl)
- Tenant resolution (custom domains)
- CSRF token generation/validation
- Auth redirection (protected routes)
- A/B test variant assignment

No hay ningun mecanismo de rate limiting global a nivel de middleware. Toda la proteccion es per-route.

---

## 6. Distributed Rate Limiting Assessment

### 6.1 Redis

Redis existe en el stack (Docker Compose) y se usa para:
- Product detail cache (`src/lib/product-detail-cache.ts`)
- Translation cache
- Tenant resolution cache

**NO se usa para rate limiting.** El burst limiter es puramente in-memory.

### 6.2 Upstash / External

No hay imports de `@upstash/ratelimit` ni ningun servicio externo de rate limiting.

### 6.3 Evaluacion para self-hosted single-instance

Para un deploy **single-instance** (un proceso Next.js detras de Caddy):
- El burst limiter in-memory es **adecuado** — todas las requests pasan por el mismo `Map`
- El usage limiter Supabase es **robusto** — persistente, atomic, fail-closed
- El anomaly monitor in-memory es **adecuado** — misma razon que el burst limiter

Para un deploy **multi-instance**:
- El burst limiter se fragmenta entre instancias — un atacante con 5 instancias tiene 5x el limite
- El usage limiter Supabase sigue funcionando correctamente (persistente y compartido)
- El anomaly monitor se fragmenta — un bot puede evadir velocity detection si las requests van a instancias distintas

**Recomendacion**: Si se escala a multi-instancia, migrar el burst limiter a Redis (el Redis del stack ya existe). Una libreria como `rate-limiter-flexible` con `RateLimiterRedis` seria un reemplazo drop-in.

---

## 7. Recomendaciones

### 7.1 Prioridad CRITICA (exploitable ahora)

1. **Agregar rate limiting a `/api/auth/reset-password`** — Usar `forgotPasswordLimiter` (3/hora por IP). Sin esto, un atacante puede intentar brute force del access token.

2. **Agregar rate limiting a `/api/newsletter/subscribe`** — Usar `newsletterLimiter` (10/min por IP). Sin esto, un atacante puede generar miles de emails de confirmacion a direcciones arbitrarias (email bombing/amplification).

3. **Agregar rate limiting a `/api/designs/remove-bg`** — Crear un `removeBgLimiter` (5/min por userId). Cada request consume CPU/GPU del sidecar rembg.

4. **Agregar rate limiting a `/api/credits/purchase`** — Usar `checkoutLimiter` o crear uno dedicado. Stripe session creation tiene cost implications.

### 7.2 Prioridad ALTA

5. **Agregar rate limiting a `/api/rag/add-documents` y `/api/rag/index`** — Embedding generation es costoso. Limitar a 5/hora.

6. **Agregar rate limiting a `/api/marketing/test-ad-copy`** — Usa LLM. Limitar a 5/min.

7. **Agregar rate limiting a `/api/push/send`** — Notification spam. Limitar a 10/min.

8. **Agregar rate limiting a `/api/reviews/upload-photos`** — Storage abuse. Limitar a 5/15min como avatar.

9. **Agregar rate limiting a `/api/cart` (POST)** — Cart add pollution. Limitar a 30/min por IP/session.

### 7.3 Prioridad MEDIA

10. **Limpiar limiters no usados** — `apiLimiter`, `previewTextLimiter`, `personalizeLimiter` estan definidos pero nunca importados. Eliminar o aplicar donde corresponda.

11. **Middleware-level fallback** — Considerar un rate limiter global en middleware (e.g., 200 req/min por IP) como red de seguridad para endpoints que no tienen rate limiting propio.

12. **Rate limit headers consistentes** — Solo algunos endpoints devuelven `X-RateLimit-Remaining`. Estandarizar para todos los endpoints con rate limiting.

### 7.4 Prioridad BAJA (mejoras futuras)

13. **Redis-backed limiter para multi-instancia** — Si se escala a >1 instancia, migrar `RateLimiter` a Redis.

14. **IP reputation scoring** — Integrar listas de IPs conocidas (Tor, VPN, datacenter) para ajustar limites dinamicamente.

15. **Supabase cleanup cron** — La tabla `user_usage` crece indefinidamente. Agregar un cron que limpie periodos antiguos (>30 dias).
