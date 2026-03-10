# BRAND CONSISTENCY AUDIT — SKAPARA
**Date**: 2026-03-09
**Scope**: Full codebase (`frontend/`, `admin/`, `podclaw/`, `mcp-server/`, `deploy/`, config files)
**Objective**: Identify all brand references, evaluate centralization, and document inconsistencies.

---

## 1. Brand Assets Inventory

### 1.1 SVG/Image Assets (`frontend/public/brand/`)

| File | Purpose | Used By |
|------|---------|---------|
| `skapara-mark-color.svg` | Full color S mark | coming-soon og:image |
| `skapara-mark-dark.svg` | Dark S mark (for light backgrounds) | `store-config.ts` BRAND.logoLight, `brand-config-server.ts` fallback |
| `skapara-mark-white.svg` | White S mark (for dark backgrounds) | `store-config.ts` BRAND.logoDark, `brand-config-server.ts` fallback |
| `skapara-wordmark-dark.svg` | Full wordmark dark | Not referenced in code (only in design skills) |
| `skapara-wordmark-white.svg` | Full wordmark white | Not referenced in code (only in design skills) |
| `og-image.png` | Open Graph sharing image | `layout.tsx:53`, `landing/page.tsx:30` |
| `icon-192.png` | PWA icon 192px | `manifest.ts:23` |
| `icon-512.png` | PWA icon 512px | `manifest.ts:29` |
| `apple-touch-icon.png` | Apple touch icon | `manifest.ts:35` |
| `favicon-16.png` | Favicon 16px | Not referenced in code |
| `favicon-32.png` | Favicon 32px | Not referenced in code |
| `favicon.ico` | Favicon ICO | Not referenced in code |
| `logo-mark-dark.png` | PNG dark mark | Not referenced in code |
| `logo-mark-white.png` | PNG white mark | Not referenced in code |
| `back-wordmark-1800x2400-NEW.png` | Print design asset | Design skills only |
| `label-outside-wordmark-450x450.png` | Neck label | Design skills only |
| `termina-bold-test.png` | Font test | Not referenced |

**Finding**: `favicon-16.png`, `favicon-32.png`, `favicon.ico`, `logo-mark-dark.png`, `logo-mark-white.png` are present but never referenced in source code. Either they are served by convention (favicon.ico) or are orphaned assets.

---

## 2. Centralization Architecture

### 2.1 Primary Config: `frontend/src/lib/store-config.ts`

This is the **main single source of truth** for brand identity on the frontend. Exports:

| Export | Value | Used By (count) |
|--------|-------|-----------------|
| `BRAND.name` | `process.env.NEXT_PUBLIC_SITE_NAME \|\| 'SKAPARA'` | ~15 components |
| `BRAND.logoLight` | `/brand/skapara-mark-dark.svg` | `brand-mark.tsx`, `brand-config-server.ts` |
| `BRAND.logoDark` | `/brand/skapara-mark-white.svg` | `brand-mark.tsx`, `brand-config-server.ts` |
| `STORE_DEFAULTS` | name, currency, country, etc. | ~20 files |
| `BASE_URL` | `process.env.NEXT_PUBLIC_BASE_URL \|\| 'https://skapara.com'` | ~30 files |
| `CONTACT` | `hello@skapara.com`, `support@skapara.com` | ~3 files |
| `SOCIAL_LINKS` | Instagram, Twitter, Facebook | `Footer.tsx` |
| `PRIMARY_DOMAINS` | localhost variants + `skapara.com` | `middleware.ts`, `tenant-resolve/route.ts` |

**Good**: 60+ files import from `store-config.ts`. It is the de facto brand hub.

### 2.2 Secondary Config: `frontend/src/lib/brand-config-server.ts`

Server-side brand config fetcher with database override capability (reads from `brand_config` table in Supabase). Falls back to hardcoded defaults that duplicate `store-config.ts` values.

**Finding**: The fallback values in `brand-config-server.ts` are **duplicates** of what's in `store-config.ts`. If either file is updated, the other may become stale. The fallback should ideally import from `store-config.ts`.

