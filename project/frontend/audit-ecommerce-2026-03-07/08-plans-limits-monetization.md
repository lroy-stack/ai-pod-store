# SKAPARA Plans, Limits & Monetization Audit — 2026-03-07

## Executive Summary

The monetization system is **well-architected** with a mature three-tier model (anonymous/free/premium), server-side limit enforcement via atomic Supabase RPCs, fail-closed design, and comprehensive Stripe integration including webhooks, subscription lifecycle, credit packs, and chargeback handling. The biggest risks are: (1) `STRIPE_PREMIUM_PRICE_ID` missing from `.env.example` causing runtime crash on subscription creation, (2) hardcoded `/en/` locale in Stripe redirect URLs breaking i18n, and (3) guest limits bypassable via IP rotation since there is no persistent fingerprint enforcement server-side. Overall monetization readiness: **7.5/10** -- solid foundation, needs production config hardening and a few security patches.

---

## Findings

### Phase 1: Plan Definition & Pricing

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PLM-01 | Plan tiers well-defined in centralized `USAGE_TIERS` config with 3 tiers (anonymous/free/premium) and 9 tracked actions each | OK | `src/lib/usage-limiter.ts:25-59` | -- |
| PLM-02 | Price `9.99` hardcoded in pricing page component, not from a config constant or env var | LOW | `src/app/[locale]/(app)/pricing/page.tsx:52` | Extract to `store-config.ts` constant |
| PLM-03 | `STRIPE_PREMIUM_PRICE_ID` used with non-null assertion (`!`) but **missing from `.env.example`** -- subscription creation will crash at runtime if env var is unset | CRITICAL | `src/app/api/subscription/create/route.ts:70` | Add to `.env.example` as `[REQUIRED]`, validate at startup |
| PLM-04 | Pricing page is well-designed with shadcn/ui Card components, feature comparison, responsive grid (`grid-cols-1 md:grid-cols-2`), crypto badge, and credit packs section | OK | `src/app/[locale]/(app)/pricing/page.tsx` | -- |
| PLM-05 | Pricing text fully translated in all 3 locales (en/es/de) via next-intl | OK | `messages/en.json:1439-1477`, `messages/es.json:1439+`, `messages/de.json:1439+` | -- |
| PLM-06 | Price always shown as EUR (`\u20AC9.99`) regardless of user region -- no multi-currency support | LOW | `src/app/[locale]/(app)/pricing/page.tsx:235` | Acceptable for EU-only store |
| PLM-07 | `TIER_LIMITS` duplicated in `subscription/usage/route.ts:19-30` separate from canonical `USAGE_TIERS` in `usage-limiter.ts:25-59` -- risk of drift | MEDIUM | `src/app/api/subscription/usage/route.ts:19-30` | Import from `usage-limiter.ts` instead |
| PLM-08 | Credit packs defined in two places: pricing page (`src/app/[locale]/(app)/pricing/page.tsx:14-18`) and purchase route (`src/app/api/credits/purchase/route.ts:20-24`) with matching values | LOW | Both files | Extract to shared config |

