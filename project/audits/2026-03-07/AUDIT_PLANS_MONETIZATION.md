# SKAPARA Plans, Limits & Monetization Audit — 2026-03-07

## Executive Summary

**Monetization Readiness Score: 8.2 / 10**

SKAPARA has a well-architected monetization system with a two-tier model (Free / Premium at EUR 9.99/mo), a credits overflow system for premium users, and comprehensive server-side limit enforcement backed by atomic Supabase RPCs. The Stripe integration covers the full subscription lifecycle including webhooks for creation, updates, cancellation, failed payments, and chargebacks. Key strengths include fail-closed behavior on Supabase errors, GDPR-compliant IP hashing for anonymous tracking, and idempotent webhook processing. The main gaps are: (1) the `plan-gates.ts` multi-tenant system is disconnected from the consumer-facing `usage-limiter.ts`, creating confusion; (2) no free trial period exists; (3) the `increment_usage` RPC has a non-atomic rollback pattern; and (4) anonymous guest limits can be partially circumvented by clearing cookies/fingerprints.

---

## Plan Feature Matrix

| Feature | Guest (Anonymous) | Registered (Free) | Premium (EUR 9.99/mo) |
|---------|:-:|:-:|:-:|
| **Chat conversations/day** | 5 | 30 | 100 |
| **Chat messages/day** | 20 | 200 | Unlimited (-1) |
| **Chat tokens/day** | 50,000 | 500,000 | 2,000,000 |
| **Design generation/month** | 0 (blocked) | 5 | 50 |
| **AI design generation/month** | 0 (blocked) | 5 | 50 |
| **Design refine/month** | 0 (blocked) | 10 | 100 |
| **Mockup generation/month** | 3/day | 10/month | 100/month |
| **Design saves/day** | 0 (blocked) | 20 | Unlimited (-1) |
| **Design uploads/day** | 0 (blocked) | 5 | 20 |
| **Credit purchases** | N/A | N/A | Yes (overflow) |
| **Monthly bonus credits** | N/A | N/A | 10 |
| **Cost guard (per gen)** | N/A | $0.05 | $0.15 |
| **Cost guard (monthly budget)** | N/A | $2.50 | $25.00 |
| **Stripe Billing Portal** | N/A | N/A | Yes |
| **Output token cap/response** | 2,048 | 4,096 | 8,192 |
| **Order tracking** | Yes | Yes | Yes |
| **Wishlist** | N/A | Yes | Yes |

---

## Findings

### Phase 1: Plan Definition & Pricing

| # | Finding | Severity | File:Line | Status | Recommendation |
|---|---------|----------|-----------|--------|----------------|
| PLM-01 | Plan limits are centralized in `USAGE_TIERS` constant — single source of truth | -- | `frontend/src/lib/usage-limiter.ts:25-58` | PASS | N/A |
| PLM-02 | Pricing page exists with clear Free vs Premium comparison, i18n in EN/ES/DE | -- | `frontend/src/app/[locale]/(app)/pricing/page.tsx` | PASS | N/A |
| PLM-03 | EUR 9.99 price hardcoded in pricing page (`tier.price = '9.99'`) but actual Stripe price comes from `STRIPE_PREMIUM_PRICE_ID` env var — no validation they match | MEDIUM | `pricing/page.tsx:52` vs `subscription/create/route.ts:82` | WARN | Add a startup check or comment documenting which Stripe Price ID maps to EUR 9.99 |
| PLM-04 | Two separate plan systems exist: `usage-limiter.ts` (consumer: anonymous/free/premium) and `plan-gates.ts` (multi-tenant: free/starter/pro/enterprise). They are completely disconnected | MEDIUM | `frontend/src/lib/plan-gates.ts` vs `frontend/src/lib/usage-limiter.ts` | WARN | Consolidate or clearly document that `plan-gates.ts` is for B2B multi-tenant and `usage-limiter.ts` is for B2C consumers |
| PLM-05 | Pricing page is mobile-responsive (grid-cols-1 on mobile, md:grid-cols-2 for tiers, md:grid-cols-3 for credits) | -- | `pricing/page.tsx:169,281` | PASS | N/A |
| PLM-06 | Pricing text fully translated in all 3 locales (EN/ES/DE) with feature descriptions matching actual limits | -- | `messages/en.json:1441-1479`, `messages/es.json`, `messages/de.json` | PASS | N/A |
| PLM-07 | Credit packs defined in 2 places: `pricing/page.tsx:14-18` (frontend display) and `credits/purchase/route.ts:20-24` (backend logic). Prices match but are duplicated | LOW | `pricing/page.tsx:14` and `credits/purchase/route.ts:20` | WARN | Extract to shared config or validate at build time |
| PLM-08 | No free trial period offered | LOW | N/A | N-A | Consider 7-day free trial to boost conversion |

