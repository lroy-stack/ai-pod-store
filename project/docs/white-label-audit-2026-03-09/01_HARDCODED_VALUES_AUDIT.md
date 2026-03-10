# White-Label Hardcoded Values Audit

**Date**: 2026-03-09
**Scope**: All source files across frontend, admin, mcp-server, podclaw, deploy, docker-compose
**Purpose**: Identify every hardcoded value that prevents white-labeling via `.env` in 5 minutes

---

## 1. Executive Summary

| Metric | Count |
|--------|-------|
| **Total hardcoded brand references** | **~187** |
| Files with "SKAPARA" (case-insensitive) | 44 source files |
| Files with "podai" references | 5 source files |
| Hardcoded email addresses (@skapara.com) | 6 unique addresses, ~25 occurrences |
| Hardcoded email addresses (@podai.com) | 1 address, 3 occurrences |
| Hardcoded company legal info | 6 locations |
| Hardcoded social links | 1 location (3 URLs) |
| Hardcoded EUR/DE defaults | ~30+ locations |
| Hardcoded color palette (email) | 1 location (11 hex values) |
| i18n messages with literal brand name | 3 files x ~10 occurrences = ~30 |
| Env vars in .env.example | 38 |
| Env vars read by code but MISSING from .env.example | **35+** |
| **New env vars needed for white-label** | **27** |

### Distribution by Service

