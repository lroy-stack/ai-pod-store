# Trust Signals Audit — SKAPARA Store — 2026-03-07

## Trust Score Matrix

| # | Category | Score (1-5) | Status | Impact on Conversion |
|---|---|---|---|---|
| 1 | Professional Appearance | 4 | Good | High |
| 2 | Brand Identity & Story | 4 | Good | Medium |
| 3 | Contact Accessibility | 3 | Partial | High |
| 4 | Return Policy | 4 | Good | Very High |
| 5 | Shipping Information | 4 | Good | Very High |
| 6 | Payment Security | 4 | Good | Very High |
| 7 | Product Guarantees | 2 | Weak | High |
| 8 | GDPR Compliance | 4 | Good | Medium (legal risk) |
| 9 | GPSR Compliance | 3 | Partial | Medium (legal risk) |
| 10 | EU E-commerce Legal | 4 | Good | Medium (legal risk) |
| 11 | External Trust Signals | 1 | Missing | Very High |
| 12 | Community / Social Proof | 1 | Missing | High |

**Overall Trust Score: 3.2 / 5** — Solid legal and structural foundation, but critical gaps in external validation and social proof that directly impact purchase confidence for first-time visitors.

---

## Phase 1: First Impression Trust

### 1. Professional Appearance (Score: 4/5)

**Strengths:**
- Consistent branding via `BrandMark` component and `BRAND` config (single source of truth)
- Favicon present: `public/favicon.ico`, `public/brand/favicon-16.png`, `public/brand/favicon-32.png`
- Clean, modern landing page with hero, "How It Works" steps, product carousel, testimonials, newsletter, and final CTA
- shadcn/ui components used consistently throughout (no raw HTML elements)
- Dark/light mode with semantic tokens (no hardcoded colors)
- Mobile-first responsive design with proper breakpoints

**Weaknesses:**
- Product carousel may show placeholder icons (`Palette` icon) if products lack images — visible on landing page
- No "hero product shot" or lifestyle imagery on the landing — relies entirely on product database images

### 2. Brand Identity & Story (Score: 4/5)

**Strengths:**
- Dedicated About page (`/(focused)/about/page.tsx`) with mission, brand story, AI-powered features, community, and "Why SKAPARA" section
- About page includes: AI design, premium products, EU fulfillment, community focus, security, support
- Brand assets in `/public/brand/` (mark-color, mark-dark, mark-white, wordmark-dark SVGs)
- Consistent brand name via `BRAND.name` config
- JSON-LD Organization + WebSite schema on landing page

**Weaknesses:**
- No team/founder page or personal story — the brand feels faceless
- `sameAs` array in Organization schema is empty (no social media URLs linked in structured data)
- About page content is translation-key driven — actual content quality depends on i18n files (not audited here)

### 3. Contact Accessibility (Score: 3/5)

**Strengths:**
- Dedicated Contact page with form, email addresses (`hello@skapara.com`, `support@skapara.com`), live chat mention, and response time info
- Contact form with subject categories (general, tech, order, product, partnership, feedback)
- Footer links to Contact page
- Live chat via AI assistant (the chat is the core UX of the store)

**Weaknesses:**
- **No physical address visible on Contact page** — address only appears on Legal Notice page (fetched from DB settings). EU e-commerce requires this to be easily findable
- **No phone number anywhere** — significantly reduces trust for EU customers
- Response time is mentioned but the actual content depends on i18n keys — may be vague

---

## Phase 2: Purchase Confidence

### 4. Return Policy (Score: 4/5)

**Strengths:**
- Dedicated Returns page (`/(focused)/returns/page.tsx`) accessible from footer
- Content is DB-driven with i18n support (en/es/de) and placeholder resolution
- Footer links in both main Footer and FocusedFooter (checkout flow)
- Returns API exists (`/api/orders/[id]/returns/`, `/api/admin/returns/`)
- Trust badge in checkout: "Returns" icon with `trustReturns` translation

**Weaknesses:**
- Content is entirely DB-driven — cannot verify if it mentions EU 14-day withdrawal right, who pays return shipping, or step-by-step process without querying the database
- **Returns policy not visible on product pages** — only in footer/dedicated page
- No "30-day guarantee" or similar badge on product cards

### 5. Shipping Information (Score: 4/5)

