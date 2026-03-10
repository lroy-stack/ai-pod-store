# E-Commerce Coupon/Discount Code System — Research Report

**Date**: 2026-03-09
**Scope**: Research only — no code implementation
**Purpose**: Best practices compilation for designing a coupon/discount system

---

## 1. Coupon Code Generation Security

### 1.1 Entropy & Character Sets

The security of a coupon code depends on its **entropy** (randomness), calculated as:

```
Entropy (bits) = Length × log2(Character Pool Size)
```

| Character Set | Pool Size | 8-char entropy | 10-char entropy | 12-char entropy |
|---|---|---|---|---|
| Digits only (0-9) | 10 | 26.6 bits | 33.2 bits | 39.9 bits |
| Uppercase alphanumeric (A-Z0-9) | 36 | 41.4 bits | 51.7 bits | 62.0 bits |
| Mixed alphanumeric (A-Za-z0-9) | 62 | 47.6 bits | 59.5 bits | 71.4 bits |
| Alphanumeric + symbols | 95 | 52.6 bits | 65.7 bits | 78.8 bits |

**Recommendation**: Use **uppercase alphanumeric (A-Z0-9), 10-12 characters** for user-facing codes. This provides ~52-62 bits of entropy while remaining easy to read/type. Exclude ambiguous characters (O/0, I/1, L) for readability. For internal/system codes, mixed alphanumeric (A-Za-z0-9) at 12+ characters provides >71 bits of entropy.

A code with only 4-6 characters from a small alphabet is trivially brute-forceable (e.g., 6 uppercase alpha = ~28 bits = ~268M combinations, scriptable in minutes).

### 1.2 Libraries & Algorithms for Code Generation

| Library | npm Package | Highlights |
|---|---|---|
| **Nano ID** | `nanoid` | 118 bytes, uses `crypto.getRandomValues()`, custom alphabets supported, 21 chars default = ~126 bits entropy. Custom alphabet example: `customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 12)` |
| **voucher-code-generator** | `voucher-code-generator` | Purpose-built for coupons. Custom charset, prefix/suffix support, batch generation. TS types via `@types/voucher-code-generator` |
| **coupon-code** | `coupon-code` | Port of Perl's `Algorithm::CouponCode`. Generates segmented codes like `55G2-DHM0-50NN`. Built-in validation with check characters |
| **voucher-generator** | `voucher-generator` | TypeScript native. Cryptographically secure. Supports Luhn check digits for numeric codes |
| **Node.js crypto** | Built-in | `crypto.randomBytes()` + base conversion. Maximum control, zero dependencies |
| **UUID v4** | `uuid` | 122 bits entropy, but 36 chars with hyphens — too long for user-facing codes. Better as internal coupon IDs |

**Recommended approach**: Use `nanoid` with a custom alphabet for code generation (cryptographically secure, tiny footprint, battle-tested), or `voucher-code-generator` if you need batch generation with prefix/suffix patterns for marketing campaigns.

### 1.3 Anti-Brute-Force Measures

| Measure | Implementation |
|---|---|
| **Rate limiting on validation endpoint** | Max 5-10 attempts per minute per IP/session. Return generic "invalid code" for both non-existent and expired codes |
| **Progressive delays** | Exponential backoff after failed attempts (1s, 2s, 4s, 8s...) |
| **CAPTCHA after N failures** | Trigger Turnstile/reCAPTCHA after 3-5 failed code entries |
| **Account-level throttling** | Track failed validations per authenticated user. Lock out after 10 failures in 1 hour |
| **IP-level monitoring** | Flag IPs with >20 failed validations per hour across all accounts |
| **Logging & alerting** | Log all validation attempts. Alert on anomalous patterns (spike in failed validations) |

### 1.4 Preventing Code Enumeration

- **Never reveal** whether a code exists but is expired vs. doesn't exist — same error message for both
- **Minimum code length**: 10+ characters with mixed alphanumeric
- **No sequential patterns**: Never generate codes like `PROMO001`, `PROMO002`
- **No predictable prefixes with short random suffixes**: `SUMMER-A3B` is guessable; `SUMMER-X7K9M2PQ` is not
- **Honeypot codes**: Create invalid codes that trigger alerts when attempted — indicates someone is scanning

