# Engagement & Retention Audit — SKAPARA POD AI Store

**Date**: 2026-03-07
**Auditor**: Engagement & Retention Specialist
**Scope**: All customer-facing engagement, communication, personalization, and loyalty features

---

## Engagement Feature Matrix

| # | Feature | Exists | Working | Quality (1-5) | CLV Impact |
|---|---------|--------|---------|---------------|------------|
| **ACCOUNT VALUE** | | | | | |
| 1 | User registration (email + password) | Yes | Yes | 4 | High |
| 2 | Social login (Google OAuth) | Yes | Yes | 3 | High |
| 3 | Welcome popup for guests (WelcomePopup) | Yes | Yes | 4 | Medium |
| 4 | Signup banner in chat (SignupBanner) | Yes | Yes | 4 | Medium |
| 5 | Auth wall modal (AuthWallModal) | Yes | Yes | 4 | Medium |
| 6 | Upgrade modal for free users (UpgradeModal) | Yes | Yes | 3 | High |
| 7 | Profile editing (name, avatar) | Yes | Yes | 3 | Low |
| 8 | Saved shipping addresses | Yes | Yes | 4 | Medium |
| 9 | Saved payment methods | Yes | Yes | 3 | Medium |
| 10 | Change password | Yes | Yes | 4 | Low |
| 11 | Account deletion (GDPR) | Yes | Yes | 4 | Low |
| 12 | Welcome discount for first-time buyers | **No** | -- | -- | **Critical** |
| **WISHLIST** | | | | | |
| 13 | Add to wishlist (auth + guest localStorage) | Yes | Yes | 4 | High |
| 14 | Multiple named wishlists (auth) | Yes | Yes | 4 | Medium |
| 15 | Share wishlist via token URL | Yes | Yes | 4 | Medium |
| 16 | Shared wishlist viewer page | Yes | Yes | 3 | Medium |
| 17 | Add all wishlist items to cart | Yes | Yes | 4 | High |
| 18 | Guest wishlist with signup nudge | Yes | Yes | 4 | Medium |
| 19 | Price drop notification on wishlist items | **No** | -- | -- | **High** |
| 20 | Back in stock notification | **No** | -- | -- | **Medium** |
| **ORDER HISTORY** | | | | | |
| 21 | Order list view | Yes | Yes | 4 | Medium |
| 22 | Order detail view | Yes | Yes | 4 | Medium |
| 23 | Reorder (copy order items to cart) | Yes | Yes | 4 | **High** |
| 24 | Order invoice download | Yes | Yes | 3 | Low |
| 25 | Return request via AI chat | Yes | Yes | 4 | Medium |
| **COMMUNICATION — EMAIL** | | | | | |
| 26 | Newsletter signup (landing page + footer) | Yes | Yes | 4 | High |
| 27 | Double opt-in confirmation (confirm/[token]) | Yes | Yes | 5 | Medium |
| 28 | Newsletter unsubscribe (RFC 8058 compliant) | Yes | Yes | 5 | Low |
| 29 | Newsletter campaigns (segmented) | Yes | Partial | 3 | High |
| 30 | Welcome email drip sequence (3 emails) | Yes | Yes | 3 | **High** |
| 31 | Abandoned cart recovery emails (2-stage) | Yes | Yes | 4 | **Critical** |
| 32 | Order confirmation email | Yes | Yes | 4 | Medium |
| 33 | Shipping confirmation email (with tracking) | Yes | Yes | 4 | Medium |
| 34 | Delivery confirmation email (with review CTA) | Yes | Yes | 4 | High |
| 35 | Order cancelled/refunded email | Yes | Yes | 4 | Medium |
| 36 | Order failed email | Yes | Yes | 4 | Medium |
| 37 | Payment failure email | Yes | Yes | 3 | Medium |
| 38 | Credit purchase confirmation email | Yes | Yes | 4 | Low |
| 39 | Locale-aware emails (EN/ES/DE) | Yes | Yes | 5 | Medium |
| 40 | Resend integration (transactional) | Yes | Yes | 4 | High |
| 41 | Win-back emails for inactive users | **No** | -- | -- | **High** |
| 42 | Post-purchase cross-sell email | **No** | -- | -- | **High** |
| 43 | Birthday/anniversary emails | **No** | -- | -- | **Medium** |
| **COMMUNICATION — PUSH** | | | | | |
| 44 | Web Push subscription API | Yes | Yes | 3 | Medium |
| 45 | Push send API (admin-triggered) | Yes | Yes | 3 | Medium |
| 46 | Push permission prompt dialog | Yes | Yes | 3 | Medium |
| 47 | PWA install prompt (InstallPrompt) | Yes | Yes | 4 | Medium |
| 48 | Automated push on order status change | **No** | -- | -- | **Medium** |
| 49 | Push on wishlist price drop | **No** | -- | -- | **High** |
| **COMMUNICATION — IN-APP** | | | | | |
| 50 | In-app notifications system (CRUD + pagination) | Yes | Yes | 4 | Medium |
| 51 | Unread notification count badge | Yes | Yes | 4 | Medium |
| 52 | Mark all as read | Yes | Yes | 4 | Low |
| **PERSONALIZATION** | | | | | |
| 53 | AI chat assistant (Claude via AI SDK 6) | Yes | Yes | 5 | **Critical** |
| 54 | AI product search and recommendations | Yes | Yes | 5 | **Critical** |
| 55 | AI handles order issues + returns | Yes | Yes | 4 | High |
| 56 | AI design generation from chat | Yes | Yes | 5 | **Critical** |
| 57 | Voice input for chat (Web Speech API) | Yes | Yes | 3 | Low |
| 58 | Image upload in chat (drag & drop) | Yes | Yes | 4 | Medium |
| 59 | Suggested prompts on welcome screen | Yes | Yes | 4 | Medium |
| 60 | Personalized welcome (name, orders, favorites) | Yes | Yes | 5 | High |
| 61 | Chat session persistence (sessionStorage) | Yes | Yes | 4 | Medium |
| 62 | Conversation history saved (server-side) | Yes | Yes | 4 | Medium |
| 63 | Usage limiter (anon/free/premium tiers) | Yes | Yes | 4 | High |
| 64 | Recently viewed products (localStorage) | Yes | Yes | 3 | Medium |
| 65 | Cross-sell recommendations (association rules) | Yes | Yes | 4 | **High** |
| 66 | Cross-sell fallback (same category) | Yes | Yes | 3 | Medium |
| 67 | Trending products (7-day weighted score) | Yes | Yes | 4 | Medium |
| 68 | Social proof indicator (views + orders) | Yes | Yes | 3 | Medium |
| 69 | Geo-based language personalization (i18n) | Yes | Yes | 5 | High |
| 70 | RAG-powered product knowledge (pgvector) | Yes | Yes | 4 | High |
| 71 | "Based on your purchases" recommendations | **No** | -- | -- | **High** |
| 72 | Personalized landing page for returning users | **No** | -- | -- | **High** |
| **LOYALTY & REPEAT PURCHASE** | | | | | |
| 73 | Referral program (3 credits each) | Yes | Yes | 3 | High |
| 74 | Design credits system (buy + earn) | Yes | Yes | 4 | High |
| 75 | Subscription tiers (free/premium) | Yes | Yes | 4 | **Critical** |
| 76 | Coupon/promo code validation | Yes | Yes | 3 | Medium |
| 77 | A/B testing framework (experiments API) | Yes | Partial | 2 | Medium |
| 78 | Points/rewards program | **No** | -- | -- | **High** |
| 79 | VIP tier system | **No** | -- | -- | **High** |
| 80 | Birthday/anniversary rewards | **No** | -- | -- | **Medium** |
| 81 | Limited edition drops / urgency features | **No** | -- | -- | **Medium** |
| **COMMUNITY & SOCIAL** | | | | | |
| 82 | Product reviews (text + photos) | Yes | Yes | 4 | High |
| 83 | Review photo uploads | Yes | Yes | 3 | Medium |
| 84 | Review prompts in delivery email | Yes | Yes | 4 | High |
| 85 | User-generated content gallery | **No** | -- | -- | **Medium** |
| 86 | Social media sharing from product pages | **No** | -- | -- | **Medium** |

