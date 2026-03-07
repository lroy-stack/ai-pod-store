# SKAPARA Engagement & Retention Audit -- 2026-03-07

## Executive Summary

**Engagement Score: 7.5/10** -- The store has a surprisingly comprehensive set of engagement and retention features for a POD platform. Wishlist (with guest support and sharing), email drip sequences, abandoned cart recovery, push notifications, referral program, coupon system, in-app notifications, cross-sell recommendations, recently viewed products, social proof indicators, blog, and a full PWA with offline fallback are all implemented. The main gaps are the absence of social sharing buttons on products, no loyalty/points system beyond referral credits, no subscription/recurring order model, and several features (push notifications, blog) that depend on content/configuration that may not be populated.

**Critical retention gaps:**
1. No social sharing on product pages -- massive missed organic acquisition channel
2. No loyalty/points/VIP tier system -- no long-term incentives beyond one-time referral credits
3. Newsletter is only on landing page and footer -- no exit-intent popup, no post-purchase signup prompt
4. Push notification prompt is never triggered automatically -- requires manual invocation via PushPermissionPrompt
5. No first-purchase discount or welcome coupon tied to registration
6. No win-back email campaign for lapsed customers

---

## Findings

### 1. Account & Profile

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ER-01 | Full registration flow with name, email, password, confirmation, terms checkbox, password strength meter, Turnstile CAPTCHA | GOOD | `src/components/auth/RegisterForm.tsx:1-380` | None needed |
| ER-02 | Social login via Google and Apple OAuth with proper callback handling and session migration | GOOD | `src/components/auth/LoginForm.tsx:147-170`, `src/app/[locale]/(focused)/auth/callback/page.tsx:1-94` | None needed |
| ER-03 | "Remember Me" checkbox implemented, stores session to localStorage | GOOD | `src/components/auth/LoginForm.tsx:85-87` | Consider using HTTP-only cookie instead of localStorage for security |
| ER-04 | Login error messages are user-friendly and translated, including specific "invalid credentials" handling | GOOD | `src/components/auth/LoginForm.tsx:136-143` | None needed |
| ER-05 | Profile page with ProfileForm, ShippingAddressList, PaymentMethodsList, ChangePasswordForm, PlanCard, DeleteAccountSection | GOOD | `src/app/[locale]/(app)/profile/page.tsx:1-66` | None needed |
| ER-06 | Full password reset flow: forgot-password form -> email link -> reset-password form with token validation | GOOD | `src/components/auth/ForgotPasswordForm.tsx:1-127`, `src/components/auth/ResetPasswordForm.tsx:1-175` | None needed |
| ER-07 | GDPR account deletion with 30-day grace period, cancellation option, countdown banner, and hard-delete cron job | GOOD | `src/components/profile/DeleteAccountSection.tsx:1-130`, `src/app/api/cron/hard-delete-accounts/route.ts:1-30` | None needed |
| ER-08 | Email verification flow with dedicated handler supporting success, error, and already-verified states | GOOD | `src/components/auth/EmailVerificationHandler.tsx:1-161` | None needed |
| ER-09 | Cart merge on login -- guest cart items are merged into authenticated user's cart | GOOD | `src/components/auth/LoginForm.tsx:107-112` | None needed |
| ER-10 | Session migration on login -- anonymous fingerprint and conversation data migrated to user account | GOOD | `src/components/auth/LoginForm.tsx:114-130` | None needed |