| Service | Hardcoded Brand Refs | P0 Critical | P1 Important | P2 Polish |
|---------|---------------------|-------------|--------------|-----------|
| frontend/src/lib/store-config.ts | 30+ (central config) | 25 | 5 | 0 |
| frontend/src (other files) | 50+ | 20 | 25 | 5 |
| frontend/messages/*.json | ~30 | 30 | 0 | 0 |
| admin/src | 22 | 10 | 8 | 4 |
| podclaw/*.py | 10 | 5 | 5 | 0 |
| mcp-server/src | 8 | 5 | 3 | 0 |
| docker-compose.yml | 2 | 2 | 0 | 0 |
| deploy/ | 0 | 0 | 0 | 0 |
| start.sh | 1 | 0 | 0 | 1 |

### Critical Findings

1. **`store-config.ts` was designed as single source of truth but fails**: The CONTACT, COMPANY, SOCIAL_LINKS, and EMAIL_PALETTE objects are 100% hardcoded with zero env var support. Only `BRAND.name` reads from `NEXT_PUBLIC_SITE_NAME`.

2. **Many files bypass store-config.ts entirely**: ~35 files hardcode "SKAPARA" directly instead of importing from the central config.

3. **Email domain inconsistency**: Two different domains used as defaults -- `noreply@skapara.com` (frontend) vs `noreply@podai.com` (podclaw, docker-compose). A white-label buyer will see emails from BOTH domains unless explicitly set.

4. **MCP server contains entire privacy policy as source code**: The full privacy policy text with "At SKAPARA" is hardcoded in `get-store-policies.ts`.

5. **i18n files contain literal brand names**: All 3 locale files (en/es/de) have "SKAPARA" baked into about, FAQ, privacy, and terms strings with no interpolation support.

---

## 2. Category 1: Brand Identity

### 2.1 Brand Name -- "SKAPARA" Hardcoded

| File | Line | Value | Env Var Proposed | Priority |
|------|------|-------|------------------|----------|
| `frontend/src/lib/store-config.ts` | 2 | `process.env.NEXT_PUBLIC_SITE_NAME \|\| 'SKAPARA'` | NEXT_PUBLIC_SITE_NAME (exists, rarely set) | P0 |
| `frontend/src/lib/store-config.ts` | 6 | `tagline: 'Wear what you mean'` | NEXT_PUBLIC_BRAND_TAGLINE | P0 |
| `frontend/src/lib/store-config.ts` | 8-10 | Brand descriptions (en/es/de) | DB-driven (brand_config table) | P1 |
| `frontend/src/app/sw.ts` | 154 | `data.title \|\| 'SKAPARA'` | Should use BRAND.name | P1 |
| `frontend/src/app/manifest.ts` | 15 | `'AI-Powered Print-on-Demand Platform...'` | NEXT_PUBLIC_BRAND_DESCRIPTION | P2 |
| `frontend/src/app/[locale]/(editor)/design/[productId]/page.tsx` | 16 | `'...SKAPARA design editor.'` | Use BRAND.name | P1 |
| `frontend/src/app/[locale]/(app)/shop/[id]/page.tsx` | 37,43-45,106,118,128 | `'SKAPARA Store'` (6 occurrences) | Use BRAND.name | P0 |
| `frontend/src/app/[locale]/(app)/blog/[slug]/page.tsx` | 109 | `name: 'SKAPARA'` | Use BRAND.name | P1 |
| `frontend/src/app/api/seo/[locale]/route.ts` | 26,32 | `title: 'SKAPARA'` | Use BRAND.name | P1 |
| `frontend/src/components/landing/HeroSection.tsx` | 32 | `'SKAPARA'` fallback | Use BRAND.name | P1 |
| `frontend/src/lib/mockup-generator.ts` | 103 | `>SKAPARA</text>` (watermark) | BRAND.name | P1 |
| `frontend/src/lib/mockup-backgrounds.ts` | 43 | `>SKAPARA</text>` (brand mark) | BRAND.name | P1 |
| `frontend/src/lib/pod/printful/mapper.ts` | 175 | `'SKAPARA ${...}'` (order label) | BRAND.name | P1 |
| `frontend/src/lib/pod/printful/mapper.ts` | 197 | `'A gift for you from SKAPARA'` | BRAND.name | P1 |
| `frontend/src/lib/pod/printful/client.ts` | 66 | `'User-Agent': 'SKAPARA-POD/1.0'` | BRAND.name-derived | P2 |
| `frontend/src/lib/reliability/escalation.ts` | 200 | `footer: 'Skapara Store Escalation'` | BRAND.name | P2 |
| `frontend/src/components/profile/DataExportSection.tsx` | 34 | `'skapara-data-export.zip'` | BRAND.name slug | P2 |
| `frontend/src/app/api/profile/export/route.ts` | 148 | `'podai-data-export-...'` | BRAND.name slug | P2 |
| `admin/src/app/layout.tsx` | 11-12 | `title: 'Skapara Admin'` | BRAND.name + " Admin" | P1 |
| `admin/src/app/login/page.tsx` | 48 | `'Skapara Admin'` | BRAND.name + " Admin" | P1 |
| `admin/src/components/Sidebar.tsx` | 114 | `'Skapara'` | BRAND.name | P1 |
| `admin/src/components/DashboardLayout.tsx` | 47 | `'Skapara Admin'` | BRAND.name + " Admin" | P1 |
| `admin/src/components/MobileSidebar.tsx` | 100 | `'Skapara'` | BRAND.name | P1 |
| `admin/src/app/api/admin/settings/route.ts` | 47-48 | `store_name: 'SKAPARA'`, description | Env var | P0 |
| `admin/src/app/api/admin/legal-settings/route.ts` | 36 | `'SKAPARA UG (haftungsbeschr...)'` | Env var | P0 |
| `mcp-server/src/tools/get-store-info.ts` | 36 | `process.env.STORE_NAME \|\| 'SKAPARA'` | STORE_NAME | P0 |
| `mcp-server/src/tools/get-store-info.ts` | 46 | `tagline: 'Wear what you mean'` | STORE_TAGLINE | P1 |
| `mcp-server/src/auth/oauth-provider.ts` | 279 | `<title>Authorize SKAPARA</title>` | STORE_NAME | P1 |
| `mcp-server/src/auth/oauth-provider.ts` | 299 | `'your SKAPARA account'` | STORE_NAME | P1 |
| `podclaw/config.py` | 290 | `STORE_SENDER_NAME ... "SKAPARA"` | STORE_SENDER_NAME (exists) | P0 |
| `podclaw/chat_session.py` | 63 | `'POD AI (podai.com)'` | Dynamic from env | P1 |
| `start.sh` | 20 | `PROJECT_NAME="podai"` | From BRAND_NAME env | P2 |

### 2.2 Logo Paths

| File | Line | Value | Env Var Proposed | Priority |
|------|------|-------|------------------|----------|
| `frontend/src/lib/store-config.ts` | 12 | `'/brand/skapara-mark-dark.svg'` | NEXT_PUBLIC_LOGO_LIGHT | P0 |
| `frontend/src/lib/store-config.ts` | 13 | `'/brand/skapara-mark-white.svg'` | NEXT_PUBLIC_LOGO_DARK | P0 |
| `frontend/src/lib/store-config.ts` | 14 | `'/brand/skapara-wordmark-dark.svg'` | NEXT_PUBLIC_LOGO_FULL | P0 |
| `frontend/src/lib/store-config.ts` | 15 | `'/brand/skapara-wordmark-dark.svg'` | NEXT_PUBLIC_LOGO_FULL_LIGHT | P0 |
| `frontend/src/app/manifest.ts` | 23,29,35 | `'/brand/icon-192.png'` etc. | Dynamic from BRAND config | P1 |

---

## 3. Category 2: Company Legal Info

| File | Line | Value | Env Var Proposed | Priority |
|------|------|-------|------------------|----------|
| `frontend/src/lib/store-config.ts` | 20 | `'SKAPARA UG (haftungsbeschr...)'` | COMPANY_LEGAL_NAME | P0 |
| `frontend/src/lib/store-config.ts` | 21 | `'SKAPARA UG'` | COMPANY_SHORT_NAME | P0 |
| `frontend/src/lib/store-config.ts` | 22 | `'c/o SKAPARA UG, Musterstr...'` | COMPANY_ADDRESS | P0 |
| `frontend/src/lib/store-config.ts` | 23 | `country: 'DE'` | COMPANY_COUNTRY | P0 |
| `admin/src/app/api/admin/legal-settings/route.ts` | 36-41 | Company name, address, emails | Should read from shared config | P0 |
| `podclaw/config.py` | 286-288 | Same address hardcoded | STORE_PHYSICAL_ADDRESS (exists) | P0 |
| `podclaw/core.py` | 584 | Same address in prompt | Should use config | P1 |
| `podclaw/agents/newsletter.py` | 92 | Same address in prompt | Should use config | P1 |
| `frontend/src/app/api/newsletter/drip-sequence-docs/route.ts` | 117 | Same address | Should use COMPANY.address | P1 |

---

## 4. Category 3: Contact Emails

### Hardcoded in store-config.ts (ALL need env var support)

| File | Line | Value | Env Var Proposed | Priority |
|------|------|-------|------------------|----------|
| `frontend/src/lib/store-config.ts` | 116 | `'hello@skapara.com'` | CONTACT_EMAIL | P0 |
| `frontend/src/lib/store-config.ts` | 117 | `'support@skapara.com'` | SUPPORT_EMAIL | P0 |
| `frontend/src/lib/store-config.ts` | 118 | `'legal@skapara.com'` | LEGAL_EMAIL | P0 |
| `frontend/src/lib/store-config.ts` | 119 | `'privacy@skapara.com'` | PRIVACY_EMAIL | P0 |
| `frontend/src/lib/store-config.ts` | 120 | `'noreply@skapara.com'` | RESEND_FROM_EMAIL (exists) | P0 |
| `frontend/src/lib/store-config.ts` | 121 | `'mailto:push@skapara.com'` | PUSH_EMAIL | P2 |

### Bypassing store-config (hardcoded directly)

| File | Line | Value | Priority |
|------|------|-------|----------|
| `admin/src/app/api/admin/settings/route.ts` | 49-50 | `'hello@skapara.com'`, `'support@skapara.com'` | P0 |
| `admin/src/app/api/admin/notifications/route.ts` | 11 | `'admin@skapara.com'` | P0 |
| `podclaw/config.py` | 239 | `'noreply@podai.com'` (INCONSISTENT domain!) | P0 |
| `podclaw/agents/newsletter.py` | 93 | `'SKAPARA <noreply@skapara.com>'` | P0 |
| `frontend/src/app/api/newsletter/drip-sequence-docs/route.ts` | 118 | `'SKAPARA <noreply@skapara.com>'` | P1 |
| `mcp-server/src/tools/get-store-policies.ts` | 111 | `'privacy@skapara.com'` | P1 |
| `docker-compose.yml` | 68,158 | `noreply@podai.com` (default) | P0 |
| `admin/src/__tests__/test-utils.ts` | 14,118 | `'admin@skapara.com'` | P2 |
| `admin/src/__tests__/auth.test.ts` | 56,75,85,97,112,168 | `'admin@skapara.com'` x6 | P2 |

**CRITICAL**: Two different email domains used as defaults:
- `noreply@skapara.com` (frontend, store-config)
- `noreply@podai.com` (podclaw, docker-compose)

---

## 5. Category 4: URLs and Domains

| File | Line | Value | Env Var | Priority |
|------|------|-------|---------|----------|
| `frontend/src/lib/store-config.ts` | 112 | `'https://skapara.com'` (fallback) | NEXT_PUBLIC_BASE_URL (exists) | P0 |
| `frontend/src/lib/store-config.ts` | 150 | `'skapara.com'` in PRIMARY_DOMAINS | Derive from DOMAIN | P0 |
| `frontend/src/app/api/webhooks/telegram/route.ts` | 176 | `'https://skapara.com/account/linking'` | Use BASE_URL | P0 |
| `admin/src/app/(dashboard)/seo/page.tsx` | 304-307 | `'https://skapara.com/...'` x4 | Use BASE_URL | P1 |
| `admin/src/app/(dashboard)/messaging/page.tsx` | 194 | `'https://skapara.com/api/...'` | Use BASE_URL | P1 |
| `admin/src/app/(dashboard)/products/[id]/page.tsx` | 449 | `'skapara.com/en/shop/...'` | Use BASE_URL | P1 |
| `podclaw/config.py` | 232 | `'podai.com,www.podai.com,api.podai.com'` | CORS_ORIGINS (exists) | P0 |

### Social Media Links

| File | Line | Value | Env Var Proposed | Priority |
|------|------|-------|------------------|----------|
| `frontend/src/lib/store-config.ts` | 144 | `'https://instagram.com/skapara'` | SOCIAL_INSTAGRAM | P0 |
| `frontend/src/lib/store-config.ts` | 145 | `'https://twitter.com/skapara'` | SOCIAL_TWITTER | P0 |
| `frontend/src/lib/store-config.ts` | 146 | `'https://facebook.com/skapara'` | SOCIAL_FACEBOOK | P0 |

---

## 6. Category 5: Business Configuration

### Currency/Country Defaults

| File | Line | Value | Env Var Proposed | Priority |
|------|------|-------|------------------|----------|
| `frontend/src/lib/store-config.ts` | 32 | `currency: 'EUR'` | DEFAULT_CURRENCY | P0 |
| `frontend/src/lib/store-config.ts` | 33 | `country: 'DE'` | DEFAULT_COUNTRY | P0 |
| `frontend/src/lib/store-config.ts` | 36 | `stripeCurrency: 'eur'` | STRIPE_CURRENCY | P0 |
| `frontend/src/lib/store-config.ts` | 48-52 | LOCALE_CURRENCY (all EUR) | DB-configurable | P1 |

### Shipping & Pricing

| File | Line | Value | Env Var Proposed | Priority |
|------|------|-------|------------------|----------|
| `frontend/src/lib/store-config.ts` | 35 | `freeShippingThreshold: 50` | FREE_SHIPPING_THRESHOLD | P1 |
| `frontend/src/lib/store-config.ts` | 84-109 | Entire SHIPPING_RATES object | DB-driven (shipping_zones) | P1 |
| `frontend/src/lib/store-config.ts` | 62-64 | ALLOWED_SHIPPING_COUNTRIES | ENV (CSV) | P1 |
| `frontend/src/lib/store-config.ts` | 67-73 | PRICING (premium, credit packs) | DB or env | P1 |

---

## 7. Category 6: Email Template Palette

All in `frontend/src/lib/store-config.ts` lines 125-137:

| Key | Value | Env Var Proposed | Priority |
|-----|-------|------------------|----------|
| `gradientStart` | `#667eea` | EMAIL_GRADIENT_START | P1 |
| `gradientEnd` | `#764ba2` | EMAIL_GRADIENT_END | P1 |
| `heading` | `#667eea` | EMAIL_HEADING_COLOR | P1 |
| `ctaButton` | `#667eea` | EMAIL_CTA_COLOR | P1 |
| `bodyText` | `#333` | Internal default (OK) | P2 |
| `mutedText` | `#6b7280` | Internal default (OK) | P2 |
| `footerText` | `#9ca3af` | Internal default (OK) | P2 |
| `panelBg` | `#f9fafb` | Internal default (OK) | P2 |
| `cardBorder` | `#e5e7eb` | Internal default (OK) | P2 |
| `warningBg` | `#fef3c7` | Internal default (OK) | P2 |
| `warningBorder` | `#f59e0b` | Internal default (OK) | P2 |

---

## 8. Category 7: i18n Messages with Literal Brand Name

Each occurrence contains "SKAPARA" literally and MUST be converted to `{brandName}` interpolation.

### `frontend/messages/en.json` (10 occurrences)

| Key Path | Value (excerpt) |
|----------|----------------|
| `chat.chatMetaTitle` | `"Chat -- SKAPARA"` |
| `chat.chatMetaDescription` | `"Chat with SKAPARA to find..."` |
| `about.title` | `"About SKAPARA"` |
| `about.featureCommunityText` | `"...building their brands with SKAPARA..."` |
| `about.storyP1` | `"SKAPARA was born from a simple idea..."` |
| `about.whyTitle` | `"Why Choose SKAPARA?"` |
| `faq.q1` | `"What is SKAPARA?"` |
| `faq.a1` | `"SKAPARA is a fashion brand where..."` |

### `frontend/messages/es.json` -- Same 8+ keys in Spanish
### `frontend/messages/de.json` -- Same 8+ keys in German

**Fix**: Convert to ICU: `"About {brandName}"` and inject BRAND.name at render time.

---

## 9. Category 8: Drip & Newsletter Email Templates

| File | Line | Value | Priority |
|------|------|-------|----------|
| `frontend/src/app/api/cron/drip/route.ts` | 32 | `'Welcome to Skapara!'` | P0 |
| `frontend/src/app/api/cron/drip/route.ts` | 33 | `'...joining Skapara, your AI-powered...'` | P0 |
| `frontend/src/app/api/cron/drip/route.ts` | 43,60,73 | `'...signed up for Skapara Store.'` (3x) | P0 |
| `frontend/src/app/api/cron/drip/route.ts` | 51 | `'...get the most out of Skapara:'` | P0 |
| `frontend/src/app/api/newsletter/subscribe/route.ts` | 101 | `'...subscribing to Skapara newsletter!'` (en) | P0 |
| `frontend/src/app/api/newsletter/subscribe/route.ts` | 116 | Same (es) | P0 |
| `frontend/src/app/api/newsletter/subscribe/route.ts` | 131 | Same (de) | P0 |
| `frontend/src/lib/email-drip.ts` | 25 | `'Welcome to Skapara -- Your AI Design Studio'` | P0 |
| `frontend/src/app/api/newsletter/drip-sequence-docs/route.ts` | 61 | `'Would you recommend Skapara...'` | P1 |

---

## 10. Category 9: Bot Message Strings

### Telegram

| File | Line | Value | Priority |
|------|------|-------|----------|
| `frontend/src/app/api/webhooks/telegram/route.ts` | 130 | `'Skapara Admin Commands:'` | P1 |
| `frontend/src/app/api/webhooks/telegram/route.ts` | 150 | `'Welcome to Skapara!'` | P1 |
| `frontend/src/app/api/webhooks/telegram/route.ts` | 156 | `'Skapara Commands:'` | P1 |
| `frontend/src/app/api/webhooks/telegram/route.ts` | 165 | `'/link - Link your Skapara account'` | P1 |
| `frontend/src/app/api/webhooks/telegram/route.ts` | 175-176 | `'https://skapara.com/account/linking'` | P0 |
| `frontend/src/app/api/admin/alert/route.ts` | 58 | `'Skapara Alert'` | P1 |

### WhatsApp

| File | Line | Value | Priority |
|------|------|-------|----------|
| `frontend/src/app/api/webhooks/whatsapp/route.ts` | 167 | `'Welcome to Skapara!'` | P1 |
| `frontend/src/app/api/webhooks/whatsapp/route.ts` | 175 | `'Skapara Commands:'` | P1 |
| `frontend/src/app/api/webhooks/whatsapp/route.ts` | 196 | `'Skapara is online...'` | P1 |

---

## 11. Category 10: SEO Metadata Pages

| File | Line | Value | Priority |
|------|------|-------|----------|
| `frontend/src/app/[locale]/(focused)/terms/page.tsx` | 13-15 | `'...for using SKAPARA'` (3 locales) | P1 |
| `frontend/src/app/[locale]/(focused)/privacy/page.tsx` | 13-15 | `'...SKAPARA collects...'` (3 locales) | P1 |
| `frontend/src/app/[locale]/(focused)/shipping/page.tsx` | 13-15 | `'...for SKAPARA orders'` (3 locales) | P1 |
| `frontend/src/app/[locale]/(focused)/returns/page.tsx` | 13-15 | `'...for SKAPARA orders'` (3 locales) | P1 |
| `frontend/src/app/[locale]/(focused)/about/page.tsx` | 24-26 | `'...about SKAPARA...'` (3 locales) | P1 |
| `frontend/src/app/[locale]/(focused)/faq/page.tsx` | 24-26 | `'...about SKAPARA...'` (3 locales) | P1 |
| `admin/src/app/(dashboard)/seo/page.tsx` | 23-36 | `'Skapara - Custom Print on Demand'` (3 locales) | P1 |

---

## 12. Category 11: MCP Server Hardcodes

| File | Line | Value | Env Var Proposed | Priority |
|------|------|-------|------------------|----------|
| `mcp-server/src/tools/get-store-info.ts` | 36 | `STORE_NAME \|\| 'SKAPARA'` | STORE_NAME | P0 |
| `mcp-server/src/tools/get-store-info.ts` | 38-39 | STORE_DESCRIPTION default | STORE_DESCRIPTION | P0 |
| `mcp-server/src/tools/get-store-info.ts` | 46 | `'Wear what you mean'` | STORE_TAGLINE | P1 |
| `mcp-server/src/tools/get-store-info.ts` | 47-50 | Hardcoded currencies, locales | From env | P1 |
| `mcp-server/src/tools/get-store-policies.ts` | 85 | `'At SKAPARA, we respect...'` (full privacy policy) | DB-driven | P0 |
| `mcp-server/src/tools/get-store-policies.ts` | 46-60 | Entire shipping policy | DB-driven | P1 |
| `mcp-server/src/tools/get-store-policies.ts` | 63-81 | Entire returns policy | DB-driven | P1 |
| `mcp-server/src/tools/get-store-policies.ts` | 111 | `'privacy@skapara.com'` | PRIVACY_EMAIL | P1 |

---

## 13. Category 12: Service Config

### User-Agent Strings

| File | Line | Value | Priority |
|------|------|-------|----------|
| `frontend/src/lib/pod/printful/client.ts` | 66 | `'SKAPARA-POD/1.0'` | P2 |
| `frontend/src/lib/pod/printify/client.ts` | 99 | `'POD-AI-Store/1.0'` | P2 |
| `frontend/src/lib/branded-mockup-generator.ts` | 159 | `'POD-AI-Store/1.0'` | P2 |
| `frontend/src/app/api/proxy-image/route.ts` | 32 | `'POD-AI-Store/1.0'` | P2 |

### Internal Service URLs (localhost fallbacks -- acceptable)

| File | Value | Notes |
|------|-------|-------|
| `frontend/src/lib/cors.ts` | `localhost:3000,3001` | Dev-only |
| `frontend/src/lib/legal-utils.ts` | `localhost:3001` | Fallback for NEXT_PUBLIC_ADMIN_URL |
| `frontend/src/app/api/webhooks/telegram/route.ts` | `localhost:8000` | Fallback for PODCLAW_BRIDGE_URL |

---

## 14. Gap Analysis: `.env.example` vs Code

### Read by code but MISSING from `.env.example`

| Env Var | Where Read | Category |
|---------|-----------|----------|
| `NEXT_PUBLIC_SITE_NAME` | store-config.ts | Brand |
| `STORE_NAME` | mcp-server | Brand |
| `STORE_DESCRIPTION` | mcp-server | Brand |
| `DEFAULT_CURRENCY` | mcp-server | Business |
| `NEXT_PUBLIC_ADMIN_URL` | legal-utils.ts | Service |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | push-notifications.ts | Service |
| `VAPID_PRIVATE_KEY` | push-notifications.ts | Service |
| `SLACK_WEBHOOK_URL` | escalation.ts | Service |
| `UNSUBSCRIBE_SECRET` | unsubscribe-token.ts | Security |
| `STRIPE_PREMIUM_PRICE_ID` | subscription/create | Business |
| `STRIPE_CRYPTO_ENABLED` | checkout route | Business |
| `PODCLAW_BRIDGE_URL` | telegram, admin | Service |
| `MCP_BASE_URL` | mcp-server index.ts | Service |
| `MCP_CORS_ORIGINS` | mcp-server index.ts | Service |
| `FRONTEND_URL` | mcp-server oauth | Service |
| `LOG_LEVEL` | logger.ts | Service |
| `METRICS_SECRET` | metrics route | Security |
| `OPENAI_API_KEY` | openai-provider.ts | AI |
| `RECRAFT_API_TOKEN` | recraft-provider.ts | AI |
| `IDEOGRAM_API_KEY` | ideogram-provider.ts | AI |
| `REPLICATE_API_TOKEN` | background-removal.ts | AI |
| `REDIS_URL` | redis.ts | Service |
| `CEO_WHATSAPP_NUMBER` | podclaw config | Comms |
| `CEO_TELEGRAM_CHAT_ID` | podclaw config | Comms |
| `WHATSAPP_APP_SECRET` | podclaw config | Security |
| `TELEGRAM_WEBHOOK_SECRET` | podclaw config | Security |
| `PODCLAW_BRIDGE_AUTH_ENABLED` | podclaw config | Security |
| `PRINTFUL_TOKEN_EXPIRES_AT` | health route | Service |
| `POD_PROVIDER` | pod/index.ts | Service |

---

## 15. Proposed `.env` Schema (Complete White-Label Section)

```env
***REMOVED***=======
# BRAND IDENTITY (NEW -- required for white-label)
***REMOVED***=======

# [REQUIRED] Brand name displayed everywhere
NEXT_PUBLIC_SITE_NAME=MyBrand

# [REQUIRED] Brand tagline
NEXT_PUBLIC_BRAND_TAGLINE=Your tagline here

# [OPTIONAL] Logo paths (place files in frontend/public/brand/)
NEXT_PUBLIC_LOGO_LIGHT=/brand/logo-dark.svg
NEXT_PUBLIC_LOGO_DARK=/brand/logo-white.svg
NEXT_PUBLIC_LOGO_FULL=/brand/wordmark.svg
NEXT_PUBLIC_LOGO_FULL_LIGHT=/brand/wordmark-light.svg

***REMOVED***=======
# COMPANY LEGAL (NEW -- required for white-label)
***REMOVED***=======

# [REQUIRED] Legal entity
COMPANY_LEGAL_NAME=My Company LLC
COMPANY_SHORT_NAME=MyCo
COMPANY_ADDRESS=123 Main Street, City, Country
COMPANY_COUNTRY=US
COMPANY_TAX_ID=

***REMOVED***=======
# CONTACT EMAILS (NEW -- required for white-label)
***REMOVED***=======

# [REQUIRED] Contact addresses
CONTACT_EMAIL=hello@mybrand.com
SUPPORT_EMAIL=support@mybrand.com
LEGAL_EMAIL=legal@mybrand.com
PRIVACY_EMAIL=privacy@mybrand.com
# RESEND_FROM_EMAIL already exists for noreply

***REMOVED***=======
# SOCIAL MEDIA (NEW -- optional for white-label)
***REMOVED***=======

SOCIAL_INSTAGRAM=https://instagram.com/mybrand
SOCIAL_TWITTER=https://twitter.com/mybrand
SOCIAL_FACEBOOK=https://facebook.com/mybrand

***REMOVED***=======
# BUSINESS DEFAULTS (NEW -- optional, sensible defaults)
***REMOVED***=======

DEFAULT_CURRENCY=EUR
DEFAULT_COUNTRY=DE
STRIPE_CURRENCY=eur
FREE_SHIPPING_THRESHOLD=50

***REMOVED***=======
# EMAIL PALETTE (NEW -- optional, brand colors for emails)
***REMOVED***=======

EMAIL_GRADIENT_START=#667eea
EMAIL_GRADIENT_END=#764ba2
EMAIL_CTA_COLOR=#667eea

***REMOVED***=======
# MCP SERVER (extend existing)
***REMOVED***=======

STORE_NAME=${NEXT_PUBLIC_SITE_NAME}
STORE_DESCRIPTION=Your store description
STORE_TAGLINE=${NEXT_PUBLIC_BRAND_TAGLINE}
```

**Total new vars: 27** (existing .env.example has 38, making 65 total)

---

## 16. Propagation Map: Docker Compose

| Env Var | frontend | admin | podclaw | mcp-server | Note |
|---------|----------|-------|---------|------------|------|
| NEXT_PUBLIC_SITE_NAME | **build** | - | - | - | Baked at build time |
| NEXT_PUBLIC_BRAND_TAGLINE | **build** | - | - | - | Baked at build time |
| NEXT_PUBLIC_LOGO_* | **build** | - | - | - | Baked at build time |
| COMPANY_LEGAL_NAME | runtime | runtime | - | - | |
| COMPANY_ADDRESS | runtime | runtime | runtime | - | Alias: STORE_PHYSICAL_ADDRESS |
| CONTACT_EMAIL | runtime | runtime | - | - | |
| SUPPORT_EMAIL | runtime | runtime | - | - | |
| LEGAL_EMAIL | runtime | runtime | - | runtime | |
| PRIVACY_EMAIL | runtime | - | - | runtime | |
| SOCIAL_* | **build** | - | - | - | Baked at build time |
| DEFAULT_CURRENCY | runtime | runtime | - | runtime | |
| DEFAULT_COUNTRY | runtime | - | - | - | |
| FREE_SHIPPING_THRESHOLD | runtime | - | - | - | |
| EMAIL_GRADIENT_START | runtime | - | - | - | |
| STORE_NAME | - | - | runtime | runtime | |
| STORE_SENDER_NAME | - | - | runtime | - | |
| STORE_TAGLINE | - | - | - | runtime | |

**Key insight**: `NEXT_PUBLIC_*` vars are baked at build time. Changing them requires `docker compose build`. All other vars take effect on container restart.

---

## 17. Best Practices Comparison

### How Open-Source E-commerce Solves This

| Platform | Approach |
|----------|----------|
| **Medusa.js** | Single `medusa-config.js` with ALL overrides. No brand name in source. DB-driven store settings. |
| **Saleor** | `DASHBOARD_*` env vars for admin. `STATIC_URL` for assets. Company info in DB settings table. i18n uses `{storeName}` placeholders. |
| **Vendure** | `vendure-config.ts` file. Global settings API for runtime config. All brand references via settings API. Email templates use Handlebars `{{shopName}}`. |

### Key Takeaways

1. **Brand name must NEVER appear as a literal string** -- only as a variable from config
2. **i18n messages must use interpolation** (`{brandName}`) not literal brand names
3. **Email templates should use template variables** not string interpolation with hardcoded values
4. **Company/legal info should be 100% DB-driven** with env var defaults for first boot
5. **All policy text should be in the database**, not in source code

---

## 18. Architecture Recommendations

### R1: Fix `store-config.ts` to Read All Values from Env (P0)

```typescript
export const BRAND = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || 'MyStore',
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || 'Your AI Store',
  logoLight: process.env.NEXT_PUBLIC_LOGO_LIGHT || '/brand/logo-dark.svg',
  logoDark: process.env.NEXT_PUBLIC_LOGO_DARK || '/brand/logo-white.svg',
  // ...
}

export const COMPANY = {
  legalName: process.env.COMPANY_LEGAL_NAME || 'Your Company',
  address: process.env.COMPANY_ADDRESS || '123 Main St',
  country: process.env.COMPANY_COUNTRY || 'US',
}

export const CONTACT = {
  general: process.env.CONTACT_EMAIL || 'hello@example.com',
  support: process.env.SUPPORT_EMAIL || 'support@example.com',
  legal: process.env.LEGAL_EMAIL || 'legal@example.com',
  privacy: process.env.PRIVACY_EMAIL || 'privacy@example.com',
  noreply: process.env.RESEND_FROM_EMAIL || 'noreply@example.com',
}

export const SOCIAL_LINKS = {
  instagram: process.env.SOCIAL_INSTAGRAM || '',
  twitter: process.env.SOCIAL_TWITTER || '',
  facebook: process.env.SOCIAL_FACEBOOK || '',
}
```

### R2: Convert i18n to ICU Interpolation (P0)

```json
{
  "about": {
    "title": "About {brandName}",
    "q1": "What is {brandName}?",
    "a1": "{brandName} is a fashion brand where every piece has a story..."
  }
}
```

### R3: Move Policies to Database (P1)

The privacy, shipping, and returns policies in `get-store-policies.ts` should come from the `legal_settings` table, editable in admin panel. Source code should have only a neutral fallback.

### R4: Unify Env Var Names Across Services (P0)

| Current (inconsistent) | Proposed (unified) |
|----------------------|-------------------|
| `NEXT_PUBLIC_SITE_NAME` (frontend) | Keep + alias `STORE_NAME` |
| `STORE_NAME` (mcp-server) | = `NEXT_PUBLIC_SITE_NAME` |
| `STORE_SENDER_NAME` (podclaw) | = `NEXT_PUBLIC_SITE_NAME` |
| `STORE_PHYSICAL_ADDRESS` (podclaw) | = `COMPANY_ADDRESS` |

### R5: Runtime vs Build-Time Rule

| Type | Pattern | When to Use |
|------|---------|-------------|
| `NEXT_PUBLIC_*` | Build-time, baked into JS | Client-visible: name, tagline, logos, Stripe key |
| Server env vars | Runtime, per-request | API keys, secrets, company info, emails |
| DB settings | Runtime, cacheable | SEO, policies, legal text, shipping rates, pricing |

---

## 19. Implementation Plan

### Phase 1: Central Config Fix (2-3 hours)

1. Expand `store-config.ts` to read ALL brand/company/contact/social values from env vars
2. Update `podclaw/config.py` to share same env var names
3. Update `docker-compose.yml` with new environment blocks
4. Update `.env.example` with all 27 new vars
5. Fix docker-compose email default (`podai.com` to `${RESEND_FROM_EMAIL}`)

### Phase 2: Source Code Deduplication (4-5 hours)

1. Replace all direct "SKAPARA" refs with BRAND.name imports (~35 files)
2. Replace all direct email hardcodes with CONTACT imports (~10 files)
3. Replace all direct address hardcodes with COMPANY imports (~6 files)
4. Fix admin panel defaults to use shared config (~3 files)
5. Fix MCP server to use env vars (~2 files)
6. Fix PodClaw agent prompts (~3 files)

### Phase 3: i18n + Email Templates (3-4 hours)

1. Convert `messages/*.json` to use `{brandName}` interpolation (3 files)
2. Update components consuming those keys (~8 files)
3. Fix drip/newsletter templates to use BRAND config (~3 files)
4. Fix bot message strings (~3 files)
5. Fix SEO metadata pages (~6 files)

### Phase 4: Polish (2-3 hours)

1. Move policy text to DB + migration
2. Email palette env vars
3. Fix User-Agent strings (4 files)
4. Fix file download names (2 files)

**Grand Total: ~12-15 hours of implementation**

---

## 20. Verification Checklist: "5-Minute White-Label"

After implementation, a buyer should be able to:

- [ ] Copy `.env.example` to `.env`
- [ ] Set `NEXT_PUBLIC_SITE_NAME=TheirBrand`
- [ ] Set `NEXT_PUBLIC_BRAND_TAGLINE=Their Tagline`
- [ ] Set `COMPANY_LEGAL_NAME=Their Company LLC`
- [ ] Set `COMPANY_ADDRESS=Their Address`
- [ ] Set `CONTACT_EMAIL=hello@theirbrand.com`
- [ ] Set `SUPPORT_EMAIL=support@theirbrand.com`
- [ ] Set `RESEND_FROM_EMAIL=noreply@theirbrand.com`
- [ ] Set `DOMAIN=theirbrand.com`
- [ ] Place logos in `frontend/public/brand/`
- [ ] Run `./start.sh --build && ./start.sh`
- [ ] See "TheirBrand" everywhere (header, footer, emails, PWA, SEO, bots, MCP)
- [ ] See their logo in header, favicon, PWA icon
- [ ] See their domain in all URLs and links
- [ ] See their email in all transactional/marketing emails
- [ ] See their company in legal pages and CAN-SPAM footer
- [ ] See **zero trace** of "SKAPARA", "podai", or "skapara.com" anywhere in UI/emails/bots

---

*End of audit. This document covers 100% of source files across all 5 services (frontend, admin, mcp-server, podclaw, deploy).*
