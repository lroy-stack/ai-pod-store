# Environment Variables Reference

Complete reference for all variables in `.env.example`.

Copy `.env.example` to `.env` and fill in your values.

---

## Brand Identity (White-Label)

These variables control ALL branding. No code changes needed.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SITE_NAME` | Yes | Store display name (appears in UI, emails, browser title) |
| `NEXT_PUBLIC_SITE_TAGLINE` | No | Short tagline shown on landing page |
| `NEXT_PUBLIC_BASE_URL` | Yes | Your store's public URL (e.g., `https://yourdomain.com`) |
| `NEXT_PUBLIC_MCP_BASE_URL` | No | MCP server URL for AI integrations (e.g., `https://mcp.yourdomain.com`) |
| `NEXT_PUBLIC_API_BASE_URL` | No | Self-hosted Supabase API URL (only needed if not using Supabase Cloud) |
| `NEXT_PUBLIC_SOCIAL_INSTAGRAM` | No | Instagram profile URL (leave empty to hide icon) |
| `NEXT_PUBLIC_SOCIAL_TWITTER` | No | Twitter/X profile URL |
| `NEXT_PUBLIC_SOCIAL_FACEBOOK` | No | Facebook page URL |

> `NEXT_PUBLIC_*` variables are baked into JavaScript bundles at `docker compose build` time.
> If you change them, rebuild: `docker compose build frontend admin`.

---

## Contact Emails

| Variable | Default | Description |
|----------|---------|-------------|
| `STORE_CONTACT_EMAIL` | `hello@example.com` | General contact (footer, about page) |
| `STORE_SUPPORT_EMAIL` | `support@example.com` | Customer support email |
| `STORE_LEGAL_EMAIL` | `legal@example.com` | Legal inquiries (Terms of Service) |
| `STORE_PRIVACY_EMAIL` | `privacy@example.com` | Privacy inquiries (Privacy Policy) |
| `STORE_NOREPLY_EMAIL` | `noreply@example.com` | From address for transactional emails |
| `ADMIN_EMAIL` | `admin@example.com` | Admin notification address |

---

## Company Info (Legal Pages + Emails)

| Variable | Description |
|----------|-------------|
| `STORE_COMPANY_NAME` | Legal entity name (used in legal pages, email footers) |
| `STORE_COMPANY_ADDRESS` | Registered address (used in legal pages) |
| `STORE_COMPANY_COUNTRY` | ISO 3166-1 country code (e.g., `DE`, `US`, `FR`) |
| `STORE_TAX_ID` | Optional VAT or tax ID number |
| `STORE_DOMAIN` | Your domain without protocol (e.g., `yourdomain.com`) |
| `STORE_USER_AGENT` | HTTP User-Agent for outbound API calls |
| `STORE_CURRENCY` | ISO 4217 currency code (e.g., `EUR`, `USD`) |

---

## Email Logos

| Variable | Description |
|----------|-------------|
| `EMAIL_LOGO_URL` | Public HTTPS URL for your logo icon in emails (44×34px recommended) |
| `EMAIL_WORDMARK_URL` | Public HTTPS URL for your wordmark in emails (160×20px recommended) |

> Upload your logos to Supabase Storage bucket `marketing/email/` or any CDN.
> If not set, the system looks for `/marketing/email/logo-mark-white.png` in your Supabase storage.

---

## Supabase (Database + Auth)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Project URL from Supabase dashboard |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key (bypasses RLS — keep secret!) |
| `SUPABASE_ANON_KEY` | Yes | Anon key (safe for browser, respects RLS) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Same as `SUPABASE_URL` (build-time) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Same as `SUPABASE_ANON_KEY` (build-time) |

> Get these from: Supabase Dashboard → Project Settings → API.

---

## Stripe (Payments)

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Secret key from Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook signing secret (from Stripe → Webhooks) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Publishable key (safe for browser) |
| `STRIPE_PREMIUM_PRICE_ID` | No | Stripe Price ID for premium subscription |

