# SKAPARA Trust Signals Audit -- 2026-03-07

## Executive Summary

**Trust Score: 72/100 -- GOOD foundation, but critical gaps remain**

SKAPARA has a solid trust infrastructure: all core legal pages exist (dynamically loaded from DB), GDPR cookie consent is fully implemented with granular controls, checkout displays payment security badges and accepted payment logos, and the landing page features real customer testimonials with verified-purchase badges. The review system, social proof indicators, and double-opt-in newsletter are all implemented correctly.

**Critical gaps that kill conversions:**
1. No payment method icons in the footer (global visibility gap)
2. Legal page content depends entirely on database -- if `legal_pages` table is empty or misconfigured, pages return 404 via `notFound()`
3. Legal fallback values in `legal-utils.ts` use placeholder data (`123 Main Street`, `legal@example.com`, `XX-XXXXXXX`) -- if DB fetch fails, these render to users
4. No shipping/delivery info on product detail pages
5. No return policy link on checkout page
6. No dedicated GPSR compliance page -- safety info only appears per-product in a collapsed `<details>` element
7. Register form links to `/[locale]/legal/terms` but the actual page is at `/[locale]/terms` (route mismatch)

---

## Findings

### 1. Legal Pages

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| TS-01 | Privacy Policy page EXISTS -- fetches content from `legal_pages` DB table by slug `privacy`, supports en/es/de, resolves placeholders via `legal-utils.ts` | OK | `src/app/[locale]/(focused)/privacy/page.tsx:60` | Ensure DB content is comprehensive and GDPR-complete |
| TS-02 | Terms of Service page EXISTS -- same DB-driven pattern as privacy | OK | `src/app/[locale]/(focused)/terms/page.tsx:60` | Verify DB content covers POD-specific terms (production delays, color variance) |
| TS-03 | Cookie Policy page EXISTS -- dedicated page with cookie table listing `cookie_consent`, `session_id`, `locale`; lists Stripe and Supabase as third-party providers; has manage-preferences button | OK | `src/app/[locale]/(focused)/cookies/page.tsx:1-191` | Good implementation |
| TS-04 | Return/Refund Policy page EXISTS -- DB-driven, linked from footer | OK | `src/app/[locale]/(focused)/returns/page.tsx:60` | Verify DB content specifies POD exceptions clearly |
| TS-05 | Shipping Policy page EXISTS -- DB-driven, linked from footer | OK | `src/app/[locale]/(focused)/shipping/page.tsx:60` | Verify DB content matches `SHIPPING_RATES` in `store-config.ts` |
| TS-06 | Legal Notice / Impressum EXISTS -- structured page with company info, tax ID, trade register, DPO section, and EU ODR link (`ec.europa.eu/consumers/odr`) | OK | `src/app/[locale]/(focused)/legal/page.tsx:17-186` | Good EU compliance. Verify DB values are real, not fallback placeholders |
| TS-07 | Legal fallback values are PLACEHOLDER data -- `123 Main Street`, `legal@example.com`, `XX-XXXXXXX`, `HRB XXXXXX` | CRITICAL | `src/lib/legal-utils.ts:29-41` | These must never render to production users. Add validation or visible warning when fallbacks are used |
| TS-08 | All legal pages call `notFound()` if DB fetch fails -- zero graceful degradation | HIGH | `src/app/[locale]/(focused)/privacy/page.tsx:63` | Add static fallback content or error page instead of 404 |
| TS-09 | No dedicated GPSR compliance page -- safety info only appears per-product in collapsible `<details>` | MEDIUM | `src/components/products/ProductDetailClient.tsx:492-505` | Consider a standalone GPSR page explaining EU 2023/988 compliance |
| TS-10 | Register form terms link points to `/[locale]/legal/terms` but actual route is `/[locale]/terms` | HIGH | `src/components/auth/RegisterForm.tsx:316` | Fix link to match actual route path |

### 2. Contact & Support

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| TS-11 | Contact page EXISTS -- form with subject categories (General, Tech, Order, Product, Partnership, Feedback), two email addresses displayed (hello@skapara.com, support@skapara.com) | OK | `src/app/[locale]/(focused)/contact/page.tsx:50-161` | Good |
| TS-12 | FAQ page EXISTS -- 18 questions across 5 categories (General, Orders, Products, Pricing, Returns) with accordion UI | OK | `src/app/[locale]/(focused)/faq/page.tsx:48-134` | Good coverage |
| TS-13 | Live chat / AI chatbot EXISTS -- AI assistant built into StorefrontLayout, accessible via `/chat` | OK | `src/components/storefront/ChatArea.tsx` | Good |
| TS-14 | Response time expectations card EXISTS on contact page | OK | `src/app/[locale]/(focused)/contact/page.tsx:129-142` | Content depends on i18n key `responseTimeDesc` |
| TS-15 | Social media links present in footer -- Instagram, Twitter, Facebook | OK | `src/components/Footer.tsx:64-80` | Verify accounts are active and populated |
| TS-16 | Physical address displayed on Legal Notice page via DB settings | OK | `src/app/[locale]/(focused)/legal/page.tsx:67` | Verify real address is in DB, not placeholder |
| TS-17 | No phone number anywhere on the site | LOW | -- | Consider adding phone or WhatsApp for urgent support |