### 2.3 Centralized Brand Component: `frontend/src/components/ui/brand-mark.tsx`

The `<BrandMark>` component correctly imports from `BRAND` config. Used for consistent logo rendering with light/dark mode support.

### 2.4 PodClaw Brand Config: `podclaw/context/brand_config.md`

Separate Markdown file with brand identity, used as context for AI agents. Contains:
- Store Name: "Skapara" (not "SKAPARA")
- Tagline: "AI-Powered Fashion, European Quality" (DIFFERENT from frontend tagline "Wear what you mean")
- Primary Color: #000000 / Secondary: #FFFFFF

### 2.5 MCP Server: `mcp-server/src/tools/get-store-info.ts`

Uses `process.env.STORE_NAME || 'POD AI Store'` (NOT "SKAPARA") and a completely different tagline: "Create, Customize, and Order -- All Through Conversation". Does not import from any shared brand config.

### 2.6 Admin Panel: No shared brand config

The admin panel has **zero imports** from any brand config file. All brand references are hardcoded directly in components and API routes.

---

## 3. Hardcoded Brand References (ALL instances)

### 3.1 Brand Name "SKAPARA" / "Skapara" Hardcoded in Source Code

#### Frontend `src/` (excluding imports from store-config)

| File | Line | String | Should Use |
|------|------|--------|------------|
| `lib/resend.ts` | 27 | `name: 'SKAPARA'` | `BRAND.name` (not imported) |
| `lib/resend.ts` | 28 | `address: 'c/o SKAPARA UG, Musterstrasse 1, 10115 Berlin, Germany'` | Centralized company info |
| `lib/resend.ts` | 29 | `email: 'hello@skapara.com'` | `CONTACT.general` |
| `lib/legal-utils.ts` | 32 | `company_email: 'hello@skapara.com'` | `CONTACT.general` |
| `lib/legal-utils.ts` | 37 | `dpo_email: 'privacy@skapara.com'` | Centralized config |
| `lib/push-notifications.ts` | 20 | `'mailto:push@skapara.com'` | Centralized config |
| `lib/reliability/escalation.ts` | 200 | `footer: 'Skapara Store Escalation'` | `BRAND.name` |
| `lib/mockup-generator.ts` | 103 | SVG watermark text `SKAPARA` | `BRAND.name` |
| `lib/mockup-backgrounds.ts` | 43 | SVG brand mark text `SKAPARA` | `BRAND.name` |
| `lib/email-drip.ts` | 25 | `'Welcome to Skapara -- Your AI Design Studio'` | i18n string |
| `lib/pod/printful/client.ts` | 66 | `'User-Agent': 'SKAPARA-POD/1.0'` | OK (User-Agent is technical) |
| `lib/pod/printful/mapper.ts` | 175 | `SKAPARA ${input.internalOrderId...}` | `BRAND.name` |
| `lib/pod/printful/mapper.ts` | 197 | `'A gift for you from SKAPARA'` | `BRAND.name` |
| `components/landing/HeroSection.tsx` | 32 | fallback `'SKAPARA'` | `BRAND.name` |
| `components/profile/DataExportSection.tsx` | 34 | `'skapara-data-export.zip'` | Computed from `BRAND.name` |
| `app/sw.ts` | 154 | `data.title \|\| 'SKAPARA'` | `BRAND.name` (not available in SW) |
| `app/manifest.ts` | 15 | `description: 'AI-Powered Print-on-Demand Platform...'` | Centralized description |
| `app/[locale]/layout.tsx` | 33 | `'https://skapara.com'` | `BASE_URL` (already imported 6 lines above!) |

#### Frontend `src/app/` SEO Metadata — Massive Duplication