### 2. Wishlist System

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ER-11 | Full wishlist system with WishlistProvider context, server persistence for auth users, localStorage for guests | GOOD | `src/hooks/useWishlist.tsx:1-276` | None needed |
| ER-12 | Guest wishlist supports up to 50 items in localStorage, auto-syncs to server on login | GOOD | `src/hooks/useWishlist.tsx:8,104-115` | None needed |
| ER-13 | Wishlist page supports both guest mode (product grid from localStorage IDs) and auth mode (multiple named wishlists) | GOOD | `src/app/[locale]/(app)/wishlist/page.tsx:1-427` | None needed |
| ER-14 | Share wishlist: generates crypto-random token, creates public URL, copy-to-clipboard dialog | GOOD | `src/app/api/wishlist/share/route.ts:1-77` | Share URL is hardcoded to `/en/` locale (line 39, 67) -- should use user's locale |
| ER-15 | Shared wishlist view page with product cards and add-to-cart buttons | GOOD | `src/app/[locale]/(app)/wishlist/shared/[token]/page.tsx:1-223` | None needed |
| ER-16 | "Add all to cart" button on wishlist | GOOD | `src/app/[locale]/(app)/wishlist/page.tsx:144-160` | No feedback toast after adding all items |
| ER-17 | Create multiple named wishlists (auth mode only) | GOOD | `src/app/[locale]/(app)/wishlist/page.tsx:124-142` | None needed |
| ER-18 | Wishlist count badge not visible in header/sidebar navigation | MEDIUM | N/A | Add badge with `wishlistItems.length` to the wishlist link in StorefrontSidebar/Header |
| ER-19 | Guest wishlist shows sign-up prompt banner encouraging account creation | GOOD | `src/app/[locale]/(app)/wishlist/page.tsx:234-253` | None needed |
| ER-20 | Optimistic UI updates on wishlist toggle with rollback on failure | GOOD | `src/hooks/useWishlist.tsx:160-175` | None needed |

### 3. Email Capture & Marketing

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ER-21 | Newsletter signup component with email input, CSRF protection, localized copy (en/es/de) | GOOD | `src/components/landing/NewsletterSignup.tsx:1-126` | None needed |
| ER-22 | Double opt-in implemented: subscriber created as unconfirmed, confirmation email with token sent via Resend, confirmation endpoint sets `confirmed_at` | GOOD | `src/app/api/newsletter/subscribe/route.ts:1-177`, `src/app/api/newsletter/confirm/[token]/route.ts:1-80` | None needed |
| ER-23 | Confirmation emails are localized (en/es/de) with proper HTML formatting | GOOD | `src/app/api/newsletter/subscribe/route.ts:96-141` | None needed |
| ER-24 | Newsletter only placed in Footer component and landing page client component -- no exit-intent popup, no post-purchase prompt, no dedicated page | MEDIUM | `src/components/Footer.tsx:31`, `src/components/landing/LandingPageClient.tsx` | Add exit-intent popup, post-purchase email capture, and cart page newsletter prompt |
| ER-25 | Unsubscribe flow: POST endpoint + one-click GET with RFC 8058 signed tokens, rate-limited, CAN-SPAM compliant, privacy-safe (confirms even for non-existent users) | GOOD | `src/app/api/newsletter/unsubscribe/route.ts:1-262`, `src/lib/unsubscribe-token.ts:1-62` | None needed |
| ER-26 | Email drip sequence system with 3-step welcome flow: welcome (1h), tips (72h), credit offer (168h) | GOOD | `src/lib/email-drip.ts:1-77` | Only 1 sequence defined ("welcome") -- add post-purchase, win-back, and review-request sequences |
| ER-27 | Drip cron processor respects GDPR: only sends to confirmed newsletter subscribers, includes unsubscribe links (RFC 8058) | GOOD | `src/app/api/cron/drip/route.ts:119-129` | None needed |
| ER-28 | Newsletter campaigns API exists for listing/filtering campaigns | GOOD | `src/app/api/newsletter/campaigns/route.ts:1-59` | No admin UI for creating campaigns visible in frontend |
| ER-29 | No back-in-stock notification system | LOW | N/A | Implement with stock webhook handler + email notification |
| ER-30 | No promotional email sending capability beyond drip sequences | MEDIUM | N/A | Build campaign send endpoint and admin UI |

### 4. Notifications

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ER-31 | In-app notification center: full page at `/profile/notifications` with read/unread states, mark-all-as-read, icon mapping by type | GOOD | `src/app/[locale]/profile/notifications/page.tsx:1-217` | None needed |
| ER-32 | Order status notifications created by webhook handlers: shipped and delivered events both create `notifications` DB rows and send emails | GOOD | `src/lib/pod/webhooks/handlers/order-shipped.ts:104-127`, `src/lib/pod/webhooks/handlers/order-delivered.ts:43-59` | None needed |
| ER-33 | Email notifications respect user preferences via `isEmailEnabled()` check | GOOD | `src/lib/pod/webhooks/handlers/order-shipped.ts:131-151` | None needed |
| ER-34 | Push notification system implemented: VAPID-based Web Push via `web-push` library, subscribe/send helpers | GOOD | `src/lib/push-notifications.ts:1-74`, `src/hooks/usePushNotifications.ts:1-83` | None needed |
| ER-35 | PushPermissionPrompt dialog component exists but is never auto-triggered -- requires explicit `open` prop | MEDIUM | `src/components/engagement/PushPermissionPrompt.tsx:1-60` | Auto-show prompt after 3rd visit or first purchase with a localStorage throttle |
| ER-36 | Push notification promise: order status, design ready, wishlist price drops -- but price drop alerts not actually wired to any trigger | MEDIUM | `src/components/engagement/PushPermissionPrompt.tsx:13-17` | Wire push notifications to price change detection logic |
| ER-37 | No notification bell/badge in the main navigation header showing unread count | MEDIUM | N/A | Add notification bell icon with unread count badge to StorefrontHeader |