---

## 2. Coupon Types & Rules (Industry Standard)

### 2.1 Discount Types

| Type | Description | Example |
|---|---|---|
| **Percentage off** | % discount on eligible items/order | 15% off entire order |
| **Fixed amount off** | Flat currency discount | €10 off |
| **Buy X Get Y** | Purchase requirement triggers reward | Buy 2 tees, get 1 free |
| **Free shipping** | Waives shipping cost | Free standard shipping |
| **Tiered discount** | Discount increases with spend | 10% off €50+, 15% off €100+ |

### 2.2 Scope & Targeting Rules

| Rule | Description |
|---|---|
| **Per-user vs. global** | Code tied to specific user (email/ID) vs. available to anyone |
| **First-purchase-only** | Redeemable only by customers with zero prior orders |
| **New-user-only** | Redeemable only by accounts created within N days |
| **Single-use** | One redemption total, then code is burned |
| **Multi-use (limited)** | N total redemptions across all users (e.g., first 100 uses) |
| **Per-user limit** | Each user can redeem X times (e.g., once per customer) |
| **Unlimited** | No redemption cap |
| **Minimum purchase amount** | Cart subtotal must exceed threshold (e.g., min €50) |
| **Maximum discount cap** | For percentage coupons, cap the max discount (e.g., 20% off, max €30) |
| **Product-specific** | Applies only to listed product IDs |
| **Category-specific** | Applies only to products in listed categories |
| **Stackable vs. non-stackable** | Whether it can combine with other discounts |
| **Time-limited** | Valid between `starts_at` and `expires_at` timestamps |
| **Referral codes** | Tied to a referring user, tracks attribution + gives both parties a reward |
| **Channel-specific** | Web only, mobile only, specific storefront |

### 2.3 Stacking Rules (Shopify Model)

Shopify's approach is the industry standard for stacking:

- **Product discounts** can combine with order and shipping discounts
- **Order discounts** can stack on top of product discounts
- **Shipping discounts** are standalone — cannot combine with other shipping discounts
- **Two product discounts** cannot stack on the same item
- Best practice: define **discount classes** (product, order, shipping) and allow cross-class combination while preventing same-class stacking

### 2.4 Recommended Database Schema