| File | Lines | Hardcoded Strings |
|------|-------|-------------------|
| `(app)/shop/[id]/page.tsx` | 37, 43-45, 106, 118, 128 | `'SKAPARA Store'`, `'SKAPARA'` (7 instances) |
| `(focused)/returns/page.tsx` | 13-15 | 3 localized SEO descriptions with `SKAPARA` |
| `(focused)/shipping/page.tsx` | 13-15 | 3 localized SEO descriptions with `SKAPARA` |
| `(focused)/terms/page.tsx` | 13-15 | 3 localized SEO descriptions with `SKAPARA` |
| `(focused)/privacy/page.tsx` | 13-15 | 3 localized SEO descriptions with `SKAPARA` |
| `(focused)/about/page.tsx` | 24-26 | 3 localized SEO descriptions with `SKAPARA` |
| `(focused)/faq/page.tsx` | 24-26 | 3 localized SEO descriptions with `SKAPARA` |
| `(editor)/design/[productId]/page.tsx` | 16 | `'SKAPARA design editor'` |
| `(app)/blog/[slug]/page.tsx` | 109 | `name: 'SKAPARA'` in JSON-LD |
| `api/seo/[locale]/route.ts` | 26, 32 | `title: 'SKAPARA'` (fallback x2) |

#### Frontend Email Templates — Hardcoded Brand Copy

| File | Lines | Hardcoded Strings |
|------|-------|-------------------|
| `api/cron/drip/route.ts` | 32-73 | `'Welcome to Skapara!'`, `'Skapara Store'` (6 instances) |
| `api/newsletter/subscribe/route.ts` | 101, 116, 131 | `'Skapara newsletter'` (3 locales) |
| `api/newsletter/drip-sequence-docs/route.ts` | 61, 117-118 | `'Skapara'`, physical address, sender |
| `api/profile/delete/route.ts` | 78 | `'SKAPARA <noreply@skapara.com>'` |
| `api/cron/drip/route.ts` | 153 | `'SKAPARA <noreply@skapara.com>'` |
| `webhooks/stripe/shared.ts` | 32 | `'SKAPARA <noreply@skapara.com>'` |
| `webhooks/stripe/invoice-handlers.ts` | 51 | `'SKAPARA <noreply@skapara.com>'` |

#### Frontend Telegram/WhatsApp Bot Messages

| File | Lines | Hardcoded Strings |
|------|-------|-------------------|
| `api/webhooks/telegram/route.ts` | 130, 150, 156, 165, 175-178 | `'Skapara'` (7 instances), hardcoded URL `https://skapara.com/account/linking` |
| `api/webhooks/whatsapp/route.ts` | 167, 175, 196 | `'Skapara'` (3 instances) |
| `api/telegram/test-command/route.ts` | 47, 49 | `'Skapara'` (2 instances) |
| `api/admin/alert/route.ts` | 58 | `'Skapara Alert'` |

#### Admin Panel

| File | Line | String | Should Use |
|------|------|--------|------------|
| `components/Sidebar.tsx` | 114 | `'Skapara'` | Shared brand config |
| `components/DashboardLayout.tsx` | 47 | `'Skapara Admin'` | Shared brand config |
| `components/MobileSidebar.tsx` | 100 | `'Skapara'` | Shared brand config |
| `app/login/page.tsx` | 48 | `'Skapara Admin'` | Shared brand config |
| `app/layout.tsx` | 11-12 | `'Skapara Admin'` title + description | Shared brand config |
| `app/(dashboard)/seo/page.tsx` | 23, 28, 33 | `'Skapara - Custom Print on Demand'` (3 locales) | DB-backed config |
| `app/(dashboard)/seo/page.tsx` | 304-307 | `'https://skapara.com/en/products'` (4 URLs) | `BASE_URL` |
| `app/(dashboard)/products/[id]/page.tsx` | 449 | `'skapara.com/en/shop/products/'` | `BASE_URL` |
| `app/(dashboard)/messaging/page.tsx` | 194 | `'https://skapara.com/api/webhooks/telegram'` | `BASE_URL` |
| `app/api/admin/settings/route.ts` | 47-50 | `'SKAPARA'`, `contact@skapara.com`, `support@skapara.com` | DB settings |
| `app/api/admin/legal-settings/route.ts` | 36-41 | `'SKAPARA'`, `legal@skapara.com`, `dpo@skapara.com` | DB settings |
| `app/api/admin/notifications/route.ts` | 11 | `'admin@skapara.com'` | Should not be hardcoded |
| `__tests__/test-utils.ts` | 14, 118 | `'admin@skapara.com'` | Test constant |
| `__tests__/auth.test.ts` | 56-168 | `'admin@skapara.com'` (6 instances) | Test constant |
| `__tests__/designs.test.ts` | 13 | `'admin@skapara.com'` | Test constant |
| `__tests__/products.test.ts` | 25 | `'admin@skapara.com'` | Test constant |