---

## Summary Scores

| Category | Features Audited | Exists | Working | Avg Quality | Coverage |
|----------|-----------------|--------|---------|-------------|----------|
| Account Value | 12 | 11 | 11 | 3.7 | 92% |
| Wishlist | 8 | 6 | 6 | 3.8 | 75% |
| Order History | 5 | 5 | 5 | 3.8 | 100% |
| Email Communication | 18 | 15 | 14 | 4.0 | 83% |
| Push Notifications | 6 | 4 | 4 | 3.3 | 67% |
| In-App Notifications | 3 | 3 | 3 | 4.0 | 100% |
| Personalization | 20 | 18 | 18 | 4.1 | 90% |
| Loyalty & Repeat | 9 | 5 | 4 | 3.2 | 56% |
| Community & Social | 5 | 3 | 3 | 3.7 | 60% |
| **TOTAL** | **86** | **70** | **68** | **3.7** | **81%** |

---

## Critical Gaps

These missing features directly and measurably impact repeat purchase rate and customer lifetime value:

### 1. No Welcome Discount / First-Order Incentive
- **Impact**: Industry standard is 10-15% first-order discount. Conversion lift of 15-25% on first purchase.
- **Current state**: WelcomePopup exists but only promotes account creation, no discount code.
- **Revenue at risk**: Every new visitor who leaves without purchasing is harder to recapture without this hook.