### 5. Loyalty & Rewards

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ER-38 | Referral program: unique referral link per user, 3 credits to referrer + 3 to referred, stats dashboard (invited/converted/credits) | GOOD | `src/app/[locale]/(app)/referrals/page.tsx:1-181`, `src/app/api/referral/route.ts:1-109` | None needed |
| ER-39 | Coupon/discount system: validate endpoint supports percentage and fixed discounts, date validation, usage limits, minimum purchase, max discount cap | GOOD | `src/app/api/coupons/validate/route.ts:1-120` | None needed |
| ER-40 | Review reward: 1 credit per product review (idempotent, first review only) | GOOD | `src/app/api/reviews/route.ts:123-154` | None needed |
| ER-41 | No points/loyalty system beyond referral and review credits | MEDIUM | N/A | Implement points-per-purchase system with redemption for discounts |
| ER-42 | No VIP tiers or membership levels | LOW | N/A | Consider VIP tiers based on lifetime spend or order count |
| ER-43 | No birthday rewards | LOW | N/A | Add birthday field to profile, trigger birthday coupon email |
| ER-44 | No first-purchase discount or welcome coupon tied to registration | MEDIUM | N/A | Auto-generate 10% welcome coupon on registration and include in welcome drip email |
| ER-45 | Referral page uses `text-green-500` and `text-purple-500` -- violates semantic token rules | LOW | `src/app/[locale]/(app)/referrals/page.tsx:140,150` | Replace with `text-success` and `text-primary` |

### 6. Personalization

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ER-46 | Recently viewed products: localStorage-based hook tracking last 8 viewed products with timestamps | GOOD | `src/hooks/useRecentlyViewed.ts:1-69` | None needed |
| ER-47 | Cross-sell recommendations: association rules (co-purchase) based system with same-category fallback, up to 4 products | GOOD | `src/app/api/products/[id]/cross-sell/route.ts:1-97`, `src/components/cart/CartCrossSell.tsx:1-50` | None needed |
| ER-48 | Social proof indicators: views today, orders this week, "Selling Fast" badge | GOOD | `src/components/products/SocialProofIndicator.tsx:1-60`, `src/app/api/products/[id]/social-proof/route.ts:1-53` | None needed |
| ER-49 | Locale/language preference stored per user, redirect on login to preferred locale | GOOD | `src/components/auth/LoginForm.tsx:133-134` | None needed |
| ER-50 | No personalized homepage -- landing page is static for all users | LOW | N/A | Show recently viewed, recommended products, or "continue shopping" section for returning users |
| ER-51 | No search history persistence | LOW | N/A | Low priority -- AI chat history serves similar purpose |
| ER-52 | Trending products API exists (`/api/products/trending`) for surfacing popular items | GOOD | `src/app/api/products/trending/route.ts` | None needed |

### 7. Content Engagement

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ER-53 | Blog system with localized titles/excerpts (en/es/de), published_at filtering, view counts, slug-based routing | GOOD | `src/app/[locale]/(app)/blog/page.tsx:1-123` | None needed |
| ER-54 | Blog post detail page exists at `/blog/[slug]` | GOOD | `src/app/[locale]/(app)/blog/[slug]/page.tsx` | N/A -- content depends on DB population |
| ER-55 | Designs gallery exists at `/designs` for showcasing AI-generated designs | GOOD | `src/app/[locale]/(app)/designs/page.tsx` | None needed |
| ER-56 | No social sharing buttons on product detail pages | HIGH | N/A | Add share buttons (native Web Share API + fallback) to ProductDetailClient for Twitter, Facebook, WhatsApp, copy link |
| ER-57 | Social media links (Instagram, Twitter, Facebook) in footer with configurable URLs via SOCIAL_LINKS config | GOOD | `src/components/Footer.tsx:64-79` | None needed |
| ER-58 | No Instagram feed integration or UGC showcase | LOW | N/A | Consider embedding Instagram feed or customer photo gallery |

