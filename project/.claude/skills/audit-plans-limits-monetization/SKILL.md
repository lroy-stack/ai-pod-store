---
name: Audit Plans Limits Monetization
description: >
  Comprehensive audit of the SKAPARA subscription plans, usage limits, and monetization system.
  Use when asked to audit pricing, plans, usage limits, free tier, premium features, Stripe
  subscriptions, chat/design daily limits, upsell flows, or the €9.99/month plan. Covers
  server-side limit enforcement, bypass prevention, guest vs authenticated limits, and
  chatbot upsell behavior when limits are reached.
---

# Audit Plans, Limits & Monetization

Systematic audit of SKAPARA's monetization strategy — free tier limits, premium plan, Stripe integration,
and the upsell pipeline through the AI chat interface.

## Prerequisites

- Read `CLAUDE.md` for Stripe and Supabase client patterns
- Read `frontend/src/app/api/ai/chat/route.ts` for chat endpoint and limit enforcement
- Read `frontend/src/lib/stripe/` for Stripe integration
- Read the Supabase schema for usage tracking tables (`user_usage`, `subscriptions`, etc.)
- Search for "limit", "usage", "plan", "subscription", "premium" across the codebase

## Workflow

### Phase 1: Plan Definition & Pricing

1. **Plan structure**:
   - Search for plan/pricing definitions (pricing page, config file, DB table)
   - Identify all tiers: free (guest), free (registered), premium (€9.99/month)
   - What features does each tier include? Document the feature matrix
   - Check: is the €9.99 price defined in one place or scattered?
   - Check: is pricing localized for different currencies/regions?

2. **Pricing page**:
   - Find the pricing/plans page (search `src/app/[locale]` for pricing, plans, subscription)
   - Is it well-designed? Clear value proposition?
   - Does it show feature comparison between tiers?
   - CTA buttons: what do they link to? (Stripe checkout? registration?)
   - Mobile layout: does the pricing page work on 375px?
   - i18n: is pricing text translated in all locales?

3. **Plan configuration**:
   - Where are plan limits defined? (env vars? config file? DB? hardcoded?)
   - Are limits centralized or duplicated across multiple files?
   - Check for magic numbers (hardcoded `5`, `10`, etc. without named constants)

### Phase 2: Usage Tracking

4. **Usage storage**:
   - Find the usage tracking mechanism (search for `user_usage`, `usage`, `daily_count`)
   - How is usage stored? (Supabase table? Redis? in-memory? cookies?)
   - Schema: what fields exist? (user_id, date, chat_count, design_count, etc.)
   - Is usage tracked per day? per month? rolling window?
   - How is the "day" boundary defined? (UTC midnight? user timezone?)

5. **Guest usage tracking**:
   - How are unregistered users identified? (IP? fingerprint? cookie? localStorage?)
   - Can guests clear cookies/storage to reset their limit? → BYPASS VULNERABILITY
   - Are guest limits enforced server-side or only client-side?
   - Check: what prevents a guest from making unlimited API calls directly?

6. **Authenticated usage tracking**:
   - Is usage tied to `auth.uid()`?
   - Is the usage counter incremented atomically? (race condition check)
   - Can a user with multiple sessions/devices bypass limits?
   - Is there a usage reset mechanism (daily cron? on-read check?)

### Phase 3: Limit Enforcement