### 2. No Loyalty Points / Rewards Program
- **Impact**: Loyalty programs increase purchase frequency by 20-30% and average order value by 10-15%.
- **Current state**: Credits exist for design generation (AI feature), but no purchase-based rewards. Referral gives credits, not purchase incentives.
- **Architecture gap**: The `credit_transactions` table exists and could be extended, but there is no points-per-euro-spent logic.

### 3. No Win-Back Email Campaign
- **Impact**: Win-back emails recover 5-12% of lapsed customers. Without them, churned users are permanently lost.
- **Current state**: Drip sequence handles onboarding (welcome, tips, upgrade). Abandoned cart recovery exists. But no campaign targets users who purchased once and went inactive (30/60/90 day windows).

### 4. No Post-Purchase Cross-Sell Email
- **Impact**: Post-purchase emails have 4x higher open rates than promotional emails. "Complete the look" or "matching items" emails drive 10-15% of repeat revenue for apparel brands.
- **Current state**: Delivery email has a review CTA but no product recommendations. Cross-sell exists in-app (CartCrossSell) but not in email.

### 5. No Personalized Recommendations Based on Purchase History
- **Impact**: "Based on your purchases" drives 15-30% of revenue on mature e-commerce platforms.
- **Current state**: Cross-sell uses `association_rules` table (co-purchase patterns), trending uses `product_daily_metrics`, and RAG uses pgvector. But no dedicated "for you" section exists that combines purchase history + browsing behavior for returning users.

### 6. No Price Drop / Back-in-Stock Notifications
- **Impact**: Price drop alerts convert at 10-15% (vs 2-3% for general emails). Back-in-stock alerts convert at 15-20%.
- **Current state**: Push subscription API exists. PushPermissionPrompt mentions "Price drops on wishlist items" as a benefit, but the actual trigger logic is not implemented.

---

## Quick Wins

Features that can be implemented in 1-3 days with high retention impact, using existing infrastructure:

### 1. Welcome Discount Code (1 day)
- **Implementation**: Add a `WELCOME10` coupon in Stripe/Supabase. Show it in WelcomePopup and welcome drip email. Use existing `coupons/validate` API.
- **Files to modify**: `WelcomePopup.tsx`, `email-drip.ts` (welcome template), create coupon in DB.
- **Expected lift**: +15-20% first-purchase conversion.

### 2. Post-Purchase Cross-Sell in Delivery Email (2 days)
- **Implementation**: In `sendOrderDeliveredEmail()`, query cross-sell API for the ordered products, include 2-3 product cards in the email HTML.
- **Files to modify**: `frontend/src/lib/resend.ts` (sendOrderDeliveredEmail function).
- **Expected lift**: +5-10% repeat purchase within 30 days.

### 3. Wishlist Price Drop Push Notification (2 days)
- **Implementation**: Cron job that checks wishlist items against current prices. If price decreased, send push via existing `sendPushToUser()`. The push infrastructure and wishlist DB are already in place.
- **Files to create**: `frontend/src/app/api/cron/wishlist-price-alerts/route.ts`.
- **Expected lift**: +3-5% wishlist-to-purchase conversion.

### 4. Win-Back Email Sequence (2 days)
- **Implementation**: Add a `winback` sequence to `DRIP_SEQUENCES` in `email-drip.ts`. Cron job identifies users with last_order > 30 days and no recent activity. Trigger via a new cron endpoint.
- **Files to modify**: `frontend/src/lib/email-drip.ts`, create `frontend/src/app/api/cron/winback/route.ts`.
- **Expected lift**: +5-12% reactivation of lapsed customers.

