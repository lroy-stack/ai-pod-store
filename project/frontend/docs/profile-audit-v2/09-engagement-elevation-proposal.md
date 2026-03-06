# Engagement Elevation Proposal — Consolidated Cross-Reference

**Date**: 2026-03-04
**Sources**: 8 audit documents (DB schema, Backend API, Frontend UX, Lifecycle, Security gaps, Best practices research, MCP server audit, Current engagement audit)
**Objective**: Prioritized implementation roadmap to elevate user engagement, security, and AI-assisted shopping experience

---

## Executive Summary

The platform has **25 fully implemented** engagement features (auth gating, personalization, transactional emails, PWA, social proof, coupons, referrals, abandoned cart recovery) but **17 critical gaps** in retention, loyalty, and AI commerce. Security blockers (4 P0) must be resolved before any engagement work.

The MCP server (17 tools, OAuth 2.1) has strong architecture but **5 critical security issues** and no guest cart support — breaking the conversational commerce flow.

**Key insight**: Many gaps have existing infrastructure (data tracked but not rendered, hooks without UI, APIs without frontends). The highest ROI is wiring up what already exists.

---

## Priority Matrix: Security First, Then Engagement

### Tier 0: Security Blockers (MUST before anything else)

| ID | Issue | Source | File | Effort |
|---|---|---|---|---|
| S0-1 | Returns API zero auth | P0-1 | `api/orders/[id]/returns/route.ts` | 30 min |
| S0-2 | Cart PATCH no ownership check | P0-2 | `api/cart/route.ts:442-583` | 30 min |
| S0-3 | Checkout cancel page 404 | P0-3 | Missing `checkout/cancel/page.tsx` | 30 min |
| S0-4 | tenant_configs/admin_settings no RLS | P0-4 | Supabase migration | 30 min |
| S0-5 | MCP OAuth form uses GET (creds in URL) | Doc 07 | `mcp-server/src/auth/oauth-provider.ts:270` | 15 min |
| S0-6 | MCP completions leak cross-user data | Doc 07 | `mcp-server/src/lib/completions.ts` | 30 min |
| S0-7 | Guest order accessible to any auth user | P2-1 | `api/orders/[id]/route.ts:46-51` | 15 min |
| S0-8 | MCP no request body size limit | Doc 07 | `mcp-server/src/index.ts parseBody()` | 15 min |

**Total: ~3.5 hours. Non-negotiable before production.**

---

### Tier 1: Quick Wins — Wire Up What Already Exists

These features have data/hooks already built. Only UI or minimal wiring needed.

| ID | Feature | What Exists | What's Missing | Impact | Effort |
|---|---|---|---|---|---|
| Q1 | Recently Viewed section | `useRecentlyViewed` hook tracks 8 products | No rendering component on shop/product pages | Medium | 2h |
| Q2 | App update prompt | SW detects updates, logs to console | No user-facing toast/banner | Low | 1h |
| Q3 | Push notification triggers | Full web-push pipeline + VAPID + SW handlers | No automated triggers (back-in-stock, price drop) | High | 4h |
| Q4 | Review incentives | Review system complete with moderation | No credit reward for submitting reviews | High | 2h |
| Q5 | Social sharing buttons | Product detail page exists | No share on social media buttons | Medium | 2h |
| Q6 | Guest-to-auth cart merge | Cart API + useCart hook | No merge logic on login | High | 4h |
| Q7 | MCP tools: use shared Supabase singleton | Singleton exists in `src/lib/supabase.ts` | 11 tools create own clients | Medium | 2h |

---

### Tier 2: High-Impact Engagement Features (New Build)

Based on best practices research (doc 06) cross-referenced against current state (doc 08):

