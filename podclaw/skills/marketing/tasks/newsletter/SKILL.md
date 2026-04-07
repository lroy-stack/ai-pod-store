<!-- triggers: newsletter, suscriptores, email campaign, promocional, subscribers, coupon, cupon, descuento -->
<!-- description: Compose and send locale-aware newsletter campaigns with product highlights and discount codes -->

# Newsletter Campaign — Task Skill

## EFFICIENCY: Maximum 10 tool calls total

This skill should complete in 8-10 tool calls:
1-2: Read templates (FIRST — before anything else)
3-5: Data queries (subscribers, coupons, products)
6-10: Send emails (one per subscriber, sequentially)

Do NOT use Grep, Glob, WebFetch, or Agent tools. You have all the data
you need from 2 template reads + 3 supabase queries.

---

## Phase 1: LOAD TEMPLATES (execute FIRST — before ANY queries)

You MUST read both templates before doing anything else.
These templates contain the HTML structure you will use. Do NOT skip this step.

1. Read file: `/app/podclaw/templates/email/newsletter-promo.html`
2. Read file: `/app/podclaw/templates/email/layout.html`

## STOP — VERIFY TEMPLATES LOADED

Before proceeding to data queries, confirm:
1. You have the content of `newsletter-promo.html` (contains `class="mob-pad"`)
2. You have the content of `layout.html` (contains `{{CONTENT}}`)

If EITHER Read failed or was skipped: Read them NOW. Do NOT proceed without them.

**FORBIDDEN**: Writing `<table>`, `<td>`, `background-color`, `font-family` from scratch.
ALL HTML structure MUST come from the template files. You ONLY replace `{{VARIABLE}}` placeholders.

---

## Phase 2: Data Discovery (execute ALL 3 queries BEFORE composing)

You MUST run these 3 queries using `supabase_query` before composing any email.
Do NOT invent subscriber data, coupon codes, or product names. Use ONLY real query results.

### Query 1: Get subscribers
Table: `newsletter_subscribers`
Select: `email, locale, user_id`
Filter: `subscribed = true` and `confirmed_at IS NOT NULL`

Then for each subscriber, query `users` table with their `user_id` to get `name`.

If 0 subscribers → STOP and tell the CEO: "No hay suscriptores activos."

### Query 2: Get active coupons
Table: `coupons`
Filter: `active = true`
Select: `code, discount_type, discount_value, valid_until`

### Query 3: Get products for hero/featured
Table: `products`
Filter: `status = active`
Select: `id, title, base_price_cents, images`
Order by: `created_at DESC`
Limit: 5

The `images` column is a JSONB array. Each element: `{"src": "https://...", "alt": "..."}`
Hero image URL = first element's `src` field.
Example: `https://api.yourdomain.com/storage/v1/object/public/designs/mockups/product-name/black-front.png`
These are small (~500 bytes). Safe to include in the query select.

---

## Phase 3: Compose HTML per locale

Templates are already loaded from Phase 1. Do NOT Read them again.
Do NOT compose HTML from scratch — use ONLY the templates you loaded.

Replace ALL `{{VARIABLE}}` placeholders with real data from Phase 2 queries.

### newsletter-promo.html variables:
- `{{HERO_IMAGE_URL}}` → hero product images[0].src
- `{{HERO_PRODUCT_NAME}}` → hero product title
- `{{HERO_PRODUCT_PRICE}}` → EUR formatted (base_price_cents / 100, e.g. "34,99 EUR")
- `{{HERO_LINK}}` → `https://yourdomain.com/{locale}/shop`
- `{{HEADLINE}}` → locale-aware headline
- `{{BODY}}` → 1-3 sentences promotional text in subscriber's language
- `{{RECIPIENT_NAME}}` → subscriber name, or "Hola"/"Hi"/"Hallo"
- `{{PRODUCT_1_IMAGE}}` → second product images[0].src
- `{{PRODUCT_1_NAME}}` → second product title
- `{{PRODUCT_1_PRICE}}` → EUR formatted
- `{{PRODUCT_1_LINK}}` → `https://yourdomain.com/{locale}/shop`
- `{{PRODUCT_2_IMAGE}}` → third product images[0].src
- `{{PRODUCT_2_NAME}}` → third product title
- `{{PRODUCT_2_PRICE}}` → EUR formatted
- `{{PRODUCT_2_LINK}}` → `https://yourdomain.com/{locale}/shop`
- `{{DISCOUNT_CODE}}` → coupon code
- `{{DISCOUNT_TEXT}}` → locale-aware (e.g., "Usa este codigo para 20% de descuento")
- `{{CTA_TEXT}}` → "Shop Now" / "Comprar ahora" / "Jetzt kaufen"
- `{{CTA_URL}}` → `https://yourdomain.com/{locale}/shop`