7. **Chat limits**:
   - Read the chat API route — where is the limit check?
   - Is the limit check BEFORE the AI call? (don't waste API credits)
   - Guest limit: 5 chats/day — is this enforced?
   - Registered free limit: X chats/day — what's the number? is it enforced?
   - Premium: unlimited or higher limit? — verify
   - Check: is the limit check in middleware, route handler, or utility function?
   - Check: can the limit be bypassed by calling the API directly (curl)?

8. **Design generation limits**:
   - How many designs per day for each tier?
   - Is the limit checked before calling the image generation API?
   - Are failed generations counted against the limit?
   - What happens when a design partially generates then fails?

9. **Limit response behavior**:
   - When a user hits the limit, what HTTP status is returned? (429? 403? custom?)
   - What message does the user see?
   - Does the AI chatbot itself know about limits and respond appropriately?
   - Does the chatbot mention the premium plan when limits are reached?
   - Is there a countdown/remaining-uses indicator in the UI?

### Phase 4: Stripe Integration

10. **Subscription creation**:
    - How does a user subscribe? (Stripe Checkout? embedded form? in-app?)
    - Read the subscription creation endpoint
    - Is the Stripe Price ID correct for €9.99/month?
    - What happens after successful payment? (webhook? redirect? session update?)
    - Check: is the user's plan status updated in Supabase after payment?

11. **Subscription lifecycle**:
    - Can users cancel? How? (in-app? Stripe portal? email?)
    - What happens on cancellation? (immediate? end of period?)
    - Is there a grace period?
    - How are failed payments handled? (dunning? status downgrade?)
    - Renewal: automatic? notification before renewal?

12. **Stripe webhooks**:
    - Read webhook handler (search for `stripe-webhook`, `webhook`)
    - Which events are handled? (checkout.session.completed, invoice.paid, subscription.deleted, etc.)
    - Is webhook signature verified? (CRITICAL for security)
    - Is webhook processing idempotent? (replay protection)
    - What happens if the webhook fails? (retry? dead letter?)

13. **Subscription status checks**:
    - How does the app check if a user is premium?
    - Is it checked on every request or cached? (stale status risk)
    - What field in the DB indicates premium status?
    - Can a user fake premium status? (client-side check only → CRITICAL)

### Phase 5: Upsell & Engagement

14. **Upsell triggers**:
    - When does the app suggest upgrading? (limit hit? feature gate? proactive?)
    - Is the upsell message in the chat natural and non-intrusive?
    - Does the chatbot know about the plan details (price, features)?
    - Is there an in-chat upgrade button/link?
    - Does the upsell adapt to locale (€ vs $ vs language)?

15. **Feature gating**:
    - Which features are premium-only? List them all
    - How are premium features gated in the UI? (hidden? disabled? teaser?)
    - Is gating consistent between frontend and backend?
    - Check: can premium features be accessed via API without subscription?

16. **Conversion optimization**:
    - Is there a free trial? (X days free, then charge)
    - First-purchase discount or introductory price?
    - Social proof on pricing page (X users subscribed, testimonials)
    - Urgency/scarcity tactics (limited time offer?)
    - Email drip after hitting limits

### Phase 6: Security & Integrity

17. **Limit bypass prevention**:
    - Can limits be bypassed by:
      - Clearing cookies/localStorage (guests)?
      - Using incognito mode?
      - Calling API directly without UI?
      - Manipulating request headers (spoofed user ID)?
      - Using multiple accounts?
    - Are ALL limit checks server-side?
    - Is the usage counter in a protected DB table with RLS?

18. **Subscription fraud**:
    - Can someone share a premium account?
    - Is there device/session limiting for premium?
    - Can a user subscribe, use heavily, then chargeback?
    - Are Stripe webhook secrets properly stored (not hardcoded)?

## Output Format

Write the report to `audit-ecommerce-2026-03-07/08-plans-limits-monetization.md` (or the directory specified by the user):

```markdown
# SKAPARA Plans, Limits & Monetization Audit — [DATE]

## Executive Summary
[2-3 sentences: monetization readiness, biggest risks, revenue impact]

## Findings

### Phase 1: Plan Definition & Pricing
| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PLM-01 | ... | CRITICAL/HIGH/MEDIUM/LOW | path:line | ... |

### Phase 2: Usage Tracking
...

### Phase 3: Limit Enforcement
...

### Phase 4: Stripe Integration
...

### Phase 5: Upsell & Engagement
...

### Phase 6: Security & Integrity
...

## Plan Feature Matrix
| Feature | Guest (Free) | Registered (Free) | Premium (€9.99/mo) |
|---------|-------------|-------------------|---------------------|
| Chat messages/day | 5 | X | Unlimited |
| Design generations/day | 0 | X | X |
| ... | ... | ... | ... |

## Limit Enforcement Audit
| Limit | Server-Side | Bypassable | Atomic | Notes |
|-------|-------------|------------|--------|-------|
| Guest chat | YES/NO | YES/NO | YES/NO | ... |
...

## Stripe Integration Checklist
| Check | Status | Notes |
|-------|--------|-------|
| Webhook signature verified | OK/FAIL | ... |
| Idempotent processing | OK/FAIL | ... |
| Subscription status sync | OK/FAIL | ... |
...

## Scorecard
| Category | Score /10 | Notes |
|----------|-----------|-------|
| Plan Design | X | ... |
| Limit Enforcement | X | ... |
| Stripe Integration | X | ... |
| Upsell Flow | X | ... |
| Security | X | ... |

## Priority Action Items
1. [P0] ...
2. [P1] ...
```

## Severity Levels

- **CRITICAL**: Limit bypass allowing unlimited free usage, subscription fraud, missing webhook verification → revenue loss
- **HIGH**: Inconsistent limits, broken upsell flow, stale subscription status → impacts monetization
- **MEDIUM**: Missing upsell opportunities, poor pricing page, no usage visibility → reduces conversion
- **LOW**: Polish items, better messaging, analytics improvements