| ID | Feature | Best Practice Evidence | Current State | Expected Impact | Effort |
|---|---|---|---|---|---|
| E1 | Loyalty points system | +22% retention (IntexSoft), 3x revenue from loyalty members (Mokobara) | Credits exist but no purchase-based points | **High** | L |
| E2 | RFM segmentation | 87% retention with lifecycle marketing (Retainful) | No segmentation, all users treated equally | **High** | M |
| E3 | Post-purchase email sequence (7-email) | 49.75% open rate (Omnisend) | 6 transactional emails but no review request, cross-sell, loyalty check-in | **High** | M |
| E4 | Win-back campaign | Critical for dormant users (30-day+ inactive) | Missing entirely | **Medium** | M |
| E5 | Browse abandonment emails | "You viewed X but didn't buy" | Missing entirely | **Medium** | M |
| E6 | Exit intent on product/cart pages | 332% conversion boost with urgency (Shopify) | Only on checkout page | **Medium** | S |
| E7 | MCP guest cart + wishlist | Shopify MCP has session-based cart for unauthenticated | No guest support in MCP | **High** | M |
| E8 | Countdown timers / flash sales | 59% transaction rate increase (3hr optimal) | Missing entirely | **Medium** | M |

---

### Tier 3: Strategic Features (Medium-term)

| ID | Feature | Dependencies | Expected Impact | Effort |
|---|---|---|---|---|
| A1 | Loyalty tiers (4-tier: Explorer→Legend) | E1 (points system) | High | L |
| A2 | A/B testing framework (PostHog) | Analytics events | Medium | M |
| A3 | Personalized recommendations (ML) | RFM + browse history | High | L |
| A4 | MCP tools expansion (addresses, returns, recommendations) | E7, security fixes | High | L |
| A5 | Annual pricing option | Stripe subscription | Medium | S |
| A6 | Style/size preferences quiz | Profile schema extension | Medium | M |

---

## Cross-Reference Matrix: Best Practices vs Current State

| Best Practice (Doc 06) | Current State (Doc 08) | Gap | Priority |
|---|---|---|---|
| **Unified profile dashboard** | Orders, addresses, payments, wishlists exist but fragmented | No loyalty/points display, no design history in profile | Tier 2 |
| **Gamification (points, badges, streaks)** | Only design credits exist | No purchase points, no badges, no streaks | Tier 2 (E1) |
| **RFM segmentation (7 segments)** | No segmentation at all | All users treated identically | Tier 2 (E2) |
| **Post-purchase 8-email sequence** | 6 transactional emails only | Missing: review request, cross-sell, loyalty check-in, referral prompt | Tier 2 (E3) |
| **Abandoned cart 5-step recovery** | 2-email sequence (1h + 24h) | Missing: push notification, SMS, 3rd email with stronger offer | Tier 1 (Q3) |
| **Push notifications (segmented)** | Infrastructure complete | No automated triggers | Tier 1 (Q3) |
| **Review incentives** | Review system working | No reward for reviews | Tier 1 (Q4) |
| **Wishlist notifications (restock, price drop)** | Wishlist + compare_at_price exist | No event triggers | Tier 2 |
| **Social sharing** | Products have URLs | No share buttons | Tier 1 (Q5) |
| **Guest cart persistence on login** | Guest cart via session_id | No merge | Tier 1 (Q6) |
| **AI-assisted shopping (MCP)** | 17 tools, OAuth 2.1 | No guest support, security issues, missing tools | Tier 0 + Tier 2 |
| **Progressive profiling** | Newsletter + guest checkout exist | No gradual data collection strategy | Tier 3 |
| **Urgency/scarcity mechanics** | "Selling Fast" badge only | No countdown timers, stock alerts, cart reservation | Tier 2 (E8) |
| **Annual pricing** | Monthly subscription only | No annual discount | Tier 3 (A5) |

---

## MCP Server — Specific Elevation Plan

### Security Fixes (Immediate)

1. **Change OAuth form to POST** — `oauth-provider.ts:270` change `method="GET"` to `method="POST"`
2. **Filter completions by user** — `completions.ts` add user_id parameter to order/product completions
3. **Add request body size limit** — `parseBody()` add 1MB cap
4. **Refactor to shared Supabase singleton** — 11 tools → use `getSupabaseClient()`

### Guest Experience (Tier 2)

