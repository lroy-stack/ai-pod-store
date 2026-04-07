# White-Label Customization Guide

Everything you need to rebrand the platform for your store — all via `.env`.

---

## Checklist: What to Change

| Item | Configured via | Notes |
|------|---------------|-------|
| Store name | `NEXT_PUBLIC_SITE_NAME` | Appears in UI, browser title, emails |
| Tagline | `NEXT_PUBLIC_SITE_TAGLINE` | Landing page hero |
| Domain | `STORE_DOMAIN` + `NEXT_PUBLIC_BASE_URL` | Used in links, cookies, CSP |
| Contact emails | `STORE_*_EMAIL` vars | Legal pages, email footers |
| Company name | `STORE_COMPANY_NAME` | Legal pages, email footers |
| Company address | `STORE_COMPANY_ADDRESS` | Legal pages (GDPR required) |
| Social links | `NEXT_PUBLIC_SOCIAL_*` | Leave empty to hide icons |
| Email logos | `EMAIL_LOGO_URL` + `EMAIL_WORDMARK_URL` | Used in all transactional emails |
| Currency | `STORE_CURRENCY` | Passed to Stripe and displayed |
| Store logos | Replace files in `frontend/public/brand/` | SVG files for UI |
| i18n text | Edit `frontend/messages/{en,es,de}.json` | Long-form brand descriptions |

---

## Quick Rebrand (`.env` changes only)

```bash
# Core identity
NEXT_PUBLIC_SITE_NAME=Acme Store
NEXT_PUBLIC_SITE_TAGLINE=Your tagline here
NEXT_PUBLIC_BASE_URL=https://acme.store
STORE_DOMAIN=acme.store

# Emails
STORE_CONTACT_EMAIL=hello@acme.store
STORE_SUPPORT_EMAIL=support@acme.store
STORE_LEGAL_EMAIL=legal@acme.store
STORE_PRIVACY_EMAIL=privacy@acme.store
STORE_NOREPLY_EMAIL=noreply@acme.store
ADMIN_EMAIL=admin@acme.store

# Company (for legal pages)
STORE_COMPANY_NAME=Acme GmbH
STORE_COMPANY_ADDRESS=Hauptstraße 1, 10115 Berlin, Germany
STORE_COMPANY_COUNTRY=DE

# Social (leave empty to hide)
NEXT_PUBLIC_SOCIAL_INSTAGRAM=https://instagram.com/acme.store
NEXT_PUBLIC_SOCIAL_TWITTER=
NEXT_PUBLIC_SOCIAL_FACEBOOK=
```

After changing `.env`, rebuild frontend and admin:
```bash
docker compose build frontend admin
./start.sh --public
```

---

## Logo Files

Replace these SVG files in `frontend/public/brand/`:

| File | Used in | Size |
|------|---------|------|
| `logo-mark-dark.svg` | Light backgrounds (nav, header) | 44×34px recommended |
| `logo-mark-white.svg` | Dark backgrounds (chat header) | 44×34px recommended |
| `logo-wordmark-dark.svg` | Light backgrounds (full logo) | 160×20px recommended |
| `logo-wordmark-white.svg` | Dark backgrounds (full logo) | 160×20px recommended |

> SVG format strongly recommended — crisp at any screen density.

---

## Email Logos

Emails are sent externally and cannot use relative paths. Upload your logos to:

**Option A: Supabase Storage (easiest)**

1. Go to your Supabase project → Storage → Create bucket `marketing` (public)
2. Upload your logo to: `marketing/email/logo-mark-white.png`
3. Upload your wordmark to: `marketing/email/logo-wordmark-white.png`
4. The system finds them automatically from `SUPABASE_URL`

**Option B: Custom CDN**

Set the full public URLs in `.env`:
```bash
EMAIL_LOGO_URL=https://cdn.yourdomain.com/email/logo-mark-white.png
EMAIL_WORDMARK_URL=https://cdn.yourdomain.com/email/logo-wordmark-white.png
```

> Files must be HTTPS and publicly accessible. Gmail blocks HTTP images.

---

## i18n Text (Long-form content)

The following pages contain brand-specific text that you should update:

- `frontend/messages/en.json` → `about`, `faq`, `storeName` references
- `frontend/messages/es.json` → same keys in Spanish
- `frontend/messages/de.json` → same keys in German

Search for `{storeName}` in these files — that placeholder is replaced at render time
with your `NEXT_PUBLIC_SITE_NAME` value.

For the `about` and `storyP1` sections (your brand story), edit the text directly:

```json
// frontend/messages/en.json
"about": {
  "title": "About {storeName}",
  "storyP1": "Your brand story here...",
  "whyTitle": "Why Choose {storeName}?"
}
```

---

## MCP Server OAuth Client

Update your production store's OAuth redirect URI in `.env`:

```bash
MCP_REGISTERED_CLIENTS={"my-store":{"name":"My Store","redirect_uris":["https://yourdomain.com/*/auth/mcp-callback"],"scopes":["read","write"],"type":"public"}}
```

---

## Colors and Theme

The default theme uses neutral CSS variables in Tailwind v4. To customize:

Edit `frontend/src/app/globals.css` — the `:root` and `.dark` blocks define all semantic color tokens:

```css
:root {
  --primary: oklch(0.45 0.12 30);        /* main brand color */
  --primary-foreground: oklch(0.98 0 0); /* text on primary */
  /* ... */
}
```

> The design system uses semantic tokens (bg-primary, text-muted-foreground, etc.)
> throughout all components — change the CSS vars and the whole UI updates.

---

## Removing Specific Features

| Feature | How to disable |
|---------|---------------|
| Voice input | Remove `VoiceInput` component from `ChatInput.tsx` |
| MCP server | Remove `mcp-server` from `docker-compose.yml` services |
| PodClaw agents | Remove `podclaw` from `docker-compose.yml` |
| Premium plan | Remove `STRIPE_PREMIUM_PRICE_ID` and related UI |
| WhatsApp | Leave `WHATSAPP_ACCESS_TOKEN` empty |
| Telegram | Leave `TELEGRAM_BOT_TOKEN` empty |

---

## Adding Languages

The platform supports next-intl with 3 locales by default (en, es, de).

To add a new locale:

1. Add to `SUPPORTED_LOCALES` in `.env`: `en,es,de,fr`
2. Create `frontend/messages/fr.json` (copy from `en.json` and translate)
3. Update `frontend/src/i18n/routing.ts` to include `'fr'`
4. Rebuild: `docker compose build frontend`