### Phase 2: Usage Tracking

| # | Finding | Severity | File:Line | Status | Recommendation |
|---|---------|----------|-----------|--------|----------------|
| PLM-09 | Usage stored in `user_usage` Supabase table with `UNIQUE(identifier, action, period)` index. Schema is clean | -- | `20260214180000_user_usage_tracking.sql:20-29` | PASS | N/A |
| PLM-10 | Daily periods use UTC midnight (`toISOString().slice(0,10)`), monthly use `YYYY-MM`. Consistent and deterministic | -- | `usage-limiter.ts:89-95` | PASS | N/A |
| PLM-11 | Guest tracking uses IP hash with daily salt for GDPR compliance. Fingerprint (`fp:`) and UUID pass through unchanged | -- | `usage-limiter.ts:77-87` | PASS | Good GDPR pattern |
| PLM-12 | RLS on `user_usage` is service_role-only (fixed in migration `20260215200000`). Client-side cannot read/write | -- | `20260215200000_fix_user_usage_rls.sql:13-16` | PASS | N/A |
| PLM-13 | Usage cleanup cron deletes records > 90 days. GDPR-compliant retention | -- | `cron/cleanup/route.ts:129-138` | PASS | N/A |
| PLM-14 | `increment_usage` RPC has a non-atomic rollback: it INSERTs (count+1) then checks if over limit and UPDATEs (count-1). Under high concurrency, two requests could both succeed before the rollback | HIGH | `20260214180000_user_usage_tracking.sql:71-92` | FAIL | Rewrite to check-then-increment pattern: `INSERT ... ON CONFLICT DO UPDATE SET count = LEAST(count + 1, p_limit) RETURNING count` or use `SELECT FOR UPDATE` |
| PLM-15 | `increment_usage_by` (token tracking) does NOT enforce the limit — it always increments and returns `over: boolean`. The caller must check. This is acceptable since tokens are best-effort | -- | `20260222200001_increment_usage_by.sql:1-16` | PASS | Design choice documented |

### Phase 3: Limit Enforcement

| # | Finding | Severity | File:Line | Status | Recommendation |
|---|---------|----------|-----------|--------|----------------|
| PLM-16 | Chat limit check is BEFORE AI call — no wasted API credits. Three-layer check: (1) conversation count, (2) message count, (3) token budget pre-check | -- | `chat/route.ts:261-310` | PASS | Excellent defense-in-depth |
| PLM-17 | Design generation endpoints all enforce limits server-side with `checkAndIncrementUsage` BEFORE calling AI providers | -- | `designs/generate/route.ts:48-59`, `designs/ai-generate/route.ts:80-92` | PASS | N/A |
| PLM-18 | Design cost guard adds a second layer: per-generation ($0.05/$0.15) and monthly budget ($2.50/$25.00) caps. Fail-closed on query errors (returns Infinity spend) | -- | `design-cost-guard.ts:22-101` | PASS | Excellent defense |
| PLM-19 | All design endpoints require authentication (`requireAuth`). Anonymous users cannot generate designs (limit=0 in USAGE_TIERS) | -- | `designs/generate/route.ts:20-24` | PASS | N/A |
| PLM-20 | Failed design generations are rolled back via `decrementUsage` RPC (GREATEST(count-1, 0)) | -- | `usage-limiter.ts:335-353`, `20260215200001_decrement_usage_rpc.sql` | PASS | N/A |
| PLM-21 | HTTP 429 returned consistently for all limit-reached scenarios with `X-RateLimit-*` headers and `LIMIT_REACHED` code | -- | `chat/route.ts:264-273`, `designs/generate/route.ts:51-58` | PASS | N/A |
| PLM-22 | Burst rate limiter is in-memory (per-instance). Not shared across serverless instances. Acceptable because Supabase-backed limits are the real enforcement | -- | `rate-limit.ts:1-9` | PASS | Documented design choice |
| PLM-23 | Rate limiter bypasses entirely for E2E tests (`PLAYWRIGHT_TEST_BASE_URL` or `CI` env) | MEDIUM | `rate-limit.ts:29` | WARN | Ensure these env vars are NEVER set in production |
| PLM-24 | Chat route checks subscription expiry: premium users with expired `subscription_period_end` or non-active `subscription_status` are downgraded to `free` tier at runtime | -- | `chat/route.ts:222-229` | PASS | Prevents stale premium status |