5. **Session-based guest cart** — `update_cart` and `get_cart` accept `session_id` for unauthenticated users
6. **Session-based guest wishlist** — Same pattern
7. **Graceful auth prompts** — Return `{ authentication_required: true, login_url: '...' }` instead of generic error

### Missing Tools (Tier 3)

8. `get_trending_products` — Already exists as API, wire to MCP
9. `apply_coupon` — Cart-level coupon validation
10. `estimate_shipping` — Shipping cost/time estimate
11. `submit_review` — Post-purchase review via AI
12. `get_loyalty_status` — Points, tier, progress (after E1)
13. `request_return` — Return initiation via AI
14. `get_size_guide` — Product-specific size recommendations

### Scope Enforcement (Tier 3)

15. Implement `read` vs `write` vs `restricted` scope tiers
16. Require confirmation for write operations
17. Redirect to secure checkout page for purchase operations

---

## Implementation Sprints

### Sprint 1: Security + Quick Wins (Week 1-2)
- All S0 items (security blockers)
- Q1 (Recently Viewed UI), Q2 (App update toast), Q4 (Review incentives), Q5 (Social sharing)
- P1-4 (order_items.order_id index)

### Sprint 2: Cart + MCP Foundation (Week 3-4)
- Q6 (Guest-to-auth cart merge)
- Q7 (MCP Supabase singleton refactor)
- E6 (Exit intent on product/cart pages)
- E7 (MCP guest cart + wishlist)

### Sprint 3: Loyalty + Engagement (Week 5-8)
- E1 (Loyalty points system)
- E2 (RFM segmentation)
- E3 (Post-purchase 7-email sequence)
- Q3 (Push notification automated triggers)

### Sprint 4: Advanced Features (Week 9-12)
- E4 (Win-back campaigns)
- E5 (Browse abandonment emails)
- E8 (Countdown timers / flash sales)
- A1 (Loyalty tiers)
- A4 (MCP tools expansion)

---

## Expected Metrics (Based on Industry Benchmarks)

| Metric | Current | After Sprint 1-2 | After Sprint 3-4 | Source |
|---|---|---|---|---|
| Cart abandonment recovery | ~8% (2 emails) | ~15% (+push, +merge) | ~25% (+urgency, +offers) | Baymard, Dotdigital |
| Repeat purchase rate | ~15% est. | ~20% (+reviews, +social) | ~35% (+loyalty, +RFM) | Retainful, Mokobara |
| Average order value | Baseline | +5% (cross-sell, sharing) | +12% (tiers, recs) | Omnisend |
| Review submission rate | Low (no incentive) | +40% (credit incentive) | +60% (+ push reminder) | Gartner via MyCred |
| Push notification opt-in | Infrastructure only | 10% (auto triggers) | 20% (segmented) | Pushwoosh |

---

## Documents Reference

| # | Document | Lines | Focus |
|---|---|---|---|
| 01 | `01-database-schema-multitenancy.md` | 911 | 97 tables, RLS, multi-tenancy, indexes |
| 02 | `02-backend-api-purchase-flow.md` | ~600 | 36 API routes, auth, cart, orders, returns |
| 03 | `03-frontend-profile-purchase-ux.md` | ~500 | 42 components/hooks, props, state, API calls |
| 04 | `04-cart-to-delivery-lifecycle.md` | ~400 | 7-phase lifecycle, state machine, flow diagrams |
| 05 | `05-consolidated-gaps-priorities.md` | 253 | 4 P0, 7 P1, 8 P2, 10 P3 gaps with priority matrix |
| 06 | `06-engagement-best-practices.md` | 936 | Industry research, case studies, frameworks, 60+ sources |
| 07 | `07-mcp-server-audit.md` | 707 | 17 tools, OAuth 2.1, security, gaps, integration |
| 08 | `08-current-engagement-audit.md` | 870 | 80+ features mapped, 25 FULL, 17 MISSING |
| 09 | `09-engagement-elevation-proposal.md` | This doc | Consolidated cross-reference and implementation roadmap |