### layout.html variables:
- `{{CONTENT}}` → the composed newsletter-promo HTML (with all vars replaced)
- `{{LOCALE}}` → subscriber locale (en/es/de)
- `{{SUPABASE_PUBLIC_URL}}` → env var `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `{{BASE_URL}}` → env var `NEXT_PUBLIC_BASE_URL`
- `{{RECIPIENT_EMAIL}}` → subscriber email
- `{{YEAR}}` → current year
- `{{PREHEADER}}` → short preview text for inbox
- `{{UNSUBSCRIBE_TEXT}}` → "Unsubscribe" / "Cancelar suscripcion" / "Abmelden"
- `{{BRAND_NAME}}` → env var `NEXT_PUBLIC_SITE_NAME` (store display name)
- `{{COMPANY_NAME}}` → env var `STORE_COMPANY_NAME` (legal entity name)
- `{{COMPANY_CITY}}` → first part of `STORE_COMPANY_ADDRESS` or hardcode city
- `{{COMPANY_COUNTRY}}` → last part of `STORE_COMPANY_ADDRESS` or hardcode country

The final HTML = layout.html with {{CONTENT}} = newsletter-promo.html (all vars replaced).
Pass this complete HTML as the `html` parameter to `resend_send_email`.

### Phase 4: Present to CEO OR send if authorized
If the CEO explicitly said "envia directamente", "no pidas aprobacion", or similar → skip to Phase 5.

Otherwise, show the CEO a summary:
- Number of subscribers per locale
- Subject line per locale
- Hero product used
- Coupon code included
- Say: "Responde 'aprobado' para enviar o 'cancela' para descartar."
And wait for CEO response.

### Phase 5: Send ALL subscribers
When authorized (either explicitly in the original message or via follow-up approval):

You MUST send one email per subscriber. Do NOT skip any subscriber.
Call `resend_send_email` separately for EACH subscriber:

```
For subscriber 1 (e.g., locale=es):
  resend_send_email(
    to: "subscriber1@email.com",
    subject: "Novedades + 10% de descuento" (in Spanish),
    html: composed HTML with Spanish content
  )

For subscriber 2 (e.g., locale=de):
  resend_send_email(
    to: "subscriber2@email.com",
    subject: "Neuheiten + 10% Rabatt" (in German),
    html: composed HTML with German content
  )
```

Each email MUST be in the subscriber's locale.
IMPORTANT: Send emails ONE AT A TIME sequentially. Do NOT send multiple
resend_send_email calls in parallel — parallel calls will fail.
After ALL emails are sent, report: "Enviados X/Y emails (N en, N es, N de)."
If any send fails, report which failed and why.

---

## Locale Reference

| Locale | Greeting | CTA | Unsubscribe | Subject example |
|--------|----------|-----|-------------|-----------------|
| en | Hi {name} | Shop Now | Unsubscribe | New arrivals + 10% off |
| es | Hola {name} | Comprar ahora | Cancelar suscripcion | Novedades + 10% de descuento |
| de | Hallo {name} | Jetzt kaufen | Abmelden | Neuheiten + 10% Rabatt |

## Compliance

- From: `{{BRAND_NAME}} <hello@yourdomain.com>` (configured in resend connector)
- Unsubscribe link: `https://yourdomain.com/{locale}/unsubscribe?email={email}`
- Physical address in footer (already in layout.html)
- NEVER send to `subscribed = false` or `confirmed_at IS NULL`