### 3. Payment Security

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| TS-18 | Lock icon + "Secure Checkout" messaging in checkout payment section | OK | `src/components/checkout/CheckoutView.tsx:509-523` | Good |
| TS-19 | Shield icon with "Secure Payment" trust badge in checkout | OK | `src/components/checkout/CheckoutView.tsx:519` | Good |
| TS-20 | Payment method SVG logos (Visa, Mastercard, Amex, PayPal) displayed below checkout trust badges | OK | `src/components/checkout/CheckoutView.tsx:541-567` | Good, though SVGs are simplified/generic |
| TS-21 | No payment method icons in footer | MEDIUM | `src/components/Footer.tsx` | Add payment logos to footer for global visibility -- most e-commerce sites show these sitewide |
| TS-22 | No explicit "Powered by Stripe" or PCI compliance badge | LOW | -- | Add Stripe badge for additional trust |
| TS-23 | Currency display is consistent -- EUR across all locales via `STORE_DEFAULTS.currency` and `LOCALE_CURRENCY` | OK | `src/lib/store-config.ts:15,30-35` | Good |
| TS-24 | No SSL/HTTPS indicator in UI (padlock icon, "Secure Connection" text) | LOW | -- | Browser handles this, but explicit messaging can boost trust |

### 4. Shipping & Delivery

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| TS-25 | Shipping rates defined in `store-config.ts` for DE, ES, FR, EU, GB, US with Standard and Express options | OK | `src/lib/store-config.ts:67-92` | Good data foundation |
| TS-26 | Free shipping threshold set at 50 EUR | OK | `src/lib/store-config.ts:18` | Good |
| TS-27 | Cart page shows shipping cost estimator and free shipping progress bar | OK | `src/components/cart/CartView.tsx:533-575` | Good implementation |
| TS-28 | NO shipping info displayed on product detail pages | HIGH | `src/components/products/ProductDetailClient.tsx` | Add "Free shipping over 50 EUR" badge and estimated delivery on PDP -- this is where purchase decisions happen |
| TS-29 | Order tracking implemented -- `tracking_number`, `tracking_url`, `carrier` fields on orders, email notifications sent on shipment | OK | `src/components/orders/OrderDetailView.tsx:36-38`, `src/lib/pod/webhooks/handlers/order-shipped.ts` | Good |
| TS-30 | Checkout shows "Shipping" line as "Calculated at next step" -- Stripe handles final calculation | OK | `src/components/checkout/CheckoutView.tsx:641-644` | Acceptable but could show estimate |
| TS-31 | Allowed shipping countries defined (DE, FR, ES, IT, NL, BE, AT, PT, IE, GB, US, CA) | OK | `src/lib/store-config.ts:45-47` | Good |

### 5. Return & Guarantee

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| TS-32 | Returns trust badge in checkout ("Easy Returns" icon + text) | OK | `src/components/checkout/CheckoutView.tsx:531-533` | Good |
| TS-33 | Return request system implemented -- dialog in order detail, API endpoint, reason validation | OK | `src/components/orders/OrderDetailView.tsx:125-155` | Good |
| TS-34 | NO return policy link on checkout page | HIGH | `src/components/checkout/CheckoutView.tsx` | Add link to returns policy near the trust badges or payment button |
| TS-35 | No return policy summary on product detail pages | MEDIUM | `src/components/products/ProductDetailClient.tsx` | Add "30-day returns" badge on PDP |
| TS-36 | No money-back guarantee messaging anywhere | MEDIUM | -- | Add explicit guarantee messaging on PDP and checkout |
| TS-37 | API policies route has hardcoded "30-day return policy" content | OK | `src/app/api/policies/route.ts:29` | Ensure this matches DB-stored returns page content |

### 6. Brand Story & Identity

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| TS-38 | About Us page EXISTS -- mission statement, 4 feature cards (AI, Products, Fulfillment, Community), brand story (2 paragraphs), "Why SKAPARA" benefits list | OK | `src/app/[locale]/(focused)/about/page.tsx:48-189` | Good structure |
| TS-39 | Brand identity centralized in `store-config.ts` -- name, logos (light/dark SVGs), consistent across all pages | OK | `src/lib/store-config.ts:1-8` | Good |
| TS-40 | BrandMark component used consistently in header, footer, landing page | OK | `src/components/ui/brand-mark.tsx` | Good |
| TS-41 | No team/founder info on About page | LOW | `src/app/[locale]/(focused)/about/page.tsx` | Consider adding founder story for personal connection |
| TS-42 | Consistent tone via i18n -- all text comes from translation files in en/es/de | OK | -- | Good |