### 5. "For You" Section on Shop Page (3 days)
- **Implementation**: Combine recently viewed (already tracked via `useRecentlyViewed`), wishlist items, and purchase history to show a personalized "Recommended for You" row on the shop page.
- **Files to modify**: Shop page, create a `usePersonalizedRecommendations` hook.
- **Expected lift**: +8-12% click-through on product discovery.

### 6. Social Share Buttons on Product Pages (1 day)
- **Implementation**: Add share buttons (copy link, WhatsApp, Twitter/X) on product detail pages. WhatsApp webhook integration already exists.
- **Files to modify**: `ProductDetailClient.tsx`.
- **Expected lift**: +2-5% organic traffic via word-of-mouth.

---

## Recommendations — Prioritized by CLV Impact

### P0 — Critical (implement within 2 weeks)

| # | Recommendation | Effort | CLV Impact | Dependencies |
|---|---------------|--------|-----------|--------------|
| 1 | **Welcome discount (WELCOME10)** | 1 day | +15-20% first purchase conv. | Coupon system (exists) |
| 2 | **Win-back email campaign** (30/60/90 day) | 2 days | +5-12% reactivation | Drip system (exists), Resend (exists) |
| 3 | **Post-purchase cross-sell email** | 2 days | +5-10% repeat in 30 days | Cross-sell API (exists), Resend (exists) |
| 4 | **Wishlist price drop alerts** (push + email) | 2 days | +3-5% wishlist conversion | Push API (exists), Wishlist DB (exists) |

### P1 — High Priority (implement within 1 month)

| # | Recommendation | Effort | CLV Impact | Dependencies |
|---|---------------|--------|-----------|--------------|
| 5 | **Personalized "For You" recommendations** | 3 days | +8-12% product discovery | Recently viewed (exists), pgvector (exists) |
| 6 | **Loyalty points program** (earn per EUR spent) | 5 days | +20-30% purchase frequency | Extend credit_transactions table |
| 7 | **Automated push on order status** | 2 days | Retention signal | Push API (exists), webhook (exists) |
| 8 | **Social share buttons on products** | 1 day | +2-5% organic traffic | None |

### P2 — Medium Priority (implement within 2 months)