### 8. Re-Engagement

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ER-59 | Abandoned cart recovery: 2-stage email (1h and 24h), locale-aware, branded HTML templates, cart item counting, recovery tracking with `abandoned_carts` table | GOOD | `src/app/api/cron/abandoned-cart-recovery/route.ts:1-359` | None needed |
| ER-60 | Abandoned cart emails check if user has completed an order since cart was last updated (skip if converted) | GOOD | `src/app/api/cron/abandoned-cart-recovery/route.ts:247-262` | None needed |
| ER-61 | Reorder capability: POST `/api/orders/:id/reorder` copies all order items to cart with ownership check, quantity capping, duplicate handling | GOOD | `src/app/api/orders/[id]/reorder/route.ts:1-169` | None needed |
| ER-62 | No win-back email campaign for lapsed customers (e.g., no order in 60+ days) | MEDIUM | N/A | Add win-back drip sequence triggered by inactivity detection cron |
| ER-63 | No "continue where you left off" feature on homepage for returning visitors | LOW | N/A | Show recently viewed products or last viewed product on homepage |
| ER-64 | No subscription or recurring order model | LOW | N/A | Low priority for POD -- most purchases are one-time |
| ER-65 | Abandoned cart recovery only works for authenticated users (guest carts have no email) | MEDIUM | `src/app/api/cron/abandoned-cart-recovery/route.ts:11` | Prompt guest users with email capture at cart stage |

### 9. Community & Social

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ER-66 | No social sharing buttons on product pages | HIGH | N/A | Critical gap -- implement Web Share API with fallbacks |
| ER-67 | No Instagram feed integration | LOW | N/A | Embed Instagram posts or customer photos |
| ER-68 | Product reviews system exists with verified purchase badges, photo uploads (up to 3), 10-char minimum, moderation status filtering | GOOD | `src/app/api/reviews/route.ts:1-208` | None needed |
| ER-69 | Social login supports Google and Apple (both login and register pages) | GOOD | `src/components/auth/LoginForm.tsx:147-170`, `src/components/auth/RegisterForm.tsx:127-150` | None needed |
| ER-70 | No community features (forums, user galleries, design contests) | LOW | N/A | Consider design showcase/contest feature for UGC |

### 10. PWA & App Features

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ER-71 | Web App Manifest with brand name, standalone display, maskable icons (192, 512), apple-touch-icon, dark theme colors | GOOD | `src/app/manifest.ts:1-46` | None needed |
| ER-72 | Service worker (Serwist) with precaching, runtime caching strategies (NetworkOnly for API, StaleWhileRevalidate for Printify images, CacheFirst for Supabase/fal.ai images) | GOOD | `src/app/sw.ts:1-250` | None needed |
| ER-73 | Offline fallback page with cached products display from IndexedDB | GOOD | `src/app/[locale]/(app)/offline/page.tsx:1-49` | None needed |
| ER-74 | Background sync for pending cart actions when offline | GOOD | `src/app/sw.ts:174-212` | None needed |
| ER-75 | Push notification handler in service worker with notification click navigation | GOOD | `src/app/sw.ts:141-172` | None needed |
| ER-76 | No "Add to Home Screen" prompt component -- relies on browser default behavior | LOW | N/A | Add custom install prompt with `beforeinstallprompt` event |
| ER-77 | Service worker cache cleanup on activation (migrates old cache names) | GOOD | `src/app/sw.ts:128-139` | None needed |

---

## Engagement Feature Matrix