#### MCP Server

| File | Line | String |
|------|------|--------|
| `src/tools/get-store-info.ts` | 36 | `'POD AI Store'` (NOT "SKAPARA") |
| `src/tools/get-store-info.ts` | 46 | `'Create, Customize, and Order -- All Through Conversation'` (unique tagline) |

#### PodClaw

| File | Line | String |
|------|------|--------|
| `context/brand_config.md` | 4 | `'Skapara'` |
| `context/brand_config.md` | 5 | `'AI-Powered Fashion, European Quality'` (different tagline) |
| `.env` | 23 | `RESEND_FROM_EMAIL=noreply@skapara.com` |

---

## 4. Email Address Inventory

### Unique email addresses found across the codebase:

| Email | Location(s) | Purpose |
|-------|------------|---------|
| `hello@skapara.com` | `store-config.ts`, `resend.ts`, `legal-utils.ts`, coming-soon | General contact |
| `support@skapara.com` | `store-config.ts`, admin `settings/route.ts` | Support |
| `noreply@skapara.com` | 6+ email send fallbacks, `.env` files | Transactional email sender |
| `privacy@skapara.com` | `legal-utils.ts` | DPO email |
| `push@skapara.com` | `push-notifications.ts` | VAPID subject |
| `legal@skapara.com` | admin `legal-settings/route.ts` | Legal contact |
| `dpo@skapara.com` | admin `legal-settings/route.ts` | DPO (duplicate of privacy@) |
| `contact@skapara.com` | admin `settings/route.ts` | General contact (duplicate of hello@) |
| `admin@skapara.com` | admin tests + `notifications/route.ts` | Admin user email |
| `test-admin-telegram@skapara.com` | `telegram/test-admin-status/route.ts` | Test email |

**CRITICAL INCONSISTENCY**: There are THREE different "general contact" emails:
- `hello@skapara.com` (store-config, resend, legal-utils)
- `contact@skapara.com` (admin settings fallback)
- `legal@skapara.com` (admin legal-settings fallback)

And TWO different DPO emails:
- `privacy@skapara.com` (frontend legal-utils)
- `dpo@skapara.com` (admin legal-settings)

---

## 5. Physical Address Inconsistency

**TWO different addresses found:**

| Address | Location |
|---------|----------|
| `c/o SKAPARA UG, Musterstrasse 1, 10115 Berlin, Germany` | `frontend/src/lib/resend.ts:28` |
| `Skapara Store, Friedrichstrasse 123, 10117 Berlin, Germany` | `frontend/src/app/api/newsletter/drip-sequence-docs/route.ts:117` |
| `123 Commerce Street, San Francisco, CA 94105, USA` | `admin/src/app/api/admin/legal-settings/route.ts:37` |

**CRITICAL**: Three different physical addresses in the codebase. The admin legal-settings has a US address, while the frontend has two different Berlin addresses. CAN-SPAM compliance requires a single, correct physical address.

---

## 6. Tagline/Description Inconsistency

| Tagline | Location |
|---------|----------|
| `"Wear what you mean"` | `brand-config-server.ts` fallback, i18n landing.heroTitle |
| `"AI-Powered Fashion, European Quality"` | `podclaw/context/brand_config.md` |
| `"Create, Customize, and Order -- All Through Conversation"` | `mcp-server/src/tools/get-store-info.ts` |
| `"AI-Managed Print-on-Demand Ecommerce Platform"` | `frontend/src/app/layout.tsx` root metadata |
| `"AI-Powered Print-on-Demand Platform"` | `manifest.ts` description |
| `"AI-powered Print-on-Demand store"` | `admin/settings/route.ts` fallback |
| `"Custom Print on Demand"` | `admin/seo/page.tsx` default meta tags |