### Phase 4: Stripe Integration

| # | Finding | Severity | File:Line | Status | Recommendation |
|---|---------|----------|-----------|--------|----------------|
| PLM-25 | Webhook signature verification is present using `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET` | -- | `webhooks/stripe/route.ts:40-52` | PASS | N/A |
| PLM-26 | Idempotent order processing: checks `stripe_session_id` uniqueness before creating order | -- | `webhooks/stripe/route.ts:152-160` | PASS | N/A |
| PLM-27 | Idempotent credit pack processing: uses `UNIQUE(user_id, stripe_payment_id)` constraint, catches code `23505` | -- | `webhooks/stripe/route.ts:658-675` | PASS | Excellent pattern |
| PLM-28 | Subscription lifecycle events handled: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`, `charge.dispute.created` | -- | `webhooks/stripe/route.ts:55-87` | PASS | Comprehensive |
| PLM-29 | On subscription activation, user tier is updated to `premium` in DB. On deletion, downgraded to `free` | -- | `webhooks/stripe/route.ts:558-569, 627-639` | PASS | N/A |
| PLM-30 | Monthly bonus credits (10) added atomically on subscription activation via `add_credits` RPC | -- | `webhooks/stripe/route.ts:577-593` | PASS | N/A |
| PLM-31 | Failed payment handler updates status to `past_due` and sends email + admin alert | -- | `webhooks/stripe/route.ts:726-790` | PASS | N/A |
| PLM-32 | Chargeback handler cancels order and pauses fulfillment. Creates audit log + admin notification | -- | `webhooks/stripe/route.ts:883-1001` | PASS | N/A |
| PLM-33 | Stripe Price ID for premium plan comes from env var `STRIPE_PREMIUM_PRICE_ID` — not hardcoded. Good practice | -- | `subscription/create/route.ts:82` | PASS | N/A |
| PLM-34 | Subscription create has rate limit: 3 checkout sessions per hour per user | -- | `subscription/create/route.ts:34-40` | PASS | N/A |
| PLM-35 | Missing `invoice.paid` webhook handler — subscription renewals rely on `customer.subscription.updated` only | LOW | `webhooks/stripe/route.ts:55-87` | WARN | Add `invoice.paid` for explicit renewal tracking and invoice receipts |
| PLM-36 | `STRIPE_WEBHOOK_SECRET` read via `process.env.STRIPE_WEBHOOK_SECRET!` (non-null assertion). If not set, constructEvent will throw but the error is caught | LOW | `webhooks/stripe/route.ts:44` | WARN | Add explicit env var check at startup |
| PLM-37 | Stripe client uses lazy singleton Proxy pattern. Well-implemented | -- | `stripe.ts:27-33` | PASS | N/A |
| PLM-38 | `consume_credit_atomic` now has tier='premium' guard at DB level — free users cannot spend credits even if code calls the RPC | -- | `20260307112400_add_tier_check_to_consume_credit_atomic.sql` | PASS | Defense-in-depth |

### Phase 5: Upsell & Engagement

| # | Finding | Severity | File:Line | Status | Recommendation |
|---|---------|----------|-----------|--------|----------------|
| PLM-39 | ChatArea intercepts 429 `LIMIT_REACHED` responses and shows UpgradeModal (authenticated) or AuthWallModal (anonymous) | -- | `ChatArea.tsx:174-184` | PASS | Natural in-context upsell |
| PLM-40 | UpgradeModal shows Free vs Premium feature comparison with one-click upgrade via `/api/subscription/create` | -- | `UpgradeModal.tsx:1-89` | PASS | N/A |
| PLM-41 | Input field disables and shows limit-reached placeholder when `isLimitReached` is true | -- | `ChatArea.tsx:872-878` | PASS | Clear UX signal |
| PLM-42 | SubscriptionStatusBanner shows for `past_due` users with "Update Payment" CTA | -- | `SubscriptionStatusBanner.tsx:69-100` | PASS | Good dunning UX |
| PLM-43 | PlanCard in profile shows current tier, limits, credit balance, and Manage Subscription button | -- | `profile/PlanCard.tsx:86-171` | PASS | N/A |
| PLM-44 | BillingSettings component provides Stripe Billing Portal access for premium users | -- | `billing/BillingSettings.tsx:51-72` | PASS | N/A |
| PLM-45 | Email drip sequence: welcome (1h) -> tips (72h) -> credit offer (168h) for new subscribers | -- | `email-drip.ts:23-28` | PASS | Good conversion funnel |
| PLM-46 | No remaining-uses indicator in the chat UI. Users don't know how many chats remain until they hit the limit | MEDIUM | `ChatArea.tsx` | WARN | Add a subtle "X/30 chats remaining" indicator |
| PLM-47 | No proactive upsell before hitting limits (e.g., at 80% usage) | LOW | N/A | WARN | Show soft upsell when usage > 80% of limit |
| PLM-48 | No free trial offer on pricing page | LOW | `pricing/page.tsx` | N-A | Consider adding 7-day free trial to reduce friction |
| PLM-49 | No social proof on pricing page (subscriber count, testimonials) | LOW | `pricing/page.tsx` | WARN | Add "X users subscribed" or testimonials |

### Phase 6: Security & Integrity

| # | Finding | Severity | File:Line | Status | Recommendation |
|---|---------|----------|-----------|--------|----------------|
| PLM-50 | Anonymous guest limits can be partially bypassed by clearing cookies/localStorage and changing IP (new daily hash = new identity) | HIGH | `usage-limiter.ts:77-87` | FAIL | Inherent limitation. Fingerprint (`fp:`) mitigates but is opt-in from client. Consider requiring fingerprint for all anonymous usage |
| PLM-51 | Anonymous users without fingerprint get stricter burst rate limit (5/min vs 20/min) | -- | `rate-limit.ts:63` and `chat/route.ts:182-184` | PASS | Good mitigation |
| PLM-52 | All limit checks are server-side. No client-only enforcement | -- | Multiple routes | PASS | N/A |
| PLM-53 | API calls without UI are subject to same limits — identifier comes from auth token (authenticated) or IP hash (anonymous) | -- | `chat/route.ts:234` | PASS | Cannot bypass via curl |
| PLM-54 | Spoofed user ID impossible: tier is read from Supabase after verifying auth token, not from client input | -- | `chat/route.ts:211-221` | PASS | N/A |
| PLM-55 | Anomaly monitor auto-blocks identifiers after 5+ rate limit hits in 5 min (30-min block) | -- | `anomaly-monitor.ts:86-89` | PASS | N/A |
| PLM-56 | Velocity detection blocks bot-like behavior (5+ messages in <3 seconds) | -- | `anomaly-monitor.ts:113-149` | PASS | N/A |
| PLM-57 | Concurrent request limiter: max 2 streaming requests per identifier | -- | `rate-limit.ts:112-128` | PASS | N/A |
| PLM-58 | `user_usage` table has RLS: only `service_role` can access. Client-side Supabase cannot manipulate counters | -- | `20260215200000_fix_user_usage_rls.sql` | PASS | N/A |
| PLM-59 | Credit purchase requires both `tier === 'premium'` (code check) AND `subscription_status === 'active'` (DB check) | -- | `credits/purchase/route.ts:33-66` | PASS | Double verification |
| PLM-60 | No device/session limiting for premium accounts — a shared account could be used simultaneously from multiple devices | LOW | N/A | WARN | Consider session limiting or concurrent-device cap |
| PLM-61 | Stripe webhook secrets stored in env vars, not hardcoded | -- | `webhooks/stripe/route.ts:44` | PASS | N/A |
| PLM-62 | Content safety check (`checkPromptSafety`) runs on all prompts before AI processing — prevents abuse of paid AI credits | -- | `designs/generate/route.ts:74-79` | PASS | N/A |

---

## Limit Enforcement Audit

| Limit | Server-Side | Bypassable | Atomic | Notes |
|-------|:-:|:-:|:-:|-------|
| Guest chat (5/day) | YES | PARTIAL (IP rotation/cookie clear) | WARN (see PLM-14) | Fingerprint mitigates; no-fp users get 5/min burst limit |
| Free chat (30/day) | YES | NO (tied to auth.uid) | WARN (see PLM-14) | Multi-device OK but same user_id counter |
| Premium chat (100/day) | YES | NO | WARN (see PLM-14) | Credits as overflow if limit exceeded |
| Guest design (0) | YES | NO | N/A | Blocked entirely; auth required |
| Free design (5/month) | YES | NO | WARN (see PLM-14) | Auth required + cost guard |
| Premium design (50/month) | YES | NO | WARN (see PLM-14) | Auth required + cost guard + credits overflow |
| Token budget | YES | NO | YES (increment_by is non-rollback) | Best-effort tracking, over-limit returns boolean |
| Credit consumption | YES | NO | YES (single UPDATE with WHERE credit_balance > 0) | DB-level tier='premium' guard added |

---

## Stripe Integration Checklist

| Check | Status | Notes |
|-------|:------:|-------|
| Webhook signature verified | PASS | `constructEvent` with `STRIPE_WEBHOOK_SECRET` |
| Idempotent order processing | PASS | `stripe_session_id` uniqueness check |
| Idempotent credit processing | PASS | `UNIQUE(user_id, stripe_payment_id)` + code 23505 catch |
| Subscription status sync to DB | PASS | On create/update/delete events |
| Failed payment handling | PASS | `past_due` status + email + admin alert |
| Chargeback handling | PASS | Order cancelled + audit log + admin notification |
| Billing portal access | PASS | Two endpoints: `/api/subscription/portal` and `/api/billing/portal` |
| Subscription create rate limited | PASS | 3/hour per user |
| Already-subscribed guard | PASS | Returns 400 if `subscription_status === 'active'` |
| Stripe customer creation | PASS | Created on first subscribe, ID stored in `stripe_customer_id` |
| Price ID from env var | PASS | `STRIPE_PREMIUM_PRICE_ID` — not hardcoded |
| API version pinned | PASS | `2026-01-28.clover` in `stripe.ts:19` |
| `invoice.paid` handler | WARN | Missing — renewals rely on `subscription.updated` only |
| Webhook replay protection | PASS | Stripe's built-in via constructEvent + idempotency checks |

---

## Scorecard

| Category | Score /10 | Notes |
|----------|:---------:|-------|
| Plan Design | 9 | Clear 2-tier model, well-defined limits, credit overflow system, i18n |
| Limit Enforcement | 8 | Server-side, fail-closed, multi-layer. -1 for non-atomic RPC, -1 for guest bypass |
| Stripe Integration | 9 | Full lifecycle, idempotent, chargeback handling. -1 for missing `invoice.paid` |
| Upsell Flow | 7 | Good modal triggers, drip emails. -2 for no usage indicator, no proactive upsell, no trial |
| Security | 8 | RLS, atomic credits, anomaly detection. -1 for guest bypass, -1 for no session limiting |
| **Overall** | **8.2** | Production-ready with minor improvements needed |

---

## Priority Action Items

1. **[P0]** Fix `increment_usage` RPC non-atomic rollback pattern — under concurrent requests, two users can both pass the limit check before the rollback executes (`20260214180000_user_usage_tracking.sql:77-87`). Rewrite to use `SELECT ... FOR UPDATE` or single atomic check-and-increment.

2. **[P1]** Add remaining-uses indicator to ChatArea UI — users currently have no visibility into their remaining quota until they hit the wall (`ChatArea.tsx`). Show "X/30 chats remaining" subtly near the input.

3. **[P1]** Require fingerprint for anonymous chat usage — currently, anonymous users without fingerprint get a 5/min burst limit but can still circumvent daily limits by changing IP. Consider blocking chatless fingerprint entirely or adding CAPTCHA.

4. **[P1]** Validate `STRIPE_PREMIUM_PRICE_ID` matches displayed EUR 9.99 — add a startup validation or at minimum a well-placed comment documenting the mapping.

5. **[P2]** Add `invoice.paid` webhook handler for explicit renewal tracking and sending invoice/receipt emails.

6. **[P2]** Add proactive soft upsell at 80% usage (e.g., "You've used 24/30 chats today. Upgrade for 100/day.") via the existing `checkAnomaly` detection that already logs at 80%.

7. **[P2]** Consolidate or document the relationship between `plan-gates.ts` (multi-tenant B2B) and `usage-limiter.ts` (consumer B2C) to avoid confusion.

8. **[P2]** Ensure `PLAYWRIGHT_TEST_BASE_URL` and `CI` env vars are never set in production — they bypass ALL rate limiting (`rate-limit.ts:29`).

9. **[P3]** Consider 7-day free trial to reduce subscription friction.

10. **[P3]** Add social proof to pricing page (subscriber count, testimonials).

11. **[P3]** Consider concurrent device/session limiting for premium accounts to prevent account sharing.