### 7. Social Proof

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| TS-43 | Customer reviews system FULLY IMPLEMENTED -- ReviewForm with star rating, text, photo upload (up to 3 photos, 5MB each) | OK | `src/components/products/ReviewForm.tsx:1-251` | Good |
| TS-44 | Testimonials section on landing page -- shows average rating, total orders count, verified purchase badges, review grid | OK | `src/components/landing/Testimonials.tsx:1-117` | Good |
| TS-45 | SocialProofIndicator component -- shows "Selling Fast" badge, orders this week, views today per product | OK | `src/components/products/SocialProofIndicator.tsx:1-60` | Good urgency signals |
| TS-46 | Verified purchase badge on reviews (`is_verified_purchase`) | OK | `src/components/landing/Testimonials.tsx:82-87` | Good trust indicator |
| TS-47 | "Happy Customers" counter with total orders on landing page | OK | `src/components/landing/Testimonials.tsx:51-56` | Hardcoded text "Happy Customers" not i18n-ized |
| TS-48 | No "As seen in" / press mentions section | LOW | -- | Add if/when press coverage exists |
| TS-49 | No social media follower counts displayed | LOW | -- | Consider adding if counts are meaningful |
| TS-50 | Testimonials text "Happy Customers" and "out of 5" are hardcoded in English, not translated | MEDIUM | `src/components/landing/Testimonials.tsx:44,56` | Move to i18n for ES/DE visitors |

### 8. Security & Privacy

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| TS-51 | Cookie consent banner FULLY IMPLEMENTED -- GDPR-compliant with Accept All, Reject All, Customize options; 3 categories (Necessary always-on, Analytics, Marketing) | OK | `src/components/gdpr/CookieConsent.tsx:1-199` | Excellent implementation |
| TS-52 | Cookie consent persisted to localStorage + cookie + database (API `/api/consent`) | OK | `src/lib/cookie-consent.ts:54-109` | Good audit trail |
| TS-53 | Cookie settings resetable from footer | OK | `src/components/Footer.tsx:137-145` | Good GDPR compliance |
| TS-54 | Newsletter uses double opt-in (GDPR/UWG compliant) -- confirmation token, email verification | OK | `src/app/api/newsletter/subscribe/route.ts:1-169` | Excellent |
| TS-55 | Account data export implemented (GDPR Article 15/20) -- ZIP download with rate limiting (24h cooldown) | OK | `src/app/api/profile/export/route.ts:1-40+` | Good |
| TS-56 | Account deletion implemented with countdown/grace period | OK | `src/components/profile/DeleteAccountSection.tsx`, `src/components/profile/DeletionCountdownBanner.tsx` | Good |
| TS-57 | Registration requires terms agreement checkbox | OK | `src/components/auth/RegisterForm.tsx:37,79,303-327` | Good |
| TS-58 | Password strength meter on registration | OK | `src/components/auth/RegisterForm.tsx:16-27` | Good |
| TS-59 | Turnstile (CAPTCHA) widget on registration | OK | `src/components/auth/RegisterForm.tsx:14,42` | Good bot protection |
| TS-60 | CSRF protection on newsletter signup | OK | `src/components/landing/NewsletterSignup.tsx:69-74` | Good |

### 9. Footer & Global Elements

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| TS-61 | Footer has 4 sections: Brand+Social, Shop links (4 items), Company links (About, Contact, FAQ), Legal links (Privacy, Terms, Returns, Shipping, Legal Notice, Cookie Settings) | OK | `src/components/Footer.tsx:57-168` | Good structure |
| TS-62 | Newsletter signup in footer | OK | `src/components/Footer.tsx:171-174` | Good |
| TS-63 | Language selector (EN/ES/DE) in footer | OK | `src/components/Footer.tsx:148-167` | Good |
| TS-64 | Copyright notice with current year | OK | `src/components/Footer.tsx:180-182` | Good |
| TS-65 | Theme toggle (light/dark) in footer | OK | `src/components/Footer.tsx:183-199` | Good |
| TS-66 | NO payment method icons in footer | MEDIUM | `src/components/Footer.tsx` | Add Visa/MC/Amex/PayPal icons -- standard for e-commerce |
| TS-67 | No currency selector (EUR only, but no UI indicator) | LOW | -- | Consider showing "EUR" explicitly in footer if multi-currency is planned |
| TS-68 | Footer NOT included on landing page (by design -- full viewport chat layout) | INFO | `src/components/Footer.tsx:4-5` | Acceptable per architecture, but landing page visitors miss footer trust signals |

---

## Trust Signal Coverage Map