**CRITICAL**: Seven different brand descriptions/taglines across the codebase with no single source of truth.

---

## 7. Brand Color Analysis

### 7.1 Email Color Palette (hardcoded, not from theme)

`frontend/src/lib/resend.ts` and `api/cron/abandoned-cart-recovery/route.ts` both define:
```
gradientStart: '#667eea'
gradientEnd: '#764ba2'
heading: '#667eea'
ctaButton: '#667eea'
```

These purple/blue gradient colors appear ONLY in emails and are not referenced in the CSS theme system. They are duplicated in 2 files.

### 7.2 Mockup Background Colors

`frontend/src/lib/mockup-backgrounds.ts` defines brand colors:
- NAVY: `#0F172A`, CHARCOAL: `#1E293B`, TURQUOISE: `#40ACCC`

These are only used for mockup generation SVGs and are self-contained (acceptable).

### 7.3 Theme Colors

- `manifest.ts`: `theme_color: '#09090b'`, `background_color: '#09090b'`
- `layout.tsx`: `theme-color: '#fafafa'` (light), `#0a0a0b` (dark)

Note: `#09090b` (manifest) vs `#0a0a0b` (layout) are slightly different dark theme colors.

---

## 8. i18n Brand Strings

### Brand name in translation files

The brand name "SKAPARA" is hardcoded directly in `frontend/messages/{en,es,de}.json` in the following keys:

- `chat.chatMetaTitle`: `"Chat -- SKAPARA"`
- `chat.chatMetaDescription`: Contains `"SKAPARA"`
- `about.title`: `"About SKAPARA"` / `"Acerca de SKAPARA"` / `"Uber SKAPARA"`
- `about.featureCommunityText`: Contains `"SKAPARA"`
- `about.storyP1`: Contains `"SKAPARA"`
- `about.whyTitle`: `"Why Choose SKAPARA?"` etc.
- `about.q1` / `about.a1`: Contains `"SKAPARA"` (FAQ section)

**Count**: ~8 keys per locale x 3 locales = ~24 hardcoded "SKAPARA" strings in i18n files.

The tagline `"Wear what you mean"` is in `landing.heroTitle` key (properly localized).

**Finding**: The brand name should ideally be injected via ICU `{brandName}` placeholder in i18n files, sourced from a single config. Currently it is baked directly into translation strings.

---

## 9. SEO/Meta Tags Centralization

| Layer | Source | Centralized? |
|-------|--------|-------------|
| Root layout metadata | `BRAND.name` from store-config | YES |
| Locale layout metadata | `getBrandConfig()` from DB with fallback | YES (good) |
| Product pages metadata | Hardcoded `'SKAPARA Store'` | NO |
| Legal pages metadata | Hardcoded per-page in 3 locales | NO |
| About/FAQ pages metadata | Hardcoded per-page in 3 locales | NO |
| Blog page JSON-LD | Hardcoded `'SKAPARA'` | NO |
| Product JSON-LD (schema.org) | Hardcoded `'SKAPARA'`, `'SKAPARA Store'` | NO |
| og:image | `/brand/og-image.png` (2 locations) | Partially (path consistent) |
| PWA manifest | `BRAND.name` from store-config | YES |
| Service Worker | Hardcoded `'SKAPARA'` | NO |
| SEO API fallback | Hardcoded `'SKAPARA'` | NO |
| Admin SEO defaults | Hardcoded `'Skapara - Custom Print on Demand'` | NO |

---

## 10. Missing from Centralization

The following brand-related values appear hardcoded but are NOT in `store-config.ts`:

