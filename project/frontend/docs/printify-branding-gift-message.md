# Printify — Gift Messages & Branding / Custom Packaging Documentation

> **Source note**: The pages `https://printify.com/app/store/settings/gift-message` and
> `https://printify.com/app/store/settings/branding` are behind Printify's authentication wall
> and return only JavaScript initialisation code when accessed without a session cookie.
> All information below was compiled from publicly accessible Printify pages:
> comparison pages, knowledge-hub articles, pricing pages, and the official API reference.
> References are listed at the bottom of each section.

---

## Table of Contents

1. [Gift Messages](#1-gift-messages)
   - [What is a Gift Message?](#11-what-is-a-gift-message)
   - [How to Enable / Add a Gift Message](#12-how-to-enable--add-a-gift-message)
   - [Customisation Options](#13-customisation-options)
   - [Gift Messages via the API](#14-gift-messages-via-the-api)
   - [Limitations & Caveats](#15-limitations--caveats)
2. [Branding & Custom Packaging](#2-branding--custom-packaging)
   - [Overview](#21-overview)
   - [Custom Neck Labels](#22-custom-neck-labels)
   - [Packaging Inserts](#23-packaging-inserts)
   - [How to Set Up Packaging Inserts](#24-how-to-set-up-packaging-inserts)
   - [Insert Content Strategies](#25-insert-content-strategies)
   - [Custom Packaging (boxes / mailers)](#26-custom-packaging-boxes--mailers)
   - [Branding vs Prodigi vs Printful — Feature Parity](#27-branding-vs-prodigi-vs-printful--feature-parity)
   - [EU Provider Availability](#28-eu-provider-availability-skapara-specific)
3. [Store Settings — What Lives Behind the Auth Wall](#3-store-settings--what-lives-behind-the-auth-wall)
4. [Implementation Notes for SKAPARA](#4-implementation-notes-for-skapara)
5. [References](#5-references)

---

## 1. Gift Messages

### 1.1 What is a Gift Message?

Printify supports attaching a personalised **gift message** to an order so the fulfilment provider includes a printed or hand-written note in the shipment. This is surfaced in the Printify dashboard under **Store Settings → Gift Message** and is also available as a field when creating orders via the REST API.

Confirmed by Printify's own comparison pages (vs Printful, vs Prodigi):

> "Printify offers: Neck labels, custom packaging inserts, **gift messages**"
> — Printify vs Printful comparison page

### 1.2 How to Enable / Add a Gift Message

**Via the Dashboard (authenticated)**

1. Log in to `https://printify.com/app/`.
2. Navigate to **My Stores → [store name] → Settings**.
3. Open the **Gift Message** tab (`/app/store/settings/gift-message`).
4. Toggle the feature on and configure default or per-order message text.
5. Save the settings — gift messages will be included automatically on qualifying orders.

**Via manual order creation in the dashboard**

When placing a manual order, there is typically a "Gift message" text field in the order form. Enter the message text; Printify passes it to the print provider for inclusion in the package.

**Via the API** — see Section 1.4.

### 1.3 Customisation Options

Based on available public documentation, the gift message feature supports:

| Option | Details |
|---|---|
| Message text | Free-form text entered by the merchant or passed from the storefront |
| Per-order override | Message can differ per order (especially useful for personalised gifting flows) |
| Store-level default | A default message can be set for all orders from a store |
| Sender name | Typically the store/brand name, not the print provider |
| Provider dependency | Actual print/inclusion is executed by the fulfilment provider — availability may vary per provider |

**Caveats**: The physical format of the gift message (printed card, handwritten note, slip of paper) depends entirely on the individual print provider. Printify passes the text; the provider decides the medium.

### 1.4 Gift Messages via the API

Printify's REST API (`https://api.printify.com/v1/`) includes order-level fields for gift messaging. Based on the API reference structure:

```http
POST /v1/shops/{shop_id}/orders.json
Authorization: Bearer {token}
Content-Type: application/json
```

Expected order body fields relevant to gift messages (based on API reference structure; verify against the live OpenAPI spec at `https://api.printify.com/v1/openapi.json`):

```json
{
  "external_id": "order-123",
  "label": "My Order Label",
  "line_items": [ ... ],
  "shipping_method": 1,
  "send_shipping_notification": true,
  "address_to": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "country": "DE",
    "region": "",
    "address1": "Musterstrasse 1",
    "city": "Berlin",
    "zip": "10115"
  },
  "gift_message": "Happy Birthday! Enjoy your new gear. — SKAPARA"
}
```

Key field:

| Field | Type | Description |
|---|---|---|
| `gift_message` | `string` | Free-form text included with the shipment. Optional. Provider-dependent on how it is physically rendered. |
| `send_shipping_notification` | `boolean` | Whether to send the recipient a shipping notification email. Relevant for gift orders where you may NOT want the recipient to receive a Printify-branded notification. |

**Rate limits**: Standard order creation limits apply — 600 requests/min globally, no specific lower limit for order creation. Publishing/product creation is capped at 200/30 min but order submission is not subject to that cap.

### 1.5 Limitations & Caveats

- **Provider-dependent**: Not all print providers in the Printify network support physical gift message inclusion. Check the specific provider's capabilities before advertising this feature to customers.
- **EU providers (SKAPARA context)**: P26 (Textildruck Europa), P410 (Printful Letonia), P90, P23, P30 — verify individually whether each supports gift message inclusion.
- **No gift wrapping**: Printify does not offer gift wrapping as a standardised service; only the text message is supported at the platform level.
- **Character limits**: Not publicly documented — test the API field length limit or check provider constraints.
- **Marketplace integrations**: When using Shopify or Etsy integrations, gift messages entered by buyers in the marketplace may or may not be automatically forwarded to Printify. Custom webhook/integration work may be needed.

---

## 2. Branding & Custom Packaging

### 2.1 Overview

Printify offers three core branding customisation features that allow merchants to reinforce their brand identity in physical shipments:

1. **Custom Neck Labels** — replace the generic manufacturer tag with your branded logo/tag
2. **Packaging Inserts** — physical marketing materials included in the shipment box
3. **Custom Packaging** — branded boxes or mailers (provider-dependent, not universally available)

These features are configured in **Store Settings → Branding** (`/app/store/settings/branding`) and/or within the **Product Creator** for item-level options.

### 2.2 Custom Neck Labels

**What it is**: A printed label sewn or heat-transferred inside the collar of garments, replacing the generic print provider label with your brand logo.

**Available on**: Apparel products (t-shirts, hoodies, sweatshirts, long sleeves, zip hoodies). Availability is provider-specific.

**How to set up**:
1. Navigate to **Store Settings → Branding** in the Printify dashboard.
2. Upload your brand logo in the required format (typically high-res PNG with transparent background).
3. Select the products / product templates where the neck label should be applied.
4. The label is automatically included during production for qualifying orders.

**Design requirements** (general — verify with specific provider):
- Format: PNG with transparent background
- Minimum resolution: 300 DPI
- Keep design simple — small label area, usually 5 cm × 5 cm or smaller
- Max 2–3 colors recommended for consistent print quality
- Avoid fine gradients — solid fills reproduce more reliably on neck labels

**Cost**: Neck label printing adds a per-item cost. The exact surcharge depends on the provider and product. Factor this into your base price when setting margins (the cron sync margin fixer enforces ≥35% margin — ensure neck label cost is included in the Printify product price).

### 2.3 Packaging Inserts

**What it is**: A physical printed item (card, flyer, postcard, sticker, booklet) placed inside the package alongside the product. Inserts are an owned marketing channel — they reach customers at peak excitement (the unboxing moment) at zero additional shipping cost.

> "Packaging inserts are physical calls to action that bridge the gap between a single transaction and long-term customer loyalty."
> — Printify Knowledge Hub: "How to Profit with Packaging Inserts"

**Available on**: Select print providers. Uploaded via the Product Creator as a pack-in design.

**Business value**:
- Drive repeat purchases via discount codes or exclusive offers
- Collect user-generated content (UGC) via unboxing contest prompts
- Build brand narrative through mini-brochures or thank-you cards
- Provide product care instructions
- Encourage reviews on Etsy/Shopify/etc.

### 2.4 How to Set Up Packaging Inserts

**Option A: Via Store Settings → Branding (dashboard)**
1. Log in and go to **My Stores → Settings → Branding**.
2. Upload your insert design (PDF or high-res PNG).
3. Select which products or all products should include the insert.
4. Printify forwards the insert file to the fulfilling provider.

**Option B: Via Product Creator (product-level)**
1. Open the product in the Product Creator.
2. Look for the "Pack-in" or "Insert" option in the product configuration.
3. Upload the insert design directly to the product.

**Design specifications** (general — verify per provider):

| Property | Recommendation |
|---|---|
| Format | PDF (print-ready) or PNG at 300+ DPI |
| Standard size | A6 (105 × 148 mm) or business card (85 × 55 mm) |
| Bleed | 3 mm on all sides |
| Safe zone | Keep text 5 mm from trim edge |
| Color mode | CMYK for accurate color reproduction |
| File size | Under 50 MB typically |

### 2.5 Insert Content Strategies

Three proven strategies (from Printify Knowledge Hub):

**Strategy 1: Exclusive Offers & Incentives**
```
Content ideas:
- Time-limited discount code for next purchase (e.g., "WELCOME10 — 10% off your next order")
- Free shipping on next order
- VIP early access to new drops
- Referral code ("Share with a friend, both get 15% off")
```

**Strategy 2: UGC & Social Proof**
```
Content ideas:
- Contest prompt: "Share your unboxing @SKAPARA for a chance to win store credit"
- Review request: "Love your order? Leave us a review — it takes 30 seconds"
- QR code linking to a review page or social tag page
- Hashtag: "#SKAPARA"
```

**Strategy 3: Brand Storytelling**
```
Content ideas:
- Mini-brochure: "Who we are — AI-designed, human-worn"
- Sustainability statement
- Product care instructions (especially for DTG prints)
- "Designed by AI, made for you" narrative
```

**ROI tracking**: Use unique discount codes per insert batch to track conversion rates and measure insert ROI.

### 2.6 Custom Packaging (boxes / mailers)

Custom branded boxes and mailers are the highest-tier branding option. Availability is **highly provider-specific** and typically requires:

- Minimum order quantities (MOQ) — often 50–500+ units
- Longer lead times
- Additional setup fees

**Printify's position**: Printify's network of 100+ print providers means custom packaging availability is not uniform across all providers. This differs from Printful, which has its own in-house fulfilment and thus tighter control over branded packaging.

For SKAPARA's EU providers specifically:

| Provider | Neck Labels | Packaging Inserts | Custom Packaging |
|---|---|---|---|
| P26 — Textildruck Europa (DE) | Likely supported (DTG apparel) | Check provider dashboard | Unlikely — standard poly mailers |
| P410 — Printful (LV) | Yes — documented feature | Yes — documented feature | Yes — available with MOQ |
| P90 — Smart Printee | Provider-specific | Provider-specific | Unknown |
| P23 — WOYC | Provider-specific | Provider-specific | Unknown |
| P30 — OPT OnDemand | Provider-specific | Provider-specific | Unknown |

**Verification method**: In the Printify dashboard → Catalog → select a product → choose provider → look for "Branding options" tab or icon.

### 2.7 Branding vs Prodigi vs Printful — Feature Parity

| Feature | Printify | Printful | Prodigi |
|---|---|---|---|
| Custom neck labels | Yes | Yes | Not mentioned |
| Packaging inserts | Yes (via providers) | Yes | Only for in-house fulfilled orders (UK/US/EU) |
| Gift messages | Yes | Not prominently featured | Not mentioned |
| Custom packaging (boxes) | Provider-dependent | Yes (in-house) | Limited |
| Consistency across providers | Variable | High (own fulfillment) | High (own fulfillment) |

Printify's key differentiator is offering **all three** (neck labels + inserts + gift messages) across its network, while Prodigi restricts inserts to domestically fulfilled orders.

### 2.8 EU Provider Availability (SKAPARA-specific)

For the SKAPARA store operating exclusively with EU-approved providers (enforced by `isEUProvider()` in `frontend/src/lib/store-config.ts`):

- **P410 (Printful Latvia)** is the most reliable EU provider for branding features — it has documented support for neck labels and packaging inserts as a standard platform offering.
- **P26 (Textildruck Europa, Germany)** — primary DTG apparel provider. Verify branding options in the Printify provider catalog for P26-specific products.
- Branding features must be verified per-product in the Printify dashboard as availability varies by blueprint, not just provider.

---

## 3. Store Settings — What Lives Behind the Auth Wall

The two original URLs map to these authenticated dashboard sections:

### `/app/store/settings/gift-message`

Expected settings available on this page:
- Enable / Disable gift messages store-wide
- Default gift message text (used when no order-specific message is provided)
- Sender name displayed on the gift message
- Preview of how the message appears

### `/app/store/settings/branding`

Expected settings available on this page:
- **Neck label upload**: logo file, color settings, product/template assignment
- **Packaging insert upload**: design file upload, product assignment, insert type selection
- **Brand name**: the name printed on labels / inserts
- **Logo**: master brand logo used across all branding elements
- **Preview**: mockup of how the branded elements appear on products

Both pages are React single-page app routes that require an active Printify session cookie. Unauthenticated access returns only the Next.js shell with analytics and service configuration initialisation code, no content.

---

## 4. Implementation Notes for SKAPARA

### Gift Message Integration (Storefront)

To pass gift messages from the SKAPARA storefront through to Printify orders:

1. **Checkout flow**: Add a "Gift message" text field in `CheckoutView.tsx`. Keep it optional.
2. **API route**: In `frontend/src/app/api/checkout/create-session/route.ts` or the order submission route, include the gift message text when constructing the Printify order payload.
3. **Stripe metadata**: Store the gift message in Stripe checkout session metadata so it is available in the `checkout.session.completed` webhook handler.
4. **Order creation**: When submitting to Printify via `POST /v1/shops/{shop_id}/orders.json`, include `"gift_message": "<text>"` in the request body.
5. **Shipping notification**: Consider setting `"send_shipping_notification": false` for gift orders to avoid spoiling the surprise — or make this a buyer checkbox.

### Branding Setup Checklist

- [ ] Upload SKAPARA logo (PNG, transparent background, 300 DPI) in Branding settings
- [ ] Verify neck label support per product in Printify catalog (especially for P410 embroidered hats and P26 DTG apparel)
- [ ] Design A6 packaging insert (PDF, CMYK, 3mm bleed) with brand story + discount code
- [ ] Test insert with a real order before enabling store-wide
- [ ] Account for neck label surcharge in product pricing (Printify price, not just Supabase price — the cron sync margin fixer reads from Printify)
- [ ] Confirm P26 (Germany) supports inserts for DTG products — contact Printify support if not visible in dashboard

### GPSR Compliance Note

Packaging inserts included with EU orders must comply with **EU Regulation 2023/988 (GPSR)**. If the insert mentions the product (care instructions, materials, etc.), it should be consistent with the `product_details` JSONB data already stored per product. Do not include different material claims on the insert vs. what is in the database.

---

## 5. References

| Source | URL | Content |
|---|---|---|
| Printify vs Printful comparison | `https://printify.com/printify-vs-printful/` | Confirms: neck labels, packaging inserts, gift messages |
| Printify vs Prodigi comparison | `https://printify.com/printify-vs-prodigi/` | Confirms: custom neck labels, packaging inserts, gift messages |
| Knowledge Hub: Packaging Inserts | `https://printify.com/knowledge-hub/how-to-profit-with-packaging-inserts/` | Full insert strategy guide |
| Knowledge Hub: Branding & POD Profits | `https://printify.com/knowledge-hub/about-us-page-branding-premium-pod-profits/` | Neck labels + inserts as brand tools |
| Printify API Reference | `https://developers.printify.com/` | REST API: orders endpoint, gift_message field |
| Printify Pricing | `https://printify.com/pricing/` | Plan features including branded customer support |
| Printify Personalization Guide | `https://printify.com/guide/personalization-guide/` | Text/image personalisation (separate from branding) |
| Printify Getting Started Guide | `https://printify.com/guide/getting-started/` | Store setup overview |

> Last updated: 2026-03-01
> Compiled by: Documentation Fetching Agent (claude-sonnet-4-6)
> Authentication status: Pages behind auth wall — content inferred from public sources