| Feature | Implemented | Quality | Impact | Effort |
|---------|-------------|---------|--------|--------|
| Wishlist (auth) | YES | HIGH | HIGH | -- |
| Wishlist (guest) | YES | HIGH | HIGH | -- |
| Wishlist sharing | YES | MEDIUM (locale bug) | MEDIUM | LOW fix |
| Newsletter (double opt-in) | YES | HIGH | HIGH | -- |
| Email drip sequences | YES | MEDIUM (1 sequence) | HIGH | MEDIUM |
| Abandoned cart emails | YES | HIGH | HIGH | -- |
| Push notifications | PARTIAL (no auto-trigger) | MEDIUM | HIGH | LOW |
| In-app notifications | YES | HIGH | MEDIUM | -- |
| Referral program | YES | HIGH | MEDIUM | -- |
| Coupon/discount system | YES | HIGH | HIGH | -- |
| Review rewards | YES | MEDIUM | MEDIUM | -- |
| Cross-sell recommendations | YES | HIGH | HIGH | -- |
| Recently viewed | YES | MEDIUM | MEDIUM | -- |
| Social proof | YES | HIGH | HIGH | -- |
| Social sharing (products) | NO | -- | HIGH | LOW |
| Blog | YES | MEDIUM | MEDIUM | -- |
| Reorder | YES | HIGH | MEDIUM | -- |
| PWA/offline | YES | HIGH | MEDIUM | -- |
| Loyalty points system | NO | -- | HIGH | HIGH |
| Welcome discount | NO | -- | HIGH | LOW |
| Win-back campaigns | NO | -- | MEDIUM | MEDIUM |
| Notification bell badge | NO | -- | MEDIUM | LOW |
| Wishlist count badge | NO | -- | LOW | LOW |

---

## Customer Lifecycle Gaps

```
AWARENESS -> ACQUISITION -> ACTIVATION -> RETENTION -> REVENUE -> REFERRAL
   OK          GOOD           GOOD         GAPS         GOOD       GOOD
```

### Where we lose people:

1. **Awareness -> Acquisition**: No social sharing on products means zero viral loop from existing customers. This is the single biggest gap.

2. **Acquisition -> Activation**: No welcome discount or first-purchase incentive. The drip sequence mentions Premium upgrade at 168h but offers no tangible discount to convert first-time visitors.

3. **Retention (re-engagement)**: Push notification prompt is never auto-triggered. No win-back campaign for lapsed customers. Newsletter signup has low surface area (footer only).

4. **Retention (ongoing engagement)**: No loyalty/points system means customers have no cumulative incentive to return. Referral credits are a one-time event.

---

## Priority Action Items

1. **[P0]** Add social sharing buttons to product detail pages -- Web Share API with Twitter/Facebook/WhatsApp fallbacks. Zero investment, high organic traffic potential. Missing file: needs `ShareButton` component and integration into `ProductDetailClient.tsx`.

2. **[P0]** Auto-trigger PushPermissionPrompt after user's 3rd session or first purchase. Currently the component at `src/components/engagement/PushPermissionPrompt.tsx` exists but is never mounted automatically anywhere. Add to StorefrontLayout with localStorage-based throttle.

3. **[P1]** Add notification bell icon with unread count badge to StorefrontHeader. The notification center page exists at `/profile/notifications` and the API at `/api/notifications` -- just need a header indicator.

4. **[P1]** Add wishlist count badge to wishlist navigation link in StorefrontSidebar/Header. Data is already available via `useWishlist().wishlistItems.length`.

5. **[P1]** Create welcome discount coupon (e.g., WELCOME10 for 10% off first order) auto-generated on registration and included in the first drip email template at `src/app/api/cron/drip/route.ts:27-43`.

6. **[P1]** Fix wishlist share URL locale hardcoding at `src/app/api/wishlist/share/route.ts:39,67` -- should use the requesting user's locale instead of hardcoded `/en/`.

7. **[P2]** Add win-back email drip sequence to `src/lib/email-drip.ts` for users with no orders in 60+ days, with cron trigger.

8. **[P2]** Add exit-intent newsletter popup or post-checkout email capture for guest users who haven't subscribed.

9. **[P2]** Fix semantic token violation in referrals page: `text-green-500` -> `text-success`, `text-purple-500` -> `text-primary` at `src/app/[locale]/(app)/referrals/page.tsx:140,150`.

10. **[P3]** Implement loyalty points system (points per EUR spent, redeemable as store credit).

11. **[P3]** Add "Add to Home Screen" install prompt component using `beforeinstallprompt` event.

12. **[P3]** Add email capture prompt for guest abandoned carts (currently only works for authenticated users).