| Value | Current Location | Proposed Location |
|-------|-----------------|-------------------|
| Company legal name (`SKAPARA UG`) | `resend.ts` | `store-config.ts` or DB |
| Company physical address | `resend.ts`, `drip-sequence-docs/route.ts` | `store-config.ts` or DB |
| DPO email (`privacy@skapara.com`) | `legal-utils.ts` | `CONTACT` in store-config |
| VAPID email (`push@skapara.com`) | `push-notifications.ts` | `CONTACT` in store-config |
| Email color palette | `resend.ts`, `abandoned-cart-recovery/route.ts` | Shared email config |
| Brand tagline | `brand-config-server.ts` | `store-config.ts` |
| All SEO descriptions per locale | 6+ pages | `brand-config-server.ts` or i18n |
| Admin brand name | 5+ admin components | Shared constant |

---

## 11. Cross-Service Brand Consistency

| Service | Brand Name | Tagline | Contact Email | Uses Shared Config? |
|---------|-----------|---------|---------------|-------------------|
| Frontend | SKAPARA (from config) | "Wear what you mean" | hello@skapara.com | YES (store-config.ts) |
| Admin | "Skapara" (hardcoded) | N/A | contact@skapara.com / legal@skapara.com | NO |
| PodClaw | "Skapara" (markdown) | "AI-Powered Fashion, European Quality" | noreply@skapara.com | NO (standalone .md) |
| MCP Server | "POD AI Store" (env fallback) | "Create, Customize, and Order" | N/A | NO (no shared config) |
| Coming Soon | "SKAPARA" (hardcoded HTML) | N/A | hello@skapara.com | NO (static HTML) |

---

## 12. Critical Findings Summary

### CRITICAL (must fix)

1. **Three different physical addresses** across the codebase. CAN-SPAM requires one correct address.
2. **MCP Server uses "POD AI Store"** as default store name instead of "SKAPARA".
3. **Admin panel has zero shared brand config** -- all brand strings are hardcoded.
4. **Duplicate/conflicting contact emails**: `hello@`, `contact@`, `legal@` used interchangeably for "general contact".
5. **Duplicate DPO emails**: `privacy@skapara.com` vs `dpo@skapara.com` in different files.
6. **Seven different taglines/descriptions** with no single canonical tagline.

### HIGH (should fix)

7. **`resend.ts` COMPANY_INFO** duplicates data already in `store-config.ts` (name, email) without importing it.
8. **`brand-config-server.ts` fallback** duplicates `store-config.ts` values instead of importing them.
9. **30+ hardcoded "SKAPARA" strings in SEO metadata** across page files that should use `BRAND.name`.
10. **Email templates** have brand name and copy hardcoded in HTML strings -- not localizable, not configurable.
11. **Telegram/WhatsApp bot messages** hardcode "Skapara" (7+ instances) and direct URL `https://skapara.com/account/linking`.
12. **Email color palette duplicated** in 2 files (`resend.ts` and `abandoned-cart-recovery/route.ts`).

### MEDIUM (nice to fix)

13. **i18n files** have ~24 hardcoded "SKAPARA" strings that could use ICU placeholders.
14. **Slight dark theme color mismatch**: manifest `#09090b` vs layout `#0a0a0b`.
15. **Orphaned brand assets**: `favicon-16.png`, `favicon-32.png`, `logo-mark-dark.png`, `logo-mark-white.png` -- no code references found.
16. **PodClaw brand_config.md** uses a completely different tagline from the frontend.
17. **Service Worker** cannot import from store-config (acceptable limitation, but the string is still hardcoded).

---

## 13. Recommendations

### Phase 1: Consolidate Brand Constants (Quick Wins)

1. **Extend `store-config.ts`** to include:
   - `CONTACT.legal`, `CONTACT.privacy`, `CONTACT.push` emails
   - `COMPANY.name` (legal entity), `COMPANY.address`
   - `BRAND.tagline` (canonical)
   - `BRAND.description` (canonical per locale)

2. **Update `brand-config-server.ts`** to import fallback values from `store-config.ts` instead of duplicating them.

3. **Update `resend.ts` COMPANY_INFO** to import from `store-config.ts`.

4. **Create admin shared constants** file or make admin import from a shared package.

### Phase 2: Eliminate Hardcoded Strings

