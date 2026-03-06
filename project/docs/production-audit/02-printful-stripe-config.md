# Production Audit: Printful + Stripe Integration

> **Date**: 2026-03-06
> **Auditor**: Claude Sonnet 4.6 (Agent)
> **Branch**: master
> **Scope**: Printful provider integration, POD abstraction layer, Stripe payment configuration

---

## Executive Summary

The codebase has undergone a significant architectural shift from Printify to Printful as the primary POD provider, mediated by a well-designed provider abstraction layer (`frontend/src/lib/pod/`). The POD abstraction is production-quality: clean interface segregation, proper error hierarchy, provider-agnostic sync engine, and canonical data models. The Stripe integration is feature-complete for an e-commerce store (checkout, webhooks, subscriptions, credits, billing portal, chargebacks).

However, there are several production blockers that must be resolved before going live:

**Printful**: The webhook verification uses query-string secret comparison (Printful's actual mechanism) rather than HMAC, which is correct but has a length-comparison bypass risk. The `updateProduct` method is a no-op stub. The `getVariantPricing` method returns empty array always — pricing data does not flow from Printful's catalog. The `PRINTFUL_API_TOKEN`, `PRINTFUL_STORE_ID`, and `PRINTFUL_WEBHOOK_SECRET` are marked `[OPTIONAL]` in `.env.example` when they are de facto required for production.

**Stripe**: `STRIPE_PREMIUM_PRICE_ID` is used via non-null assertion (`!`) in the subscription creation route but is completely absent from `.env.example`. The `automatic_tax` flag is explicitly disabled (`enabled: false`). The Stripe tax fallback uses hardcoded US state rates even though the store operates in EUR/EU. Idempotency keys are absent from checkout session creation. The `pod_provider` field in the orders table is hardcoded to `'printful'` in the webhook handler rather than being derived from the product's actual provider.

---

## Area 1 — Printful Provider Configuration

### 1.1 Current State

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/printful/client.ts`

The `PrintfulClient` class is a well-structured HTTP transport layer:

- **Authentication**: `Authorization: Bearer {token}` + `User-Agent: SKAPARA-POD/1.0` + optional `X-PF-Store-Id`. Correct per Printful API docs.
- **Rate limiting**: Token-bucket counting 120 req/min per process. Resets the window and counts correctly.
- **Retry logic**: 429 respects `Retry-After` header, 5xx uses `1000 * (3 - retries)` backoff (1s, 2s), max 2 retries.
- **Cache**: In-process `Map` with TTL for `/products` catalog GET endpoints (10-minute TTL).
- **Token expiry warning**: Logs if token expires in < 7 days. Good operational signal.
- **Error handling**: Distinguishes 401 (`PODAuthError`), 429 (`PODRateLimitError`), 5xx (retry), and other errors (`PODProviderError` with HTTP status code).

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/printful/index.ts`

`PrintfulProvider` implements `PODProvider` correctly for most methods:

- `publishProduct`, `confirmPublishing`, `reportPublishingFailed` are no-ops (correct, Printful auto-publishes sync products)
- `createOrder` uses `?confirm=true` to skip draft state (correct Printful behavior)
- `generateMockup` / `getMockupStatus` implement the async task polling pattern correctly
- `getShippingRates` hardcodes `currency: 'EUR'` and `locale: 'en_US'`

**Critical stub**: `updateProduct` (line 110-115) does not update anything — it fetches the current product and returns it as-is. There is no equivalent Printful v1 endpoint for partial sync product updates.

**Critical stub**: `getVariantPricing` (line 80-83) always returns `[]`. Printful variant pricing requires separate catalog lookups via `/products/{id}/variants` on the public catalog API, which the client does not implement.

### 1.2 Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| `updateProduct` is a no-op stub | HIGH | Callers that update product attributes get a silent success with no actual change in Printful |
| `getVariantPricing` always returns `[]` | HIGH | Variant costs are never populated in `CanonicalVariant.costCents`, so the margin auditor can never compute real margins for Printful products — it falls back to a hardcoded floor |
| Rate limiter is per-process only | MEDIUM | With multiple serverless function instances, each has its own token bucket. Real-world rate limiting can exceed 120 req/min across instances |
| Cache is in-process only | MEDIUM | Same issue — cache does not survive across serverless invocations; every cold start fetches fresh catalog data |
| `tokenExpiresAt` is optional and silent | LOW | If `PRINTFUL_TOKEN_EXPIRES_AT` env var is not set, no expiry warning fires even with an expiring token |

### 1.3 Environment Variable Requirements

| Variable | In `.env.example` | Marked | Notes |
|----------|------------------|--------|-------|
| `PRINTFUL_API_TOKEN` | Yes | `[OPTIONAL]` | De facto REQUIRED for production |
| `PRINTFUL_STORE_ID` | Yes | `[OPTIONAL]` | De facto REQUIRED — without it, `X-PF-Store-Id` header is omitted |
| `PRINTFUL_WEBHOOK_SECRET` | Yes | `[OPTIONAL]` | De facto REQUIRED — without it, all incoming webhooks will fail verification and return 401 |
| `PRINTFUL_TOKEN_EXPIRES_AT` | No | — | Undocumented; only used for token expiry warning |
| `POD_PROVIDER` | No | — | Undocumented; defaults to `'printful'` |

### 1.4 Fix

- Mark `PRINTFUL_API_TOKEN`, `PRINTFUL_STORE_ID`, `PRINTFUL_WEBHOOK_SECRET` as `[REQUIRED]` in `.env.example`.
- Add `PRINTFUL_TOKEN_EXPIRES_AT` and `POD_PROVIDER` to `.env.example` as `[OPTIONAL]` with documentation.
- For `updateProduct`: document clearly that Printful sync product updates require deleting and recreating the product, or accept the limitation and throw `PODUnsupportedOperationError`.
- For `getVariantPricing`: implement a catalog lookup via `GET /products/{id}` → variants to populate `costCents` from the `price` field (Printful catalog prices in the store currency).

---

## Area 2 — Printful Product Sync

### 2.1 Current State

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/sync/sync-product.ts`

Provider-agnostic sync engine that upserts a `CanonicalProduct` into Supabase:

- Deduplicates images by base URL (strips query strings)
- Filters out size chart images
- Admin edit preservation via `shouldPreserveAdminEdits()` — compares `admin_edited_at` vs `last_synced_at` timestamps
- Category inference for new products only (never overwrites existing categories)
- Upserts on `provider_product_id` conflict key

**Variant sync**: Only syncs enabled variants. Cost and price are preserved from the canonical model; `image_url` per variant is stored. The `isAvailable` field maps to Printful's `synced === true` (from `mapper.ts` line 59).

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/cron/sync-printify/route.ts`

Full reconciliation cron (misleadingly still named `sync-printify` but uses provider-agnostic `getProvider()`):

- Paginated fetch of all provider products (max 50/page, 10 pages = 1000 products max)
- Creates missing products, updates stale products (title/image/status changes)
- Marks orphaned products as `deleted`
- Availability reconciliation: syncs `is_available` across all variant IDs
- Margin audit: fixes products below 35% margin threshold
- Divergence detection: 10% sampling with `detectDivergence()`
- Distributed lock via `acquireLock()` to prevent overlapping runs
- Monitoring via `logSyncReport()` and `alertOnSyncError()` (Telegram alert at 5+ errors or 50%+ failure rate)

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/sync/margin-auditor.ts`

Margin calculation uses tiered multipliers by product type (keyword matching in title), with a 40% floor and 3x ceiling. Rounds up to `.99`. The `auditMargins()` function runs on all active products with `cost_cents` populated.

### 2.2 Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| Cron still named `sync-printify` | LOW | Misleading name — it is provider-agnostic now |
| 1000-product page cap | MEDIUM | `if (page > 10) break` — catalogs over 1000 products will be silently truncated |
| `costCents` is always `null` for Printful | HIGH | Since `getVariantPricing` returns `[]` and `toCanonicalProduct` sets `costCents: null` (mapper line 58 comment: "Cost requires separate catalog lookup"), margin auditor never fires for Printful products — it skips products with `null` cost |
| Image sync: `isAvailable` mapping | MEDIUM | Printful maps availability to `synced === true`, but a Printful variant that is synced but out-of-stock will show as available |
| `confirmPublishing!` called with `!` on optional method | LOW | Line 158: `provider.confirmPublishing!()` — this will throw if called against a provider that didn't implement it (Printify-only operation called in cron against Printful provider) |
| No retry cron for failed POD orders | HIGH | The old `retry-printify-orders` cron exists but it references Printify-specific logic. There is no equivalent for Printful orders stuck in `requires_review` or `failed` states |

### 2.3 Fix

- Rename route from `/api/cron/sync-printify` to `/api/cron/sync-provider` or use an alias.
- Increase or make the page limit configurable via env var.
- Implement `getVariantPricing` in the Printful client to populate `costCents`.
- Guard `confirmPublishing` call with `provider.confirmPublishing &&` (optional chaining).
- Create or adapt a retry cron for Printful failed orders.

---

## Area 3 — Printful Webhooks

### 3.1 Current State

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/pod/[provider]/route.ts`

Unified webhook receiver for both Printify and Printful at `POST /api/webhooks/pod/{provider}`:

- Validates provider ID against `KNOWN_PROVIDERS = Set(['printify', 'printful'])`.
- For Printful: extracts secret from `?secret=` query parameter.
- Verifies via `provider.verifyWebhook()`.
- Normalizes event via `provider.normalizeEvent()`.
- Writes audit log entry to `audit_log` table.
- Routes to handler via `webhookRouter.route()`.
- Always returns 200 after signature verification (prevents Printful retries on processing errors).

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/printful/webhook-verifier.ts`

Printful uses query-string secret rather than HMAC. The verifier uses `timingSafeEqual` for constant-time comparison. This is correct. However:

- The length check `sigBuf.length !== secBuf.length` short-circuits before `timingSafeEqual`, which could leak timing information about length. This is a minor concern since length is not secret, but it's worth noting.
- If `PRINTFUL_WEBHOOK_SECRET` is an empty string (unconfigured), the verification returns `false` immediately — correct behavior.

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/webhooks/index.ts`

Handlers registered:

| Event Type | Handler | Notes |
|-----------|---------|-------|
| `order.created` | `handleOrderCreated` | Log-only, no state change |
| `order.updated` | `handleOrderCreated` | Same handler — log-only |
| `order.shipped` | `handleOrderShipped` | Updates tracking, sends email + notification |
| `order.delivered` | `handleOrderDelivered` | Marks delivered |
| `order.cancelled` | `handleOrderCancelled` | Marks cancelled |
| `order.failed` | `handleOrderFailed` | Issues Stripe refund, notifies user |
| `product.created` | `handleProductUpdated` | Full product sync |
| `product.updated` | `handleProductUpdated` | Full product sync |
| `product.publish_succeeded` | `handleProductUpdated` | Full product sync |
| `product.deleted` | `handleProductDeleted` | Cascade delete |
| `stock.updated` | `handleStockUpdated` | Updates `is_available` per variant |

**Printful event type mapping** (from `constants.ts`):

| Printful Event | Canonical Type |
|---------------|----------------|
| `package_shipped` | `order.shipped` |
| `package_returned` | `order.cancelled` |
| `order_created` | `order.created` |
| `order_updated` | `order.updated` |
| `order_failed` | `order.failed` |
| `order_canceled` | `order.cancelled` |
| `order_put_hold` | `order.updated` |
| `order_remove_hold` | `order.updated` |
| `product_synced` | `product.created` |
| `product_updated` | `product.updated` |
| `product_deleted` | `product.deleted` |
| `stock_updated` | `stock.updated` |

### 3.2 Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| `PRINTFUL_WEBHOOK_SECRET` is optional in env | CRITICAL | If not set, every incoming Printful webhook is rejected with 401. The webhook URL must be registered in Printful dashboard with `?secret=VALUE` |
| No idempotency in webhook handlers | HIGH | If Printful retries a webhook (network failure before our 200), the handler will run twice. `order.shipped` updates are safe (idempotent update), but `order.failed` issues a Stripe refund which could double-refund |
| `package_returned` maps to `order.cancelled` | MEDIUM | A returned package is a different lifecycle state than a cancelled order — they should be handled differently |
| No Printful webhook registration | MEDIUM | The webhook URL `https://domain/api/webhooks/pod/printful?secret=VALUE` must be registered in the Printful dashboard. There is no automated webhook registration code (unlike Printify which had a setup flow) |
| `order.updated` handler is identical to `order.created` (log-only) | LOW | Printful sends `order_updated` for status changes. These are silently ignored beyond logging |
| Webhook secret exposed in URL | LOW | Printful's design puts the secret in the URL query string, which means it appears in logs, CDN access logs, and load balancer logs. This is Printful's architecture constraint, but log redaction should be configured |

### 3.3 Idempotency Analysis

The `order.failed` handler (`/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/webhooks/handlers/order-failed.ts`) calls `issueRefund()` which internally checks `alreadyRefunded` via `refund-guard`. This provides protection against double-refund on retry, assuming the refund guard is correctly implemented.

The `order.shipped` handler writes tracking data — idempotent for same tracking info; safe.

The `handleStockUpdated` handler updates `is_available` — idempotent by nature.

The `product.updated` handler calls `syncProductFromProvider` which uses `upsert` with `onConflict: 'provider_product_id'` — idempotent.

**Conclusion**: Most handlers are idempotent. The `order.failed` refund path has a guard. The main risk is if the refund guard itself has a bug.

### 3.4 Fix

- Mark `PRINTFUL_WEBHOOK_SECRET` as `[REQUIRED]` and document the Printful dashboard webhook registration step.
- Create a Printful webhook registration script or document the manual setup in the deployment runbook.
- Map `package_returned` to a dedicated `order.returned` event type (or handle it separately from `order.cancelled`).
- Configure CDN/proxy log redaction for `?secret=` query parameter values.

---

## Area 4 — Stripe Configuration

### 4.1 Stripe Client

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/stripe.ts`

- Lazy singleton via `Proxy` — client is created on first property access (avoids build-time errors).
- API version: `2026-01-28.clover` — pinned, recent.
- TypeScript mode enabled.
- Throws clearly if `STRIPE_SECRET_KEY` is missing (correct fail-fast behavior).
- `calculateTax()` function is implemented but contains a **dangerous fallback**: when `stripe_tax_inactive`, it uses hardcoded US state tax rates (CA: 7.25%, NY: 8%, TX: 6.25%, etc.). This store operates in EUR and serves EU customers — US state tax rates are semantically wrong for this use case.

### 4.2 Checkout Session Creation

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/checkout/create-session/route.ts`

**Strong points**:
- Server-side price authority: overrides client-supplied prices with DB variant prices before creating the session
- Stock validation before creating payment session
- Product availability validation (active + not deleted)
- Coupon validation (active, minimum purchase, usage limits)
- Stripe Connect support with per-tenant connected account routing and application fee calculation
- Free shipping threshold logic (>= €50)
- EU country restriction for shipping address collection

**Gaps**:

| Gap | Severity | Detail |
|-----|----------|--------|
| No idempotency key | HIGH | `stripe.checkout.sessions.create()` has no `idempotencyKey`. Network retries from the client can create duplicate sessions |
| `automatic_tax.enabled: false` | HIGH | EU VAT/OSS compliance is unaddressed. B2C digital goods sold in EU require VAT collection per destination country |
| Stripe Tax fallback uses US state rates | HIGH | If Stripe Tax is activated but fails, the code falls back to US rates. Wrong for EUR/EU store |
| Coupon Stripe object leaks | MEDIUM | Creates a one-time `stripe.coupons.create()` on every request with a coupon. If the session creation fails afterward, the orphaned Stripe coupon object is never cleaned up |
| Payment method type: hardcoded `['card']` | MEDIUM | `crypto` is conditionally added via `STRIPE_CRYPTO_ENABLED=true` env. Other EU-relevant methods (SEPA Direct Debit, iDEAL, Klarna, Bancontact) are not offered |
| Shipping delivery estimate is hardcoded | LOW | 5-7 business days regardless of destination country or product type |
| `any` type casts throughout | LOW | `item: any` casts in cart processing lose type safety |

### 4.3 Stripe Webhook Handler

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/stripe/route.ts`

**Strong points**:
- Signature verification via `stripe.webhooks.constructEvent()` (correct HMAC-SHA256 verification)
- Idempotency check for checkout session: `SELECT ... WHERE stripe_session_id = session.id` before creating order
- Atomic credit balance update via `supabase.rpc('add_credits')` with UNIQUE constraint on `(user_id, stripe_payment_id)` for credit pack purchases
- Chargeback handler: marks order `cancelled`, creates audit log, notifies admins
- Invoice payment failure handler: updates `subscription_status` to `past_due`

**Critical Gap — hardcoded `pod_provider`**:

Line 429:
```typescript
pod_provider: 'printful',
```

The `pod_provider` stored on the order is hardcoded to `'printful'` instead of being derived from the product's actual `pod_provider` column. In a dual-provider or future multi-provider scenario, this will misroute orders.

**Additional Gaps**:

| Gap | Severity | Detail |
|-----|----------|--------|
| `pod_provider` hardcoded | HIGH | Should be derived from `products.pod_provider` via lookup |
| Cart items matched by array index to Stripe line items | HIGH | `const cartItem = cartItems[index] || {}` — if Stripe reorders line items or adds tax/shipping rows, the index mapping breaks and order items get wrong `product_id`/`variant_id` |
| `(subscription as any).current_period_end` | MEDIUM | Uses `any` cast to access `current_period_end`. This is a known Stripe SDK typing issue but should be typed properly |
| No retry mechanism for failed POD order submission | MEDIUM | On Printful submission failure, the order is marked `requires_review` with `pod_retry_count: 1` but there is no cron that picks up these orders and retries |
| `sendOrderIssueEmail` / `sendOrderConfirmationEmail` failures are silent | LOW | Email failures log to console but no alert is sent to admin |
| `handleInvoicePaymentFailed` uses raw `fetch` for Resend | LOW | Should use the centralized `sendXxxEmail()` from `@/lib/resend` for consistency |
| Supabase client created inline with `createClient()` | LOW | Should use `supabaseAdmin` singleton from `@/lib/supabase-admin` |

### 4.4 Billing Portal

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/billing/portal/route.ts`

- Return URL hardcoded to `${BASE_URL}/en/settings/billing` — not locale-aware
- The `/settings/billing` route does not appear to exist in the route architecture (only `/profile`)
- Correct auth guard via `requireAuth()`

### 4.5 Credits Purchase

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/credits/purchase/route.ts`

- Credit packs are Premium-only (enforced correctly)
- Prices hardcoded in TypeScript (15 credits = €4.99, 50 credits = €14.99, 150 credits = €39.99)
- No idempotency key on checkout session creation
- Success/cancel URLs hardcoded to `/en/pricing` (not locale-aware)

### 4.6 Subscription Create

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/subscription/create/route.ts`

**Critical**: Uses `process.env.STRIPE_PREMIUM_PRICE_ID!` with a non-null assertion, but `STRIPE_PREMIUM_PRICE_ID` is **not present in `.env.example`** and not documented anywhere. Without this env var at runtime, the subscription creation route will throw an uncaught exception with `undefined` passed to Stripe, causing a cryptic 400 error.

Success/cancel URLs hardcoded to `/en/pricing` — not locale-aware.

### 4.7 Stripe Mode (Test vs Live)

The `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env.example` has value `pk_test_placeholder` — clearly a test-mode value. The audit found no validation or enforcement that test keys are not used in production. There is no startup check that verifies `sk_live_` prefix in production mode.

---

## Area 5 — Provider Abstraction Layer Quality

### 5.1 Interface Design

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/types.ts`

Follows Interface Segregation Principle (ISP) correctly:
- `PODCatalogProvider` — catalog browsing
- `PODProductProvider` — CRUD operations
- `PODDesignProvider` — design uploads, mockups
- `PODOrderProvider` — order lifecycle
- `PODWebhookProvider` — webhook verification + normalization
- `PODProvider` — composite of all five

Printify-specific operations (`publishProduct`, `confirmPublishing`, `reportPublishingFailed`) are correctly marked optional on the interface with `?` — Printful implements them as no-ops rather than throwing `PODUnsupportedOperationError`.

### 5.2 Error Hierarchy

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/errors.ts`

7-class error hierarchy with `provider` and `statusCode` context on every error. Clean and correct. No gaps.

### 5.3 Provider Registry

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/provider-registry.ts`

Singleton registry with `getForProduct(productProviderId)` enabling per-product provider routing during dual-provider migration. Clean implementation. No gaps.

### 5.4 Initialization

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/index.ts`

`initializeProviders()` is idempotent (guard flag). Uses `require()` for dynamic import to avoid registering both providers when only one is configured. Falls back gracefully when no provider is configured (warn + no-op).

**Gap**: Only `PRINTFUL_API_TOKEN` triggers registration. If the codebase needed to support Printify still, there is no Printify registration path here. The Printify provider files exist under `printify/` but are not registered in `initializeProviders()`.

### 5.5 Printify Compat Layer

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/printify/compat.ts`

A backward-compatible shim that maps old `PrintifyClient` method calls to the provider abstraction. This is a migration artifact. The webhook handler at `frontend/src/app/api/webhooks/stripe/route.ts` still imports `canonicalAddressFromStripe` from `'@/lib/pod/printify/mapper'` — a Printify-specific import that works because the function is generic, but the import path is misleading.

### 5.6 Dead Code Assessment

| File | Status | Notes |
|------|--------|-------|
| `pod/printify/client.ts` | ACTIVE (compat shim uses it) | The old Printify client is referenced via compat.ts proxy |
| `pod/printify/mapper.ts` | ACTIVE | `canonicalAddressFromStripe` imported by Stripe webhook |
| `pod/printify/compat.ts` | ACTIVE (legacy scripts) | Shim for any code still using old API |
| `pod/printify/webhook-verifier.ts` | ACTIVE if Printify webhooks come in | Old webhook endpoint still exists |
| Old `lib/printify.ts` | CHECK NEEDED | Top-level `printify.ts` referenced in git diff |
| Old `lib/printify-sync.ts` | CHECK NEEDED | Referenced in git diff as modified |

### 5.7 Type Safety

The mapper in `printify/mapper.ts` uses typed raw interfaces (`PrintifyRawProduct`, `PrintifyRawVariant`). The Printful mapper (`printful/mapper.ts`) uses `Record<string, unknown>` throughout — less type-safe. Both emit fully typed canonical models.

The `CanonicalProduct._raw: unknown` field preserves the raw API response, which is good for debugging but bypasses type checking for any code that casts it.

---

## Area 6 — Environment Variables and Secrets

### 6.1 Complete Variable Audit

| Variable | In `.env.example` | Tagged As | Required For | Issue |
|----------|------------------|-----------|--------------|-------|
| `STRIPE_SECRET_KEY` | Yes | REQUIRED | All Stripe ops | OK |
| `STRIPE_WEBHOOK_SECRET` | Yes | REQUIRED | Stripe webhooks | OK |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | REQUIRED | Frontend checkout | Placeholder is `pk_test_*` |
| `STRIPE_PREMIUM_PRICE_ID` | **No** | — | Subscription creation | **MISSING** — causes runtime crash |
| `STRIPE_CRYPTO_ENABLED` | **No** | — | Optional crypto payments | Undocumented |
| `PRINTFUL_API_TOKEN` | Yes | `[OPTIONAL]` | All Printful ops | Should be REQUIRED |
| `PRINTFUL_STORE_ID` | Yes | `[OPTIONAL]` | Store operations | Should be REQUIRED |
| `PRINTFUL_WEBHOOK_SECRET` | Yes | `[OPTIONAL]` | Webhook verification | Should be REQUIRED |
| `PRINTFUL_TOKEN_EXPIRES_AT` | **No** | — | Token expiry warning | Undocumented |
| `POD_PROVIDER` | **No** | — | Provider selection | Undocumented, defaults to `'printful'` |
| `PRINTIFY_API_TOKEN` | Yes | REQUIRED | Legacy (old provider) | Printify is being migrated out |
| `PRINTIFY_SHOP_ID` | Yes | REQUIRED | Legacy (old provider) | Same |
| `PRINTIFY_WEBHOOK_SECRET` | Yes | `[OPTIONAL]` | Old webhook handler | OK |
| `CRON_SECRET` | Yes | REQUIRED | Cron auth | OK |

### 6.2 Secret Rotation Strategy

No secret rotation tooling exists. The `PrintfulClient` constructor checks `tokenExpiresAt` and warns if < 7 days remain, but only if `PRINTFUL_TOKEN_EXPIRES_AT` is set. There is no alerting mechanism for Stripe key rotation, webhook secret rotation, or other secrets.

**Recommended minimum**: Add a startup check or health endpoint that validates all required secrets are non-placeholder and non-empty.

### 6.3 Test Key Risk

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder` in `.env.example` is the initial value. If a production `.env` is created by copying `.env.example` without updating this, the frontend will initialize Stripe in test mode silently — payments will appear to work in the Stripe dashboard test environment but no real money moves.

There is no guard against deploying with test keys (`pk_test_` / `sk_test_`) in production.

---

## Config Checklist for Going Live

### Printful

- [ ] Register Printful webhook at `https://YOUR_DOMAIN/api/webhooks/pod/printful?secret=YOUR_WEBHOOK_SECRET` in Printful dashboard → Settings → Webhooks
- [ ] Set `PRINTFUL_API_TOKEN` to live API token from developers.printful.com
- [ ] Set `PRINTFUL_STORE_ID` to your Printful store ID
- [ ] Set `PRINTFUL_WEBHOOK_SECRET` to a strong random secret (matching the URL above)
- [ ] Optionally set `PRINTFUL_TOKEN_EXPIRES_AT` to the token expiry date for automatic warning
- [ ] Set `POD_PROVIDER=printful` explicitly (currently defaults to printful but should be explicit)
- [ ] Verify all active products have `pod_provider='printful'` in Supabase `products` table

### Stripe

- [ ] Set `STRIPE_SECRET_KEY` to live key (`sk_live_...`)
- [ ] Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to live publishable key (`pk_live_...`)
- [ ] Set `STRIPE_WEBHOOK_SECRET` from Stripe dashboard → Webhooks → Signing secret
- [ ] **Add `STRIPE_PREMIUM_PRICE_ID`** to `.env.example` and to production env — create a recurring price in Stripe dashboard for the Premium subscription
- [ ] Register Stripe webhook endpoint at `https://YOUR_DOMAIN/api/webhooks/stripe` in Stripe dashboard
- [ ] Enable events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`, `charge.dispute.created`, `payment_intent.*`
- [ ] Activate Stripe Tax in Stripe dashboard for EU VAT compliance (OSS registration required if selling cross-border EU B2C)
- [ ] Configure Stripe Tax automatic_tax to `enabled: true` in `create-session/route.ts` once Stripe Tax is activated
- [ ] Remove the US state tax rate fallback from `stripe.ts` or replace with a proper EU VAT fallback
- [ ] Set up Stripe Customer Portal configuration in Stripe dashboard (portal.stripe.com settings)
- [ ] Fix the Billing Portal return URL from `/en/settings/billing` to the actual profile billing route
- [ ] Configure allowed payment methods for EU customers (iDEAL, SEPA, Bancontact) if desired

### General

- [ ] Verify `BASE_URL` env var matches production domain (used in Stripe success/cancel URLs)
- [ ] Ensure `CRON_SECRET` is set and matches Vercel cron job configuration
- [ ] Run `sync-printify` cron manually after first deployment to populate all products

---

## Final Gaps Table (Sorted by Priority)

| # | Priority | Area | Gap | Fix |
|---|---------|------|-----|-----|
| 1 | CRITICAL | Stripe | `STRIPE_PREMIUM_PRICE_ID` not in `.env.example`; non-null assert crashes subscription route | Add to `.env.example` as `[REQUIRED]`, create Price in Stripe dashboard |
| 2 | CRITICAL | Printful | `PRINTFUL_API_TOKEN`, `PRINTFUL_STORE_ID`, `PRINTFUL_WEBHOOK_SECRET` tagged `[OPTIONAL]` | Re-tag as `[REQUIRED]`; without them the provider is completely non-functional |
| 3 | CRITICAL | Stripe | No EU VAT/OSS compliance — `automatic_tax.enabled: false` | Activate Stripe Tax in dashboard; enable in checkout session config |
| 4 | HIGH | Stripe | `pod_provider` hardcoded to `'printful'` in order record (webhook handler line 429) | Derive from `products.pod_provider` after product lookup |
| 5 | HIGH | Stripe | Cart items matched to Stripe line items by array index (fragile, breaks on reorder) | Match by `product_id` in metadata instead of positional index |
| 6 | HIGH | Printful | `getVariantPricing` always returns `[]` — costs never populated for Printful products | Implement catalog variant cost lookup in client |
| 7 | HIGH | Printful | `updateProduct` is a silent no-op — no actual update sent to Printful | Throw `PODUnsupportedOperationError` or document limitation |
| 8 | HIGH | Stripe | No idempotency key on checkout session creation — retry = duplicate session | Add `idempotencyKey: crypto.randomUUID()` or cart hash |
| 9 | HIGH | Stripe + Printful | No retry mechanism for POD orders in `requires_review` or `failed` state | Create or adapt retry cron for Printful failed orders |
| 10 | HIGH | Stripe | Stripe Tax fallback uses US state rates for an EU/EUR store | Remove US fallback; use `0%` or `stripe_tax_inactive` error message |
| 11 | MEDIUM | Printful | No webhook registration code — manual setup required | Document in deployment runbook; add script to register webhooks |
| 12 | MEDIUM | Printful | `package_returned` maps to `order.cancelled` — different lifecycle state | Add `order.returned` event type and handler |
| 13 | MEDIUM | Printful | Rate limiter is per-process; multiple serverless instances can exceed 120 req/min | Move rate limit tracking to Redis |
| 14 | MEDIUM | Printful | In-process catalog cache lost on cold starts | Use Redis for catalog cache TTL |
| 15 | MEDIUM | Stripe | Billing portal return URL points to non-existent route `/en/settings/billing` | Fix to correct profile/billing route |
| 16 | MEDIUM | Stripe | Credits and subscription success/cancel URLs hardcoded to `/en/pricing` (not locale-aware) | Use `${locale}/pricing` from request context |
| 17 | MEDIUM | General | `POD_PROVIDER` env var undocumented — provider selection is implicit | Document in `.env.example` |
| 18 | MEDIUM | Stripe | Orphaned Stripe coupon object if session creation fails after coupon creation | Delete coupon on error, or use Stripe Promotions API |
| 19 | LOW | Printful | Webhook secret in URL query string appears in logs | Configure log redaction for `?secret=` parameter |
| 20 | LOW | Printful | `confirmPublishing!` called with non-null assertion on optional method in cron | Use `provider.confirmPublishing?.()` optional chaining |
| 21 | LOW | Stripe | Test mode check missing — no guard against deploying `sk_test_*` in production | Add startup validation of key prefix in non-dev environments |
| 22 | LOW | Stripe | `STRIPE_TOKEN_EXPIRES_AT` / token rotation — no Stripe key expiry tracking | Add key documentation and rotation reminder |
| 23 | LOW | General | Cron still named `sync-printify` despite being provider-agnostic | Rename to `sync-provider` |
| 24 | LOW | General | Printify env vars still marked `[REQUIRED]` when Printful is primary provider | Update tags to reflect migration status |

---

## Key Files Audited

| File | Absolute Path |
|------|--------------|
| Printful Client | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/printful/client.ts` |
| Printful Provider | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/printful/index.ts` |
| Printful Mapper | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/printful/mapper.ts` |
| Printful Constants | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/printful/constants.ts` |
| Printful Webhook Verifier | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/printful/webhook-verifier.ts` |
| POD Types | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/types.ts` |
| POD Index (init) | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/index.ts` |
| POD Errors | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/errors.ts` |
| POD Constants | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/constants.ts` |
| Provider Registry | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/provider-registry.ts` |
| Sync Product | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/sync/sync-product.ts` |
| Margin Auditor | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/sync/margin-auditor.ts` |
| Conflict Resolver | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/sync/conflict-resolver.ts` |
| POD Monitoring | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/monitoring.ts` |
| Webhook Router | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/webhooks/webhook-router.ts` |
| Webhook Index | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/webhooks/index.ts` |
| Order Shipped Handler | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/webhooks/handlers/order-shipped.ts` |
| Order Failed Handler | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/webhooks/handlers/order-failed.ts` |
| Stock Updated Handler | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/webhooks/handlers/stock-updated.ts` |
| POD Webhook Endpoint | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/pod/[provider]/route.ts` |
| Sync Cron (sync-printify) | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/cron/sync-printify/route.ts` |
| Stripe Client | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/stripe.ts` |
| Stripe Checkout Utils | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/stripe-checkout.ts` |
| Stripe Webhook Handler | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/stripe/route.ts` |
| Checkout Create Session | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/checkout/create-session/route.ts` |
| Billing Portal | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/billing/portal/route.ts` |
| Credits Purchase | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/credits/purchase/route.ts` |
| Subscription Create | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/subscription/create/route.ts` |
| Environment Template | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/.env.example` |
| Printify Compat Shim | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/printify/compat.ts` |