| Signal | Present | Visible | Effective | Notes |
|--------|---------|---------|-----------|-------|
| Privacy Policy | YES | Footer link | PARTIAL | Content quality depends on DB; fallbacks are placeholder |
| Terms of Service | YES | Footer link | PARTIAL | Same DB dependency concern |
| Cookie Policy | YES | Footer + banner link | GOOD | Detailed, with cookie table |
| Cookie Consent Banner | YES | Auto-display | EXCELLENT | Accept/Reject/Customize, DB logging |
| Return Policy | YES | Footer link | PARTIAL | Not linked from checkout or PDP |
| Shipping Policy | YES | Footer link | PARTIAL | Not surfaced on PDP |
| Impressum / Legal Notice | YES | Footer link | GOOD | Company info, DPO, EU ODR link |
| GPSR Safety Info | YES | Per-product detail | PARTIAL | Collapsed by default, no standalone page |
| Contact Page | YES | Footer link | GOOD | Form + email + live chat mention |
| FAQ | YES | Footer link | GOOD | 18 questions, 5 categories |
| SSL/Security Badge | PARTIAL | Checkout only | PARTIAL | Lock icon, Shield icon, no global indicator |
| Payment Method Logos | YES | Checkout only | PARTIAL | Not in footer (global gap) |
| Stripe/PCI Badge | NO | -- | MISSING | No explicit Stripe branding |
| Shipping on PDP | NO | -- | MISSING | Critical for purchase decisions |
| Free Shipping Badge | YES | Cart page | PARTIAL | Progress bar in cart, absent from PDP |
| Return Policy on Checkout | NO | -- | MISSING | Trust badge text only, no link to policy |
| Return Policy on PDP | NO | -- | MISSING | Should show "30-day returns" |
| Customer Reviews | YES | PDP + Landing | GOOD | Star ratings, photos, verified badges |
| Social Proof | YES | PDP | GOOD | Views today, orders this week, selling fast |
| Testimonials | YES | Landing page | GOOD | Grid with ratings + verified purchase |
| About Us | YES | Footer link | GOOD | Mission, features, story, benefits |
| Social Media Links | YES | Footer | GOOD | Instagram, Twitter, Facebook |
| Newsletter Signup | YES | Footer + Landing | GOOD | Double opt-in, CSRF protected |
| Data Export (GDPR) | YES | Profile settings | GOOD | ZIP download, 24h rate limit |
| Account Deletion (GDPR) | YES | Profile settings | GOOD | Grace period, countdown banner |
| Terms Checkbox on Register | YES | Register form | GOOD | Required, links to terms |
| Money-Back Guarantee | NO | -- | MISSING | No explicit guarantee messaging |

---

## Priority Action Items

1. **[P0] Fix legal-utils.ts fallback placeholder data** -- `123 Main Street`, `legal@example.com`, `XX-XXXXXXX` can render to production users if DB fetch fails. Either (a) validate DB content exists before rendering, (b) show a proper error state, or (c) populate with real company data.
   - File: `src/lib/legal-utils.ts:29-41`

2. **[P0] Fix register form terms link** -- Currently links to `/[locale]/legal/terms` but the actual route is `/[locale]/terms`. Users clicking the terms link during registration get a 404.
   - File: `src/components/auth/RegisterForm.tsx:316`

3. **[P1] Add shipping info to product detail pages** -- "Free shipping over 50 EUR" badge and estimated delivery time. This is where purchase decisions happen.
   - File: `src/components/products/ProductDetailClient.tsx`

4. **[P1] Add return policy link to checkout page** -- Near the trust badges or below the payment button. Currently shows "Easy Returns" icon but no link to the actual policy.
   - File: `src/components/checkout/CheckoutView.tsx:525-539`

5. **[P1] Add payment method icons to footer** -- Visa, Mastercard, Amex, PayPal logos are only shown on checkout. E-commerce standard is to display them sitewide in the footer.
   - File: `src/components/Footer.tsx`

6. **[P2] Add graceful degradation for legal pages** -- Currently call `notFound()` if DB fetch returns null. Provide static fallback content or a proper error page.
   - Files: All `src/app/[locale]/(focused)/{privacy,terms,returns,shipping}/page.tsx`

7. **[P2] Internationalize Testimonials hardcoded text** -- "Happy Customers" and "out of 5" are English-only, not run through i18n.
   - File: `src/components/landing/Testimonials.tsx:44,56`

8. **[P2] Add return policy badge to product detail pages** -- "30-day hassle-free returns" near the Add to Cart button.
   - File: `src/components/products/ProductDetailClient.tsx`

9. **[P3] Add money-back guarantee messaging** -- Explicit guarantee statement on PDP and checkout.

10. **[P3] Create standalone GPSR compliance page** -- Explain EU 2023/988 compliance; currently only per-product `<details>` elements.