> Webhook endpoint to register in Stripe: `https://yourdomain.com/api/webhooks/stripe`
> Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`

---

## Print-on-Demand Providers

This platform uses **two fulfillment providers** with distinct roles:

### Printify (Storefront + Catalog Sync)

Used by the frontend and admin for product catalog management.

| Variable | Required | Description |
|----------|----------|-------------|
| `PRINTIFY_API_TOKEN` | Yes | JWT token from Printify dashboard |
| `PRINTIFY_SHOP_ID` | Yes | Your Printify shop ID |
| `PRINTIFY_WEBHOOK_SECRET` | No | Webhook secret for order status updates |

### Printful (PodClaw Agents)

Used by the autonomous agents for product operations and fulfillment.

| Variable | Required | Description |
|----------|----------|-------------|
| `PRINTFUL_API_TOKEN` | Yes | API token from Printful dashboard |
| `PRINTFUL_STORE_ID` | Yes | Your Printful store ID |
| `PRINTFUL_WEBHOOK_SECRET` | No | Webhook secret for order status updates |

---

## AI Services

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key (embeddings for RAG search) |
| `FAL_KEY` | Yes | fal.ai API key (FLUX.1 image generation) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No | Alternative Gemini key for frontend chat |

> Claude authentication is handled via `claude auth login` — no `ANTHROPIC_API_KEY` needed.

---

## Email (Resend)

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | Yes | API key from Resend dashboard |
| `RESEND_FROM_EMAIL` | Yes | Verified sender email (must be on a verified domain) |
| `RESEND_WEBHOOK_SECRET` | No | Webhook secret for email event tracking |

---

## Internal Secrets

Generate all of these with: `openssl rand -hex 32`

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_PASSWORD` | Yes | Redis authentication password |
| `PODCLAW_BRIDGE_AUTH_TOKEN` | Yes | Bearer token for PodClaw Bridge API |
| `SESSION_SECRET` | Yes | Admin panel cookie encryption (iron-session) |
| `MCP_JWT_SECRET` | Yes | MCP server OAuth 2.1 JWT signing key |
| `MCP_APPROVE_SECRET` | Yes | Shared secret for MCP OAuth consent bridge |
| `CRON_SECRET` | Yes | Authentication for cron endpoint calls |
| `REVALIDATION_SECRET` | Yes | Shared secret for Next.js on-demand revalidation |

---

## Infrastructure

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | (empty) | Your domain for auto-HTTPS via Let's Encrypt (e.g., `yourdomain.com`) |
| `CADDY_SITE_ADDRESS` | `http://localhost` | Caddy's primary listen address |
| `ENABLE_MONITORING` | `false` | Set `true` to enable Prometheus + Grafana + Loki |
| `GRAFANA_ADMIN_PASSWORD` | — | Grafana dashboard password (required if monitoring enabled) |

---

## Optional Integrations

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot for CEO-level notifications |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram webhook verification |
| `PODCLAW_ADMIN_TELEGRAM_CHAT_ID` | Your Telegram chat ID for notifications |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Business API for customer messaging |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key (bot protection) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key |

---

## PodClaw Tuning

These have sensible defaults. Override only if needed.

| Variable | Default | Description |
|----------|---------|-------------|
| `PODCLAW_RESEARCH_MODEL` | `claude-haiku-4-5-20251001` | Model for researcher + finance agents |
| `PODCLAW_COMPLEX_MODEL` | `claude-sonnet-4-5-20250929` | Model for all other agents |
| `PODCLAW_ORCHESTRATOR_DAILY_BUDGET` | `5.00` | EUR/day budget for orchestrator |
| `PODCLAW_ORCHESTRATOR_MAX_TURNS` | `200` | Max turns per orchestrator session |

---

## i18n

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_LOCALE` | `en` | Default language (`en`, `es`, `de`) |
| `SUPPORTED_LOCALES` | `en,es,de` | Comma-separated list of enabled locales |