**Strengths:**
- Dedicated Shipping page (`/(focused)/shipping/page.tsx`) accessible from footer
- Shipping rates defined in code: DE (3.99/9.99), ES (4.99/11.99), FR (4.99/11.99), EU (5.99/14.99), GB (6.99/14.99), US (12.99/24.99)
- Free shipping threshold defined: 50 EUR (`STORE_DEFAULTS.freeShippingThreshold`)
- Free shipping promotion shown in CartView
- Shipping estimate API exists (`/api/cart/shipping-estimate/`)
- Trust badge in checkout: "Shipping" icon with `trustShipping` translation

**Weaknesses:**
- **Production time (2-7 days POD) not visible** in the code UI — customers may not know items are made-to-order
- Shipping cost not shown on product pages — only visible in cart/checkout
- Free shipping threshold not promoted on landing page or product pages

### 6. Payment Security (Score: 4/5)

**Strengths:**
- Checkout shows Lock icon with "Secure Payment" messaging
- Shield icon with `paymentSecure` text
- Payment method SVG logos: Visa, Mastercard, Amex (inline SVGs in CheckoutView)
- Trust badges row: Shipping + Returns + Secure
- Stripe-powered checkout (redirect model — customer sees Stripe's trusted interface)
- ShieldCheck icon used for security messaging

**Weaknesses:**
- **No "Powered by Stripe" or Stripe logo** — missing opportunity to leverage Stripe's brand trust
- No SSL/HTTPS badge or lock indicator on the site itself (relies on browser)
- No money-back guarantee badge
- Payment logos are monochrome SVG outlines — low visual impact compared to official colored logos

### 7. Product Guarantees (Score: 2/5)

**Weaknesses (Critical):**
- **No explicit print quality guarantee** anywhere in the codebase
- **No satisfaction guarantee** badge or policy
- **No "Made in EU" badge** on product pages despite EU-only fulfillment
- No sizing accuracy guarantee (size guide exists but no "true to size" promise)
- No "100% satisfaction or your money back" messaging
- Product detail page shows materials via GPSR but no guarantee language

---

## Phase 3: Legal & Regulatory

### 8. GDPR Compliance (Score: 4/5)

**Strengths:**
- **Cookie Consent Banner**: Full implementation with Accept All, Reject All, and Customize options
- Cookie categories: Necessary (always on), Analytics, Marketing — granular control
- Consent stored with timestamp in localStorage
- "Cookie Settings" button in footer to re-open consent dialog
- Cookie consent links to dedicated Cookies page (`/(focused)/cookies/page.tsx`)
- **Privacy Policy page**: DB-driven, i18n supported (en/es/de), with placeholder resolution
- **Right to Deletion**: `DeleteAccountSection` component with confirmation dialog and grace period (countdown banner)
- **Data Export**: `/api/profile/export/route.ts` — ZIP download with rate limiting (JSZip)
- **Consent Tracking**: `/api/consent/route.ts` — records consent grants/withdrawals to `user_consents` table
- **DPO mentioned**: Privacy page references "Data Protection Officer" in contact text
- **Personal data cleanup cron**: `/api/cron/cleanup-personal/route.ts`

**Weaknesses:**
- Cookie consent does NOT appear to block non-essential cookies before consent (banner is informational, no cookie-gating logic visible in the consent library — it stores consent state but enforcement depends on analytics/marketing scripts respecting it)
- No visible link to data export in the profile UI (API exists but discoverability unclear)
- DPO contact only shown on Legal Notice page if `dpo_name` and `dpo_email` are configured in DB

### 9. GPSR Compliance (Score: 3/5)

**Strengths:**
- Product detail page has GPSR section: "Safety Information" expandable section with ShieldCheck icon
- `safety_information` field rendered from product data
- Product creation pipeline includes GPSR acceptance before publish (documented in CLAUDE.md)
- `product_details` JSONB field designed for: safety_information, material, care_instructions, print_technique, manufacturing_country, brand

**Weaknesses:**
- **GPSR section only renders if `safetyInformation` exists** — products without it show nothing (no fallback)
- **No "Responsible EU Person" field visible** in the product detail UI — required by GPSR 2023/988
- **Manufacturer info not displayed** on product pages (may be in safety_information text, but not structured)
- No GPSR compliance badge or indicator on product cards/listing pages
- Compliance depends entirely on data quality in Supabase — no validation guard in the UI

### 10. EU E-commerce Legal Requirements (Score: 4/5)

**Strengths:**
- **Terms and Conditions**: Dedicated page, DB-driven, i18n (en/es/de)
- **Legal Notice / Impressum**: Full page with company name, address, email, Tax ID, trade register, DPO — all fetched from DB `legal_settings`
- **EU ODR Platform link**: Explicitly shown on Legal Notice page with link to `https://ec.europa.eu/consumers/odr`
- **VAT**: Currency is EUR, store operates from DE — but...
- **14-day withdrawal**: Referenced in drip sequence docs and consent API — content likely in DB-driven legal pages
- All legal pages accessible from footer: Privacy, Terms, Returns, Shipping, Legal Notice

**Weaknesses:**
- **"Prices include VAT" not displayed** anywhere in the UI — required for EU B2C e-commerce (no "incl. VAT" / "inkl. MwSt." text found)
- Legal Notice content depends on `legal_settings` table being populated — shows "Company Name Not Set" / "Address Not Set" as fallback
- 14-day withdrawal right existence depends on DB content of Terms/Returns pages — not hardcoded guarantee

---

## Phase 4: Social Proof at Scale

### 11. External Trust Signals (Score: 1/5)

**Critical gaps:**
- **No Trustpilot integration** — no references in codebase
- **No Google Reviews integration** — no references in codebase
- **No external review platform** of any kind
- **No press/media coverage section**
- **No "As seen in..." or partner logos**
- No third-party security seals (e.g., TrustedShops, McAfee Secure)

### 12. Community / Social Proof (Score: 1/5)

**What exists:**
- Internal product reviews with verified purchase badges on landing page (Testimonials component)
- Total orders count displayed on landing page
- Average rating with star display
- Social media links in footer (Instagram, Twitter, Facebook)

**What is missing:**
- **Social media URLs are placeholder** (`instagram.com/skapara`, `twitter.com/skapara`, `facebook.com/skapara`) — likely not active accounts
- **No Instagram feed embedded** on site
- **No user-generated content (UGC)** section
- **No follower counts** displayed
- **No community forum or Discord/Telegram link**
- Internal reviews may be zero or near-zero for a new store — Testimonials component returns null if no reviews exist

---

## Missing Trust Signals (Critical)

These are elements whose absence **actively hurts sales** and causes cart abandonment:

| # | Missing Signal | Impact | Effort to Fix |
|---|---|---|---|
| 1 | **"Prices include VAT" text** next to product prices | Very High — EU legal requirement, causes confusion | Low (1-2h) |
| 2 | **No external reviews** (Trustpilot, Google) | Very High — first-time visitors have zero external validation | Medium (1-2 days setup) |
| 3 | **No product guarantees** (satisfaction, quality, money-back) | High — visitors feel no safety net beyond legal minimum | Low (2-4h) |
| 4 | **No "Made in EU" badge** on products | High — key differentiator not communicated at point of purchase | Low (1-2h) |
| 5 | **No phone number** on contact/legal pages | High — EU customers expect phone support option | Low (30min) |
| 6 | **No Stripe/payment brand trust** leveraged | Medium — Stripe checkout redirect helps, but pre-checkout trust is low | Low (1h) |
| 7 | **No production time disclosure** (POD = 2-7 days before shipping) | Medium — causes post-purchase complaints and chargebacks | Low (1-2h) |
| 8 | **Physical address not on Contact page** | Medium — only on Legal Notice page, hard to find | Low (30min) |
| 9 | **Free shipping threshold not promoted** on landing/product pages | Medium — 50 EUR threshold exists but hidden | Low (1-2h) |
| 10 | **No social media presence** (placeholder URLs) | Medium — dead social links erode trust more than no links | Medium (ongoing) |

---

## Legal Compliance Gaps

| # | Regulation | Gap | Risk Level |
|---|---|---|---|
| 1 | **EU Price Indication Directive** | No "incl. VAT" / "inkl. MwSt." displayed with prices | HIGH — legal requirement in DE/EU for B2C |
| 2 | **GPSR 2023/988 — Responsible EU Person** | No structured "Responsible Person in EU" field on product pages | HIGH — required for all products sold in EU from July 2024 |
| 3 | **GPSR 2023/988 — Manufacturer Info** | Manufacturer display depends on data quality, no UI fallback/warning | MEDIUM — data may exist but not guaranteed |
| 4 | **Cookie Consent — Prior Blocking** | Cookie banner exists but enforcement of blocking non-essential cookies before consent is unclear | MEDIUM — GDPR requires opt-in, not opt-out |
| 5 | **14-day Withdrawal Right** | Existence depends on DB content, not hardcoded | LOW — likely present in legal pages but not verified |
| 6 | **Legal Notice Completeness** | Falls back to "Not Set" placeholders if DB not configured | LOW — operational, not code issue |

---

## Recommendations (Prioritized by Conversion Impact)

### Priority 1 — Immediate (This Week)

1. **Add "incl. VAT" to all prices**
   - Files: `formatPrice()` in `frontend/src/lib/currency.ts`, product cards, checkout
   - Display "incl. VAT" / "inkl. MwSt." / "IVA incl." based on locale
   - Legal requirement + removes purchase hesitation

2. **Add product guarantee badges to product pages and checkout**
   - "EU Quality Guarantee" / "Satisfaction Guarantee" / "Made in EU"
   - Add to ProductDetailClient and CheckoutView trust badges section
   - Use Badge component with ShieldCheck icon

3. **Show physical address on Contact page**
   - Fetch from `legal_settings` (already available via `fetchLegalSettings()`)
   - Display alongside email addresses

4. **Add production time disclosure**
   - "Made to order: 2-5 business days production + shipping"
   - Show on product detail page and shipping info section

5. **Promote free shipping threshold (50 EUR)**
   - Add banner/badge on landing page hero area
   - Show progress bar in cart ("Add X more for free shipping")
   - Display on product pages

### Priority 2 — Short Term (This Month)

6. **Set up Trustpilot or Google Business Profile**
   - Register on Trustpilot (free tier available)
   - Add Trustpilot widget to landing page and footer
   - Set up automated review request emails post-delivery

7. **Add "Powered by Stripe" badge in checkout**
   - Use official Stripe badge SVG before the payment redirect
   - Add colored payment method logos (replace monochrome SVGs)

8. **Fix GPSR product page display**
   - Add "Responsible EU Person" structured field
   - Add fallback text when safety_information is missing
   - Show manufacturer info prominently (not hidden in expandable)

9. **Add phone number to contact and legal pages**
   - Even a business VoIP number increases trust significantly
   - Add to `CONTACT` config in `store-config.ts`

10. **Ensure cookie consent blocks non-essential cookies before acceptance**
    - Audit analytics/marketing script loading
    - Only load after consent is granted (check `getConsent()` before initializing)

### Priority 3 — Medium Term (Next Quarter)

11. **Establish real social media presence**
    - Create active Instagram, TikTok accounts
    - Post UGC, behind-the-scenes, product showcases
    - Replace placeholder URLs in `SOCIAL_LINKS` config
    - Add Instagram feed widget to landing page

12. **Add customer count / order count social proof on product pages**
    - "X customers ordered this" or "Trending" badges
    - Already have order count data on landing page — extend to product level

13. **Add press/media section if coverage obtained**
    - "As featured in" logo bar on landing page

14. **Complete Organization schema `sameAs` array**
    - Add actual social media URLs to JSON-LD on landing page

---

## Key Files Referenced

| Area | Path |
|---|---|
| Landing page | `frontend/src/app/[locale]/(landing)/page.tsx` |
| Landing client | `frontend/src/components/landing/LandingPageClient.tsx` |
| Footer | `frontend/src/components/Footer.tsx` |
| Focused Footer | `frontend/src/components/FocusedFooter.tsx` |
| Header | `frontend/src/components/storefront/StorefrontHeader.tsx` |
| Checkout | `frontend/src/components/checkout/CheckoutView.tsx` |
| Product Detail | `frontend/src/components/products/ProductDetailClient.tsx` |
| Cookie Consent | `frontend/src/components/gdpr/CookieConsent.tsx` |
| Cookie Library | `frontend/src/lib/cookie-consent.ts` |
| Consent API | `frontend/src/app/api/consent/route.ts` |
| Delete Account | `frontend/src/components/profile/DeleteAccountSection.tsx` |
| Data Export | `frontend/src/app/api/profile/export/route.ts` |
| Store Config | `frontend/src/lib/store-config.ts` |
| Terms | `frontend/src/app/[locale]/(focused)/terms/page.tsx` |
| Privacy | `frontend/src/app/[locale]/(focused)/privacy/page.tsx` |
| Returns | `frontend/src/app/[locale]/(focused)/returns/page.tsx` |
| Shipping | `frontend/src/app/[locale]/(focused)/shipping/page.tsx` |
| Legal Notice | `frontend/src/app/[locale]/(focused)/legal/page.tsx` |
| About | `frontend/src/app/[locale]/(focused)/about/page.tsx` |
| Contact | `frontend/src/app/[locale]/(focused)/contact/page.tsx` |
| Testimonials | `frontend/src/components/landing/Testimonials.tsx` |