### Phase 2: Usage Tracking

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PLM-09 | Usage stored in Supabase `user_usage` table with composite UNIQUE(`identifier`, `action`, `period`) -- persistent, server-side | OK | `supabase/migrations/20260214180000_user_usage_tracking.sql:20-29` | -- |
| PLM-10 | Periods are daily (`YYYY-MM-DD`) or monthly (`YYYY-MM`) using UTC midnight boundaries | OK | `src/lib/usage-limiter.ts:89-95` | -- |
| PLM-11 | Guest identification uses fingerprint (`fp:` prefix) or IP hash (`h:` prefix with daily GDPR-compliant salt) | OK | `src/lib/usage-limiter.ts:77-87` | -- |
| PLM-12 | IP hashing uses daily salt -- same IP gets different hash each day, effectively **resetting guest limits daily by design** (not a bug, but the daily hash salt means a guest's counter cannot accumulate across days even if the period says "daily") | LOW | `src/lib/usage-limiter.ts:84` | Intentional -- IP hashing is for GDPR, not persistence |
| PLM-13 | Guest users can bypass limits by: (a) clearing cookies to lose fingerprint, (b) using VPN/different IP, (c) incognito mode -- inherent limitation of anonymous tracking | MEDIUM | `src/lib/usage-limiter.ts:77-87` | Accept as trade-off; true enforcement requires auth |
| PLM-14 | Authenticated usage tied to `user.id` (UUID) -- cannot be spoofed without valid JWT | OK | `src/app/api/chat/route.ts:211-221` | -- |
| PLM-15 | `user_usage` table has RLS restricted to `service_role` only -- client-side cannot read/write directly | OK | `supabase/migrations/20260215200000_fix_user_usage_rls.sql:13-16` | -- |
| PLM-16 | Usage increment is atomic via `increment_usage` RPC (INSERT ON CONFLICT DO UPDATE + rollback if over limit) -- no race conditions | OK | `supabase/migrations/20260214180000_user_usage_tracking.sql:71-92` | -- |

### Phase 3: Limit Enforcement

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PLM-17 | Chat limit check happens BEFORE AI call -- no wasted API credits | OK | `src/app/api/chat/route.ts:262-274` | -- |
| PLM-18 | Three layers of chat protection: (1) burst rate limiter (in-memory, 20/min), (2) daily usage limiter (Supabase, per-tier), (3) daily token budget (50K-2M tokens) | OK | `src/app/api/chat/route.ts:182-310` | -- |
| PLM-19 | Fail-CLOSED: if Supabase RPC fails, request is DENIED (not silently allowed) with admin alert | OK | `src/lib/usage-limiter.ts:284-298` | -- |
| PLM-20 | Design generation requires auth (`requireAuth`) -- anonymous users blocked at auth level, not just usage level | OK | `src/app/api/designs/generate/route.ts:19-24` | -- |
| PLM-21 | Design generation has dual protection: burst rate limiter (5/min) + tier usage limiter (5 or 50/month) + cost guard ($2.50 or $25/month budget) | OK | `src/app/api/designs/ai-generate/route.ts:38-109` | -- |
| PLM-22 | Failed design generations are NOT rolled back from usage counter -- user loses a count even if generation fails | MEDIUM | `src/app/api/designs/ai-generate/route.ts:141-146` | Call `decrementUsage()` on failure (function exists at `usage-limiter.ts:335-353`) |
| PLM-23 | Mockup generation allows anonymous users (with IP-based limits of 3/day) -- by design | OK | `src/app/api/designs/mockup/route.ts:42` | -- |
| PLM-24 | Limit response returns HTTP 429 with `X-RateLimit-*` headers and structured JSON (`code: 'LIMIT_REACHED'`, `usage` object) | OK | `src/app/api/chat/route.ts:264-274` | -- |
| PLM-25 | Expired premium subscriptions correctly treated as free tier (checks `subscription_status` and `subscription_period_end`) | OK | `src/app/api/chat/route.ts:222-229` | -- |
| PLM-26 | Premium users get higher token output caps (8192 vs 2048/4096) and more tool steps (5 vs 3) | OK | `src/app/api/chat/route.ts:19-23`, `route.ts:2413` | -- |
| PLM-27 | Concurrent request limiter prevents >2 simultaneous streaming requests per identifier | OK | `src/lib/rate-limit.ts:110-128`, `src/app/api/chat/route.ts:253-258` | -- |
| PLM-28 | Anomaly monitor auto-blocks identifiers for 30 min after 5+ rate limit hits in 5 min, or 5+ messages in <3 seconds (anti-bot) | OK | `src/lib/anomaly-monitor.ts:57-149` | -- |
| PLM-29 | Rate limiters bypassed when `PLAYWRIGHT_TEST_BASE_URL` or `CI` env vars are set | LOW | `src/lib/rate-limit.ts:29` | Ensure these are never set in production |

### Phase 4: Stripe Integration

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PLM-30 | Webhook signature verification present using `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET` | OK | `src/app/api/webhooks/stripe/route.ts:40-52` | -- |
| PLM-31 | `STRIPE_WEBHOOK_SECRET` in `.env.example` as placeholder `whsec_placeholder` | OK | `.env.example:38` | -- |
| PLM-32 | Webhook handles 7 event types: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `payment_intent.succeeded/failed`, `invoice.payment_failed`, `charge.dispute.created` | OK | `src/app/api/webhooks/stripe/route.ts:55-87` | -- |
| PLM-33 | Order creation is idempotent -- checks `stripe_session_id` uniqueness before insert | OK | `src/app/api/webhooks/stripe/route.ts:152-160` | -- |
| PLM-34 | Credit pack purchase is idempotent -- uses UNIQUE(`user_id`, `stripe_payment_id`) to reject duplicates | OK | `src/app/api/webhooks/stripe/route.ts:658-675` | -- |
| PLM-35 | Credit balance update is atomic via `add_credits` RPC (`credit_balance = credit_balance + N`) | OK | `supabase/migrations/20260222200002_idempotent_credits.sql:14-28` | -- |
| PLM-36 | Subscription update webhook correctly sets `tier` to `premium`/`free` and adds 10 bonus credits on activation | OK | `src/app/api/webhooks/stripe/route.ts:535-616` | -- |
| PLM-37 | Subscription cancellation sets `tier: 'free'` and `subscription_status: 'cancelled'` | OK | `src/app/api/webhooks/stripe/route.ts:621-643` | -- |
| PLM-38 | `invoice.payment_failed` sets `subscription_status: 'past_due'` and sends payment failure email + admin alert | OK | `src/app/api/webhooks/stripe/route.ts:726-790` | -- |
| PLM-39 | Chargeback handling: cancels order, pauses fulfillment, creates audit log, notifies admins | OK | `src/app/api/webhooks/stripe/route.ts:883-1002` | -- |
| PLM-40 | Subscription creation has rate limit (3/hour per user) to prevent Stripe session spam | OK | `src/app/api/subscription/create/route.ts:26-32` | -- |
| PLM-41 | Subscription creation checks for existing active subscription before creating new one | OK | `src/app/api/subscription/create/route.ts:35-46` | -- |
| PLM-42 | Customer portal available via `/api/subscription/portal` (restricted to premium users) and `/api/billing/portal` (any authenticated user with stripe_customer_id) | OK | Both portal routes | -- |
| PLM-43 | Success/cancel URLs hardcoded to `/en/pricing` -- Spanish and German users redirected to English page after Stripe checkout | HIGH | `src/app/api/subscription/create/route.ts:74-75` | Pass locale from request and use `/${locale}/pricing` |
| PLM-44 | Credit purchase success/cancel URLs also hardcoded to `/en/pricing` | HIGH | `src/app/api/credits/purchase/route.ts:99-100` | Same fix as PLM-43 |
| PLM-45 | Billing portal return URL hardcoded to `/en/settings/billing` | MEDIUM | `src/app/api/billing/portal/route.ts:49` | Use user's locale |
| PLM-46 | Credits restricted to Premium subscribers only -- double-checked in both route handler (`user.tier`) AND database (`subscription_status`) | OK | `src/app/api/credits/purchase/route.ts:33-65` | -- |
| PLM-47 | `consume_credit_atomic` RPC has tier guard -- only `tier='premium'` users can spend credits at DB level | OK | `supabase/migrations/20260307112400_add_tier_check_to_consume_credit_atomic.sql:8-13` | -- |

### Phase 5: Upsell & Engagement

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PLM-48 | AuthWallModal shows when anonymous user hits chat limit -- offers signup with benefits list and premium teaser | OK | `src/components/engagement/AuthWallModal.tsx`, `src/components/storefront/ChatArea.tsx:179-182` | -- |
| PLM-49 | UpgradeModal shows when free user hits limit -- side-by-side free vs premium comparison with price and upgrade CTA | OK | `src/components/engagement/UpgradeModal.tsx` | -- |
| PLM-50 | SignupBanner appears in chat area when guest has used 50%+ of daily limit -- shows remaining count and signup CTA | OK | `src/components/engagement/SignupBanner.tsx:51` | -- |
| PLM-51 | WelcomePopup shows on first chat visit for unauthenticated users (session-based, not persistent) -- includes premium teaser | OK | `src/components/engagement/WelcomePopup.tsx` | -- |
| PLM-52 | SubscriptionStatusBanner shows "Payment Required" for `past_due` users -- dismissible, resets daily | OK | `src/components/SubscriptionStatusBanner.tsx` | -- |
| PLM-53 | `useEngagement` hook provides `checkAction()` which shows appropriate modal (auth wall for anon, upgrade for free) when limits are reached | OK | `src/hooks/useEngagement.ts:44-96` | -- |
| PLM-54 | Chat input placeholder changes to limit message when limit reached (different for anon vs free) | OK | `src/components/storefront/ChatArea.tsx:872-874` | -- |
| PLM-55 | Chat AI system prompt does NOT mention the premium plan or suggest upgrading -- missed upsell opportunity | MEDIUM | `src/app/api/chat/route.ts:401-522` | Add instruction: "When user asks about limits or upgrading, mention Premium plan (100 chats/day, 50 designs/month, EUR 9.99/mo)" |
| PLM-56 | UsageMeter component shows real-time usage bars in sidebar for authenticated users (chats, designs, mockups) | OK | `src/components/engagement/UsageMeter.tsx` | -- |
| PLM-57 | PlanCard in profile page shows tier, limits, credits, and manage/upgrade buttons | OK | `src/components/profile/PlanCard.tsx` | -- |
| PLM-58 | BillingSettings page provides full billing management with tier display, credits, and Stripe portal access | OK | `src/components/billing/BillingSettings.tsx` | -- |
| PLM-59 | Email drip sequence: welcome (1h), tips (72h), upgrade offer (168h) -- triggered on subscription activation | OK | `src/lib/email-drip.ts:23-28` | -- |
| PLM-60 | No free trial period configured -- users go directly from free to paid | LOW | `src/app/api/subscription/create/route.ts:65-80` | Consider `trial_period_days: 7` in Stripe session |
| PLM-61 | No introductory pricing or first-month discount | LOW | -- | Could add via Stripe coupons |
| PLM-62 | No social proof on pricing page (subscriber count, testimonials) | LOW | `src/app/[locale]/(app)/pricing/page.tsx` | Add subscriber count or testimonials |
| PLM-63 | Drip sequence triggered on subscription activation but NOT on limit-hit events for free users | MEDIUM | `src/lib/email-drip.ts` | Add `limit_hit` drip sequence to re-engage free users |
| PLM-64 | `useEngagement` hook fails open if usage fetch fails (`return true`) -- inconsistent with server-side fail-closed | LOW | `src/hooks/useEngagement.ts:59` | Acceptable for UX; server enforces regardless |

### Phase 6: Security & Integrity

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PLM-65 | All usage limits enforced server-side via Supabase RPCs -- cannot be bypassed by calling API directly (limits checked before AI/generation calls) | OK | Multiple route files | -- |
| PLM-66 | Premium status checked from Supabase `users.tier` column (server-side read) -- not from client JWT claims | OK | `src/app/api/chat/route.ts:217-221` | -- |
| PLM-67 | `user_usage` table RLS restricts to `service_role` only -- clients cannot manipulate counters | OK | `supabase/migrations/20260215200000_fix_user_usage_rls.sql:13-16` | -- |
| PLM-68 | `increment_usage` and `consume_credit_atomic` functions use `SECURITY DEFINER` -- execute with elevated privileges regardless of caller | OK | Migrations | -- |
| PLM-69 | No device/session limiting for premium users -- a premium account can be shared across unlimited devices | MEDIUM | -- | Consider concurrent session limit or IP-based alerts |
| PLM-70 | `STRIPE_WEBHOOK_SECRET` stored in env var (not hardcoded) -- correct pattern | OK | `src/app/api/webhooks/stripe/route.ts:44` | -- |
| PLM-71 | Content safety check on design prompts prevents abuse of generation pipeline | OK | `src/app/api/designs/ai-generate/route.ts:72-78` | -- |
| PLM-72 | Design cost guard adds monetary cap per user ($2.50/mo free, $25/mo premium) on top of count limits -- prevents expensive generation abuse | OK | `src/lib/design-cost-guard.ts:22-31` | -- |
| PLM-73 | E2E test bypass (`PLAYWRIGHT_TEST_BASE_URL` / `CI`) disables rate limiting -- ensure never set in production | LOW | `src/lib/rate-limit.ts:29` | Add startup validation to reject these in production |

---

## Plan Feature Matrix

| Feature | Guest (Anonymous) | Registered (Free) | Premium (EUR 9.99/mo) |
|---------|-------------------|--------------------|-----------------------|
| Chat conversations/day | 5 | 30 | 100 |
| Chat messages/day | 20 | 200 | Unlimited (-1) |
| Chat tokens/day | 50,000 | 500,000 | 2,000,000 |
| AI output tokens/response | 2,048 | 4,096 | 8,192 |
| Tool steps per response | 3 | 3 | 5 |
| Design generations/month | 0 (blocked) | 5 | 50 |
| AI design generations/month | 0 (blocked) | 5 | 50 |
| Design refinements/month | 0 (blocked) | 10 | 100 |
| Product mockups/day (anon) or /month | 3/day | 10/month | 100/month |
| Design saves/day | 0 (blocked) | 20 | Unlimited (-1) |
| Design uploads/day | 0 (blocked) | 5 | 20 |
| Credit overflow | N/A | N/A | Yes (buy packs) |
| Bonus credits/month | N/A | N/A | 10 |
| Cost budget (USD/month) | N/A | $2.50 | $25.00 |
| Per-generation cost cap | N/A | $0.05 | $0.15 |
| Wishlist | Browse only | Yes | Yes |
| Order tracking | No | Yes | Yes |
| Priority support | No | No | Yes |

## Credit Pack Pricing

| Pack | Credits | Price | Per Credit |
|------|---------|-------|------------|
| Small | 15 | EUR 4.99 | EUR 0.33 |
| Medium | 50 | EUR 14.99 | EUR 0.30 |
| Large | 150 | EUR 39.99 | EUR 0.27 |

Credits are premium-only overflow -- when monthly limits are exhausted, premium users can spend credits to continue generating designs.

---

## Limit Enforcement Audit

| Limit | Server-Side | Bypassable | Atomic | Notes |
|-------|-------------|------------|--------|-------|
| Guest chat (5/day) | YES | Partial (IP rotation/fingerprint clearing) | YES (Supabase RPC) | Inherent limitation of anonymous tracking |
| Free chat (30/day) | YES | NO (tied to auth UUID) | YES | Cannot bypass without another account |
| Premium chat (100/day) | YES | NO | YES | Credit overflow available |
| Guest design | YES | N/A (blocked at 0) | N/A | Auth required |
| Free design (5/mo) | YES | NO | YES | Auth required |
| Premium design (50/mo) | YES | NO | YES | Credit overflow + cost guard |
| Mockup (guest 3/day) | YES | Partial (IP rotation) | YES | Anonymous allowed |
| Token budget | YES | NO | YES (increment_by RPC) | Post-stream tracking |
| Burst rate limit | Partial (in-memory, per-instance) | YES (instance rotation) | NO | Supplementary to Supabase limits |
| Concurrent streams | Partial (in-memory) | YES (instance rotation) | NO | Max 2 per identifier |
| Velocity (anti-bot) | Partial (in-memory) | YES (instance rotation) | NO | 5+ msgs in <3s = 30min block |

---

## Stripe Integration Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Webhook signature verified | OK | `constructEvent()` with `STRIPE_WEBHOOK_SECRET` at `webhooks/stripe/route.ts:41` |
| Idempotent order processing | OK | UNIQUE on `stripe_session_id` at `webhooks/stripe/route.ts:152-160` |
| Idempotent credit processing | OK | UNIQUE on `(user_id, stripe_payment_id)` at migration `20260222200002` |
| Atomic credit balance updates | OK | `add_credits` RPC at migration `20260222200002` |
| Subscription status sync | OK | `handleSubscriptionUpdate` at `webhooks/stripe/route.ts:535-616` |
| Subscription cancellation | OK | Sets `tier: 'free'` at `webhooks/stripe/route.ts:621-643` |
| Payment failure handling | OK | Sets `past_due`, emails user at `webhooks/stripe/route.ts:726-790` |
| Chargeback handling | OK | Cancels order, alerts admins at `webhooks/stripe/route.ts:883-1002` |
| Rate limit on subscription creation | OK | 3/hour per user at `subscription/create/route.ts:26-32` |
| `STRIPE_PREMIUM_PRICE_ID` in env | FAIL | Missing from `.env.example` -- runtime crash risk |
| Locale-aware redirects | FAIL | Hardcoded `/en/pricing` in success/cancel URLs |
| Billing portal return URL | WARN | Hardcoded `/en/settings/billing` |
| Free trial support | MISSING | No `trial_period_days` configured |

---

## Scorecard

| Category | Score /10 | Notes |
|----------|-----------|-------|
| Plan Design | 8 | Well-structured 3 tiers, comprehensive action tracking, credit overflow system, clear feature matrix. Minor: price not centralized. |
| Limit Enforcement | 9 | Server-side atomic RPCs, fail-closed, multiple layers (burst + daily + token + cost guard + anomaly + velocity). Failed designs not rolled back (-1). |
| Stripe Integration | 7 | Solid webhook handling, idempotency, lifecycle management. Critical: missing `STRIPE_PREMIUM_PRICE_ID` env var, hardcoded locale in redirects. |
| Upsell Flow | 7 | Good modal system (AuthWall, Upgrade, SignupBanner, WelcomePopup), usage meters. Missing: AI chatbot doesn't mention plans, no limit-hit drip emails, no free trial. |
| Security | 8 | RLS on usage table, atomic RPCs, SECURITY DEFINER functions, tier check on credit consumption. Minor: no session limiting for premium sharing, in-memory limiters per-instance only. |
| **Overall** | **7.5** | |

---

## Priority Action Items

1. **[P0] PLM-03**: Add `STRIPE_PREMIUM_PRICE_ID` to `.env.example` as `[REQUIRED]` and add startup validation -- without this, subscription creation crashes at runtime.

2. **[P0] PLM-43/44**: Fix hardcoded `/en/` locale in Stripe success/cancel URLs for subscription creation and credit purchase. Pass locale from request body or cookie:
   - `src/app/api/subscription/create/route.ts:74-75`
   - `src/app/api/credits/purchase/route.ts:99-100`

3. **[P1] PLM-07**: Remove duplicated `TIER_LIMITS` in `src/app/api/subscription/usage/route.ts:19-30`. Import limits from canonical `USAGE_TIERS` in `usage-limiter.ts` to prevent drift.

4. **[P1] PLM-22**: Call `decrementUsage()` on failed design generations to avoid charging users for failures. The function already exists at `usage-limiter.ts:335-353`.

5. **[P1] PLM-55**: Add premium plan mention to the chat AI system prompt so the chatbot can naturally suggest upgrading when users ask about limits or features.

6. **[P2] PLM-45**: Fix billing portal return URL to use user's locale instead of hardcoded `/en/`.

7. **[P2] PLM-63**: Add a `limit_hit` drip email sequence triggered when free users exhaust their daily/monthly limits, to drive conversion.

8. **[P2] PLM-69**: Consider implementing concurrent session alerts or limits for premium accounts to reduce account sharing.

9. **[P3] PLM-60/61**: Consider adding a 7-day free trial period and/or introductory pricing to reduce friction for premium conversion.

10. **[P3] PLM-29/73**: Add production startup check that rejects `PLAYWRIGHT_TEST_BASE_URL` and `CI` env vars to prevent accidental rate limit bypass in production.