```sql
-- Core coupon definition
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,                        -- User-facing code (unique, case-insensitive)
  code_normalized TEXT GENERATED ALWAYS AS (UPPER(TRIM(code))) STORED,
  description TEXT,                          -- Internal admin note

  -- Discount definition
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y')),
  discount_value NUMERIC(10,2) NOT NULL,     -- Percentage (0-100) or fixed amount in cents
  discount_currency TEXT DEFAULT 'EUR',      -- For fixed_amount type
  max_discount_amount INTEGER,               -- Cap for percentage discounts (in cents)

  -- Scope
  applies_to TEXT NOT NULL DEFAULT 'order' CHECK (applies_to IN ('order', 'products', 'categories', 'shipping')),
  product_ids UUID[],                        -- NULL = all products
  category_ids UUID[],                       -- NULL = all categories

  -- Usage limits
  max_redemptions INTEGER,                   -- NULL = unlimited globally
  max_redemptions_per_user INTEGER DEFAULT 1,
  current_redemptions INTEGER DEFAULT 0,

  -- Eligibility
  first_purchase_only BOOLEAN DEFAULT FALSE,
  minimum_purchase_amount INTEGER,           -- In cents

  -- Stacking
  is_stackable BOOLEAN DEFAULT FALSE,
  discount_class TEXT DEFAULT 'order' CHECK (discount_class IN ('product', 'order', 'shipping')),

  -- Time window
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Referral
  referrer_user_id UUID REFERENCES auth.users(id),

  -- Campaign grouping
  campaign_id UUID REFERENCES coupon_campaigns(id),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT unique_code_normalized UNIQUE (code_normalized)
);

-- Index for fast lookup
CREATE INDEX idx_coupons_code_normalized ON coupons (code_normalized) WHERE is_active = TRUE;
CREATE INDEX idx_coupons_campaign ON coupons (campaign_id);
CREATE INDEX idx_coupons_expires ON coupons (expires_at) WHERE is_active = TRUE;

-- Redemption tracking
CREATE TABLE coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  order_id UUID REFERENCES orders(id),

  discount_applied INTEGER NOT NULL,         -- Actual discount in cents
  order_subtotal INTEGER NOT NULL,           -- Cart subtotal at time of redemption

  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT,                   -- Optional: Fingerprint.js visitor ID

  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_redemptions_coupon ON coupon_redemptions (coupon_id);
CREATE INDEX idx_redemptions_user ON coupon_redemptions (user_id);
CREATE INDEX idx_redemptions_ip ON coupon_redemptions (ip_address);

-- Campaign grouping
CREATE TABLE coupon_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  budget_amount INTEGER,                     -- Total budget in cents (NULL = unlimited)
  budget_spent INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Fraud Prevention

### 3.1 Account Cycling Detection

Account cycling is the #1 fraud vector for "new user" and "first purchase" coupons. 81% of coupon abuse stems from serial offenders.

| Detection Method | Implementation |
|---|---|
| **Device fingerprinting** | Use Fingerprint.js (npm: `@fingerprintjs/fingerprintjs-pro`) to generate a stable `visitorId`. Store it with each redemption. Flag if same device creates multiple accounts |
| **IP clustering** | Track IP addresses at registration and redemption. Flag multiple "new" accounts from same IP within 24h |
| **Email pattern detection** | Detect `user+alias@gmail.com` variations (all route to same inbox). Normalize emails before checking uniqueness |
| **Disposable email blocking** | Use `disposable-email-domains` (npm) or `mailchecker` (npm) — 55,000+ throwaway domains. Block at registration |
| **Phone verification** | Require phone number for high-value codes. Same phone = same person |
| **Behavioral signals** | Flag accounts that: register → immediately apply code → never return. Track time-to-first-redemption |

### 3.2 Code Sharing Prevention

| Method | Description |
|---|---|
| **Personal codes** | Generate unique code per user (tied to user_id). Non-transferable |
| **Email-locked codes** | Code only works when the authenticated user's email matches the assigned email |
| **Single-device binding** | After first use, code is locked to that device fingerprint |
| **Short expiration** | Personal codes expire in 24-72h, limiting sharing window |
| **Redemption velocity** | If a "personal" code shows >1 redemption attempt from different IPs/devices, flag it |

### 3.3 Velocity Checks

| Check | Threshold | Action |
|---|---|---|
| Failed validations per IP | >10/hour | Temporary block + CAPTCHA |
| Successful redemptions per IP | >3/day (for single-use codes) | Flag for review |
| New accounts per IP | >2/day | Require additional verification |
| Redemptions per device fingerprint | >1 per unique-code campaign | Block redemption |
| Total campaign spend velocity | >X% of budget in first hour | Auto-pause campaign, alert admin |

### 3.4 npm Packages for Fraud Prevention

| Package | npm | Purpose |
|---|---|---|
| **Fingerprint.js** (OSS) | `@fingerprintjs/fingerprintjs` | Free browser fingerprinting (60-70% accuracy) |
| **Fingerprint Pro** | `@fingerprintjs/fingerprintjs-pro` | Paid, 99.5% accuracy, server-side validation |
| **disposable-email-domains** | `disposable-email-domains` | List of 79,500+ throwaway email domains |
| **mailchecker** | `mailchecker` | Cross-language, 55,000+ throwaway domains |
| **express-rate-limit** | `express-rate-limit` | Rate limiting middleware (also works with Next.js API routes via adapter) |
| **rate-limiter-flexible** | `rate-limiter-flexible` | Advanced rate limiter with Redis/memory stores, per-IP and per-user |

---

## 4. Stripe Integration Best Practices

### 4.1 Stripe Coupons vs. Promotion Codes

| Concept | Stripe Coupon | Stripe Promotion Code |
|---|---|---|
| **What it is** | The discount definition (e.g., "25% off") | A customer-facing code (e.g., `SPRING25`) that maps to a coupon |
| **Who uses it** | Applied by the merchant (dashboard/API) | Entered by the customer at checkout |
| **Multiplicity** | One coupon | Many promotion codes can point to the same coupon |
| **Restrictions** | Basic: `redeem_by`, `max_redemptions` | Advanced: `first_time_transaction`, `minimum_amount`, `customer` restriction, `expires_at` |
| **When to use** | Internal/automatic discounts | Customer-facing promo codes |

### 4.2 Promotion Code Restrictions (API)

Stripe's built-in restriction parameters on promotion codes:

```typescript
const promoCode = await stripe.promotionCodes.create({
  coupon: 'coupon_id',           // Links to the underlying discount
  code: 'WELCOME20',            // Customer-facing code
  restrictions: {
    first_time_transaction: true, // Only for customers with zero successful payments
    minimum_amount: 5000,         // Minimum €50.00 (in cents)
    minimum_amount_currency: 'eur',
  },
  max_redemptions: 100,          // Total uses across all customers
  expires_at: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
  customer: 'cus_xxx',           // Optional: restrict to specific customer
});
```

### 4.3 Integration Patterns for Checkout

**Pattern A: Let Stripe handle code input (simplest)**
```typescript
const session = await stripe.checkout.sessions.create({
  line_items: [...],
  mode: 'payment',
  allow_promotion_codes: true,   // Stripe renders the promo code field
  success_url: '...',
  cancel_url: '...',
});
```

**Pattern B: Server-side validation + pre-apply (more control)**
```typescript
// 1. Validate code in your own API first (rate limit, fraud checks)
// 2. Look up the Stripe promotion code
const promoCodes = await stripe.promotionCodes.list({
  code: userInputCode,
  active: true,
});