| # | Recommendation | Effort | CLV Impact | Dependencies |
|---|---------------|--------|-----------|--------------|
| 9 | **VIP tier system** (Bronze/Silver/Gold) | 5 days | +15-25% top-customer retention | Loyalty points (P1 #6) |
| 10 | **Birthday rewards** (collect DOB at registration) | 3 days | +5-8% seasonal purchase | Profile form update, cron job |
| 11 | **UGC gallery** (customer photos on product pages) | 4 days | +10-15% conversion on pages with UGC | Review photos (exists) |
| 12 | **Back-in-stock alerts** | 2 days | +15-20% conversion on alerts | N/A for POD (always in stock), but useful if products are retired |
| 13 | **Limited edition drops / countdown timers** | 3 days | Creates urgency and return visits | Product metadata extension |

### P3 — Nice to Have (backlog)

| # | Recommendation | Effort | CLV Impact | Dependencies |
|---|---------------|--------|-----------|--------------|
| 14 | **Personalized landing page for returning users** | 5 days | +5-10% return visit engagement | Personalization engine (P1 #5) |
| 15 | **Seasonal/holiday marketing automation** | 3 days | +3-5% seasonal spikes | Campaign system (exists) |
| 16 | **Referral program UI improvement** (shareable link, dashboard) | 3 days | +10-15% referral adoption | Referral API (exists) |

---

## Architecture Strengths

The store has a remarkably complete engagement foundation for its stage:

1. **AI Chat is the crown jewel** — Claude-powered assistant with product search, recommendations, order management, design generation, checkout flow, and return requests. This is a genuine differentiator and the primary engagement driver. Quality 5/5.

2. **Email infrastructure is mature** — Resend integration with locale-aware templates (EN/ES/DE), double opt-in newsletter, drip sequences, abandoned cart recovery (2-stage), and full transactional email coverage (confirm, ship, deliver, cancel, fail). Very complete for a store at this stage.

3. **Wishlist system is above average** — Guest localStorage + authenticated server wishlists, multiple named lists, sharing via token URL, bulk add-to-cart. The guest-to-auth upgrade path with the signup nudge banner is well designed.

4. **Engagement funnel is well-gated** — Anonymous usage limits -> SignupBanner -> AuthWallModal -> UpgradeModal. This progressive engagement funnel naturally drives account creation and premium upgrades.

5. **Cross-sell uses real data** — `association_rules` table for co-purchase patterns, `trending_products` materialized view with weighted scoring, `product_daily_metrics` for social proof. This is data-driven, not random.

---

## Architecture Weaknesses

1. **No purchase-based rewards** — The credits system only applies to AI design generation. There is no "earn points per EUR spent" mechanism to incentivize repeat physical product purchases.

2. **Push notifications are admin-only** — The `sendPushToUser` function exists but no automated triggers fire on order status changes, wishlist price drops, or other user-relevant events. Push is infrastructure without automation.

3. **A/B testing is skeletal** — Experiment CRUD API exists but there is no evidence of active experiments, no client-side assignment logic, and no conversion tracking tied to experiments.

4. **Newsletter campaigns lack automation** — The campaigns table and API exist, but there is no automated campaign generation (e.g., weekly new products, trending items, personalized picks). Campaigns appear to require manual creation.

5. **Referral program has no UI** — The `/api/referral` route works, but there is no visible UI for users to find their referral code, share it, or see referral status. The feature is effectively hidden.

---

## Key Files Referenced

| Area | Path |
|------|------|
| Wishlist page | `frontend/src/app/[locale]/(app)/wishlist/page.tsx` |
| Wishlist API | `frontend/src/app/api/wishlist/route.ts` |
| Shared wishlist | `frontend/src/app/[locale]/(app)/wishlist/shared/[token]/page.tsx` |
| Profile page | `frontend/src/app/[locale]/(app)/profile/page.tsx` |
| Orders page | `frontend/src/app/[locale]/(app)/orders/page.tsx` |
| Order detail | `frontend/src/app/[locale]/(app)/orders/[id]/page.tsx` |
| AI Chat | `frontend/src/components/storefront/ChatArea.tsx` |
| Engagement hooks | `frontend/src/hooks/useEngagement.ts` |
| Recently viewed | `frontend/src/hooks/useRecentlyViewed.ts` |
| Cross-sell API | `frontend/src/app/api/products/[id]/cross-sell/route.ts` |
| Cross-sell component | `frontend/src/components/cart/CartCrossSell.tsx` |
| Trending API | `frontend/src/app/api/products/trending/route.ts` |
| Social proof API | `frontend/src/app/api/products/[id]/social-proof/route.ts` |
| Email drip system | `frontend/src/lib/email-drip.ts` |
| Drip cron | `frontend/src/app/api/cron/drip/route.ts` |
| Abandoned cart cron | `frontend/src/app/api/cron/abandoned-cart-recovery/route.ts` |
| Transactional emails | `frontend/src/lib/resend.ts` |
| Push subscribe | `frontend/src/app/api/push/subscribe/route.ts` |
| Push send | `frontend/src/app/api/push/send/route.ts` |
| Notifications API | `frontend/src/app/api/notifications/route.ts` |
| Referral API | `frontend/src/app/api/referral/route.ts` |
| Reorder API | `frontend/src/app/api/orders/[id]/reorder/route.ts` |
| Newsletter signup | `frontend/src/components/landing/NewsletterSignup.tsx` |
| Newsletter confirm | `frontend/src/app/api/newsletter/confirm/[token]/route.ts` |
| Newsletter campaigns | `frontend/src/app/api/newsletter/campaigns/route.ts` |
| Reviews API | `frontend/src/app/api/reviews/route.ts` |
| WelcomePopup | `frontend/src/components/engagement/WelcomePopup.tsx` |
| SignupBanner | `frontend/src/components/engagement/SignupBanner.tsx` |
| AuthWallModal | `frontend/src/components/engagement/AuthWallModal.tsx` |
| UpgradeModal | `frontend/src/components/engagement/UpgradeModal.tsx` |
| PushPermissionPrompt | `frontend/src/components/engagement/PushPermissionPrompt.tsx` |
| InstallPrompt (PWA) | `frontend/src/components/engagement/InstallPrompt.tsx` |
| UsageMeter | `frontend/src/components/engagement/UsageMeter.tsx` |
| Stripe webhook | `frontend/src/app/api/webhooks/stripe/route.ts` |