5. **Create a `generateBrandMetadata()` helper** that takes locale + page-specific title and returns standardized Metadata with `BRAND.name`, `BASE_URL`, and brand OG image.

6. **Replace all hardcoded `'SKAPARA Store'` / `'SKAPARA'`** in SEO metadata with `BRAND.name` or `STORE_DEFAULTS.storeName`.

7. **Create email template constants** that use `BRAND.name` for from addresses and body copy.

### Phase 3: Cross-Service Alignment

8. **MCP Server**: Add `STORE_NAME=SKAPARA` to `.env.example` and ensure it's set.

9. **PodClaw**: Update `brand_config.md` tagline to match frontend canonical tagline.

10. **Admin Panel**: Create a shared brand config import (even if it's just duplicating the constants, it creates a single point of update).

### Phase 4: i18n Improvement

11. **Replace hardcoded brand name in i18n files** with ICU `{brandName}` parameter, passed from config at render time.

---

## Appendix: File Reference Map

### Files that import from `store-config.ts` (60+ files)
See Section 2.1 for the full import analysis.

### Files with hardcoded brand strings (NOT importing from config)
- `frontend/src/lib/resend.ts`
- `frontend/src/lib/legal-utils.ts`
- `frontend/src/lib/push-notifications.ts`
- `frontend/src/lib/reliability/escalation.ts`
- `frontend/src/lib/mockup-generator.ts`
- `frontend/src/lib/mockup-backgrounds.ts`
- `frontend/src/lib/email-drip.ts`
- `frontend/src/lib/pod/printful/mapper.ts`
- `frontend/src/app/sw.ts`
- `frontend/src/app/[locale]/(app)/shop/[id]/page.tsx`
- `frontend/src/app/[locale]/(focused)/returns/page.tsx`
- `frontend/src/app/[locale]/(focused)/shipping/page.tsx`
- `frontend/src/app/[locale]/(focused)/terms/page.tsx`
- `frontend/src/app/[locale]/(focused)/privacy/page.tsx`
- `frontend/src/app/[locale]/(focused)/about/page.tsx`
- `frontend/src/app/[locale]/(focused)/faq/page.tsx`
- `frontend/src/app/[locale]/(editor)/design/[productId]/page.tsx`
- `frontend/src/app/[locale]/(app)/blog/[slug]/page.tsx`
- `frontend/src/app/api/seo/[locale]/route.ts`
- `frontend/src/app/api/cron/drip/route.ts`
- `frontend/src/app/api/newsletter/subscribe/route.ts`
- `frontend/src/app/api/newsletter/drip-sequence-docs/route.ts`
- `frontend/src/app/api/profile/delete/route.ts`
- `frontend/src/app/api/admin/alert/route.ts`
- `frontend/src/app/api/telegram/test-command/route.ts`
- `frontend/src/app/api/webhooks/telegram/route.ts`
- `frontend/src/app/api/webhooks/whatsapp/route.ts`
- `frontend/src/components/profile/DataExportSection.tsx`
- `frontend/src/components/landing/HeroSection.tsx`
- `admin/src/components/Sidebar.tsx`
- `admin/src/components/DashboardLayout.tsx`
- `admin/src/components/MobileSidebar.tsx`
- `admin/src/app/login/page.tsx`
- `admin/src/app/layout.tsx`
- `admin/src/app/(dashboard)/seo/page.tsx`
- `admin/src/app/(dashboard)/messaging/page.tsx`
- `admin/src/app/(dashboard)/products/[id]/page.tsx`
- `admin/src/app/api/admin/settings/route.ts`
- `admin/src/app/api/admin/legal-settings/route.ts`
- `admin/src/app/api/admin/notifications/route.ts`
- `mcp-server/src/tools/get-store-info.ts`
- `podclaw/context/brand_config.md`
- `frontend/coming-soon/index.html`
- `frontend/coming-soon/coming-soon.html`

**Total unique source files with hardcoded brand strings**: ~44
**Total hardcoded "SKAPARA"/"Skapara" instances in source code**: ~120+