// 3. Apply the coupon to the checkout session
const session = await stripe.checkout.sessions.create({
  line_items: [...],
  mode: 'payment',
  discounts: [{ coupon: promoCodes.data[0].coupon.id }],
  success_url: '...',
  cancel_url: '...',
});
```

**Pattern B is recommended** because:
- You control rate limiting and fraud detection before hitting Stripe
- You can log the attempt in your own database
- You can show a preview of the discount before redirecting to Stripe Checkout
- You can enforce custom rules Stripe doesn't support (category restrictions, device limits)

### 4.4 Important Limitations

- Stripe Checkout supports **max 1 coupon/promotion code per session**
- `first_time_transaction` blocks users who ever initiated a PaymentIntent (even failed ones) or started a trial
- `minimum_amount` restrictions cannot be applied when updating a subscription via API
- Promotion codes are **case-insensitive** and must be unique across all active codes
- For one-time payments, use `mode: 'payment'`; for subscriptions, use `mode: 'subscription'`

### 4.5 Dual-Layer Architecture (Recommended)

The best approach for a real e-commerce store is a **dual-layer system**:

1. **Your database** stores the coupon definition, rules, fraud signals, analytics, and campaign data
2. **Stripe** handles the actual payment discount at checkout time
3. **Flow**: User enters code → Your API validates (rules, rate limit, fraud) → Your API creates/retrieves the Stripe coupon → Applies it to Checkout Session → Stripe processes payment with discount → Your webhook records the redemption

This gives you full control over business logic while leveraging Stripe's reliable payment processing.

---

## 5. Admin Management Best Practices

### 5.1 CRUD Interface Patterns

| Feature | Description |
|---|---|
| **Create single code** | Form with all discount parameters. Auto-generate or manual code entry |
| **Bulk generation** | Generate N codes for a campaign (e.g., 10,000 unique codes for an email blast). CSV export |
| **List/search** | Filterable table: by status (active/expired/exhausted), campaign, date range, type |
| **Edit** | Modify rules, extend expiry, increase limits. **Never change the code itself** after creation |
| **Deactivate** | Soft-delete (set `is_active = false`). Never hard-delete — preserve audit trail |
| **Clone** | Duplicate a coupon's settings for a new campaign |

### 5.2 Bulk Code Generation Workflow

1. Admin creates a **campaign** (name, dates, budget)
2. Admin defines **coupon template** (discount type, rules, limits per code)
3. System generates N unique codes using `nanoid` custom alphabet
4. Codes are associated with the campaign
5. Admin exports as CSV for distribution (email platform, influencer partners)
6. Each code inherits the campaign's budget constraints

### 5.3 Analytics & Reporting

| Metric | Description |
|---|---|
| **Redemption rate** | Codes used / codes generated |
| **Revenue impact** | Total discount given vs. incremental revenue from coupon orders |
| **Average order value (AOV)** | Compare AOV of coupon orders vs. non-coupon orders |
| **Customer acquisition cost (CAC)** | For new-user codes: discount amount / new customers acquired |
| **Campaign budget burn** | Total discounts given vs. campaign budget |
| **Top codes** | Most-redeemed codes, highest discount amounts |
| **Fraud rate** | Blocked/flagged attempts as % of total validation requests |
| **Time-series** | Redemptions over time (daily/weekly) to track campaign momentum |
| **Attribution** | For referral codes: which referrers drive the most conversions |

### 5.4 Deactivation Workflows

| Trigger | Action |
|---|---|
| **Manual** | Admin deactivates via dashboard |
| **Expiration** | Cron job or query filter: `WHERE expires_at < NOW()` |
| **Budget exhausted** | Campaign total discounts reach budget cap → auto-deactivate all campaign codes |
| **Redemption limit reached** | `current_redemptions >= max_redemptions` → auto-deactivate |
| **Fraud detection** | Anomalous usage pattern → auto-pause + alert admin |
| **Bulk deactivation** | End-of-campaign: deactivate all codes in a campaign with one action |

---

## 6. Reference Implementations

### 6.1 Shopify Discount System

- **Architecture**: Discount Functions (serverless, Rust/JS, run in checkout pipeline)
- **Types**: Percentage, fixed amount, buy X get Y, free shipping
- **Discount classes**: Product, Order, Shipping — cross-class stacking allowed, same-class blocked
- **Usage controls**: Total use limit, one-per-customer, minimum purchase, date range, customer eligibility
- **Automatic vs. code-based**: Discounts can auto-apply based on cart conditions
- **Combination system**: Configurable per-discount whether it can combine with others
- **Admin**: Full CRUD + bulk generation via Bulk Discount Code Bot (Shopify App)
- **Key takeaway**: The discount class + stacking model is the cleanest architecture for preventing double-discounting

### 6.2 WooCommerce Coupon System

- **Storage**: WordPress Custom Post Types (`WC_Coupon` CRUD class)
- **Data store**: `WC_Coupon_Data_Store_CPT` abstracts DB access
- **Types**: `fixed_cart`, `percent`, `fixed_product`, `percent_product`
- **Rules**: Product include/exclude lists, category include/exclude, email restrictions, minimum/maximum amounts, individual use toggle, usage limit per coupon and per user, expiry date
- **Validation**: Constraint-based — at checkout, system validates eligibility, expiration, and redemption history
- **Key takeaway**: The include/exclude product+category pattern is essential. Individual use flag is the simplest stacking control

### 6.3 Medusa.js v2 Promotion Module

- **Architecture**: Standalone module (can be used independently of full Medusa)
- **Types**: Amount off products, amount off order, percentage off product, percentage off order, buy X get Y, free shipping
- **Rules engine**: Predicate-based rules on attributes (customer group, cart total, product category)
- **Campaigns**: Group promotions with shared start/end dates and budget configurations
- **Budget tracking**: `campaignBudgetExceeded` action auto-stops promotions when budget depleted
- **npm**: `@medusajs/medusa` (full platform) or `@medusajs/promotion` (standalone module)
- **Key takeaway**: The predicate/rules engine approach is the most flexible. Campaign budgets are a must-have feature

### 6.4 Saleor Commerce

- **Architecture**: GraphQL-native, headless
- **Voucher types**: Entire order, specific products, shipping
- **Promotions**: Catalogue-level (product page) and order-level (cart) promotions with separate predicate systems
- **Channel scoping**: Discounts are per-channel (multi-storefront support)
- **Permissions**: `MANAGE_DISCOUNTS` permission required
- **Key takeaway**: Separating catalogue promotions (visible on PDP) from order promotions (applied at cart/checkout) is a good UX pattern

### 6.5 Voucherify (SaaS Reference — Architecture Insights)

- **Architecture**: API-first with sub-50ms validation, rules engine at core
- **Features**: Universal/personal/random codes, QR/barcode support, stacking hierarchy, velocity caps, budget caps, segment restrictions, webhook-driven fraud alerts
- **Validation flow**: At redemption, API evaluates all eligibility conditions → returns applicable discounts
- **Key takeaway**: The "shared condition library" concept (reusable rule sets across campaigns) reduces admin overhead. Real-time webhook alerts for anomalies are critical for fraud detection

### 6.6 Open-Source Libraries Summary

| Library | npm Package | Language | Use Case |
|---|---|---|---|
| **Medusa Promotion Module** | `@medusajs/promotion` | TypeScript | Full promotion engine with rules, campaigns, budgets |
| **voucher-code-generator** | `voucher-code-generator` | JavaScript | Batch code generation with patterns |
| **coupon-code** | `coupon-code` | JavaScript | Segmented codes with check characters |
| **nanoid** | `nanoid` | JavaScript | Cryptographically secure ID generation (custom alphabets) |
| **voucher-generator** | `voucher-generator` | TypeScript | Crypto-secure numeric codes with Luhn validation |
| **Saleor** | `saleor` (Python) | Python/GraphQL | Full commerce platform with promotion engine |

---

## 7. Consolidated Recommendations for Implementation

### 7.1 Code Generation

- Use `nanoid` with custom alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 chars, no ambiguous O/0/I/1/L), length 10-12
- Store codes as `UPPER(TRIM(code))` for case-insensitive matching
- For campaigns, add a readable prefix: `SPRING-X7K9M2PQ` (prefix + dash + 8 random chars)
- Generate codes in batches server-side, never client-side

### 7.2 Validation Endpoint Security

- Rate limit: 5 attempts/minute per IP, 10/minute per authenticated user
- CAPTCHA after 3 consecutive failures
- Uniform error responses (never leak code existence)
- Log all attempts with IP, user agent, timestamp, user ID

### 7.3 Stripe Integration

- Use dual-layer: own database for rules + Stripe for payment processing
- Create Stripe coupons programmatically when creating coupons in your system
- Use Pattern B (server-side validation → pre-apply) for maximum control
- Store `stripe_coupon_id` and `stripe_promotion_code_id` in your coupons table

### 7.4 Fraud Prevention (Minimum Viable)

- Block disposable emails at registration (`disposable-email-domains` npm)
- Normalize `+alias` Gmail addresses
- Rate limit validation endpoint
- Track IP + user agent on every redemption
- For high-value codes: require email verification + consider device fingerprinting

### 7.5 Admin Features (MVP)

- Create/edit/deactivate coupons with full rule configuration
- Bulk generate codes for campaigns with CSV export
- Dashboard with redemption rate, revenue impact, active campaigns
- Auto-deactivation on expiry/budget/limit

---

## Sources

- [Coupon Fraud: Notable Cases & Prevention — Unit21](https://www.unit21.ai/trust-safety-dictionary/coupon-fraud)
- [Hacking Online Coupons — Trustwave SpiderLabs](https://www.trustwave.com/en-us/resources/blogs/spiderlabs-blog/hacking-online-coupons/)
- [Bruteforcing Coupons — HackerOne Report #288846](https://hackerone.com/reports/288846)
- [Prevent Brute Force Attacks, Coupon Fraud — PerimeterX/Medium](https://medium.com/perimeterx/prevent-brute-force-attacks-coupon-fraud-gift-card-fraud-199a02c5d43)
- [Prevent Coupon Fraud and Promotion Abuse — Voucherify](https://www.voucherify.io/blog/how-to-prevent-coupon-fraud-and-abuse)
- [Prevent Coupon and Promo Abuse — Fingerprint](https://fingerprint.com/blog/prevent-coupon-promo-abuse-increase-sales/)
- [Stopping Coupon Abuse with Email Data — Merchant Risk Council](https://merchantriskcouncil.org/learning/resource-center/member-news/blog/2024/atdata-stopping-coupon-abuse-fake-reviews-and-transaction-fraud)
- [Promo Code Abuse Prevention — Ekata/Mastercard](https://ekata.com/resource/the-dark-side-of-discounts-understanding-and-preventing-promo-code-abuse/)
- [Nano ID — GitHub](https://github.com/ai/nanoid)
- [NanoID vs UUID Comparison — vteams](https://vteams.com/blog/nanoid-vs-uuid-a-detailed-comparison/)
- [voucher-code-generator — GitHub/Voucherify](https://github.com/voucherifyio/voucher-code-generator-js)
- [coupon-code — npm](https://www.npmjs.com/package/coupon-code)
- [disposable-email-domains — npm](https://www.npmjs.com/package/disposable-email-domains)
- [mailchecker — npm](https://www.npmjs.com/package/mailchecker)
- [Fingerprint.js — GitHub](https://github.com/fingerprintjs/fingerprintjs)
- [Stripe Coupons and Promotion Codes — Stripe Docs](https://docs.stripe.com/billing/subscriptions/coupons)
- [Create Stripe Promotion Code API — Stripe Docs](https://docs.stripe.com/api/promotion_codes/create)
- [Add Discounts to Checkout — Stripe Docs](https://docs.stripe.com/payments/checkout/discounts)
- [Stripe Promotion Codes — Stripe Support](https://support.stripe.com/questions/promotion-codes)
- [Shopify Discount Types — Shopify Help](https://help.shopify.com/en/manual/discounts/discount-types)
- [Shopify Discount Functions — Shopify Dev](https://shopify.dev/docs/apps/build/discounts)
- [Shopify Discount Stacking 2025 — Regios Technologies](https://regiostech.com/2025/12/04/shopify-discount-stacking-in-2025-what-actually-works-and-how-to-combine-discounts-properly.html)
- [Shopify Discount Codes Guide 2026 — Seguno](https://www.seguno.com/blog/shopify-discount-codes-guide)
- [WooCommerce Coupon Data — GitHub Wiki](https://github.com/woocommerce/woocommerce/wiki/Coupon-Data)
- [WooCommerce Database Schema — Webappick](https://webappick.com/woocommerce-database-schema-explained/)
- [Medusa.js Promotion Module — Medusa Docs](https://docs.medusajs.com/resources/commerce-modules/promotion)
- [Medusa.js Promotion Concepts — Medusa Docs](https://docs.medusajs.com/resources/commerce-modules/promotion/concepts)
- [Saleor Vouchers — Saleor Docs](https://docs.saleor.io/developer/discounts/vouchers)
- [Saleor Promotions — Saleor Docs](https://docs.saleor.io/developer/discounts/promotions)
- [Voucherify Promotion Rule Engine](https://www.voucherify.io/promotion-rule-engine)
- [Voucherify Voucher Management System](https://www.voucherify.io/voucher-management-system)
- [Design Coupon and Voucher Management System — GeeksforGeeks](https://www.geeksforgeeks.org/system-design/design-coupon-and-voucher-management-system/)
- [Scalable Coupon Management System in Node — STYLABS/Medium](https://medium.com/@STYLABSHQ/how-we-developed-scalable-coupon-management-system-in-node-945426b02df1)
- [Coupon Referral Tracking — Rewardful](https://www.rewardful.com/coupon-code)
- [Coupon Management Systems Top Features — OutsourcingBuddy](https://outsourcingbuddy.com/coupon-management-system/)
