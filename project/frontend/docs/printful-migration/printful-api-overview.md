# Printful API — Overview

**Source:** https://developers.printful.com/docs/
**Fetched:** 2026-03-02

---

## What Is the Printful API?

The Printful API is a full-featured RESTful API that accepts and returns data in JSON format. It enables developers to integrate print-on-demand fulfillment directly into their applications — automating order submission, managing product catalogs, generating mockups, and receiving real-time event notifications.

**Base URL:** `https://api.printful.com/`

All HTTP methods are supported: `GET`, `POST`, `PUT`, `DELETE`.

---

## Authentication Overview

Two authentication models are supported:

| Mode | Use Case |
|---|---|
| **Private Token** | Personal store integration, internal tools, direct API access |
| **Public App (OAuth 2.0)** | Third-party apps serving multiple Printful users |

All authenticated requests require:
```
Authorization: Bearer {token}
```

For account-level tokens (access to all stores under one account):
```
X-PF-Store-Id: {store_id}
```

See `printful-authentication.md` for full details.

---

## Response Format

All API responses are JSON with a consistent envelope:

```json
{
  "code": 200,
  "result": { ... },
  "extra": [],
  "paging": {
    "total": 100,
    "offset": 0,
    "limit": 20
  }
}
```

| Field | Description |
|---|---|
| `code` | HTTP status code (mirrors the HTTP response status) |
| `result` | Data payload on success; error object on failure |
| `extra` | Additional metadata (usually empty array) |
| `paging` | Present on paginated responses |

### Error Response

```json
{
  "code": 404,
  "result": {
    "reason": "NotFound",
    "message": "Product not found"
  }
}
```

**Error HTTP status codes:**

| Code | Meaning |
|---|---|
| 400 | Bad Request — malformed request body or missing fields |
| 401 | Unauthorized — missing or invalid token |
| 403 | Forbidden — valid token but insufficient scope |
| 404 | Not Found — resource does not exist |
| 429 | Too Many Requests — rate limit exceeded |
| 5xx | Server error on Printful side |

---

## Rate Limiting

- **General limit:** 120 API calls per minute
- **Resource-intensive endpoints** (Mockup Generator): significantly lower limit
- **Catalog API (unauthenticated):** up to 30 requests per 60 seconds; 60-second lockout if exceeded
- Exceeding limits returns HTTP 429

---

## Pagination

Paginated endpoints support:

| Parameter | Type | Description |
|---|---|---|
| `offset` | integer | Number of items to skip from start (default: 0) |
| `limit` | integer | Number of items per page (default varies by endpoint) |

Response `paging` object contains `total`, `offset`, `limit`.

---

## Timestamps

All timestamps in API responses are returned as **UNIX timestamps** (integer seconds since epoch).

---

## Localization

Use the `X-PF-Language` header to request localized responses:

| Header Value | Language |
|---|---|
| `en_US` | English (United States) — default |
| `es_ES` | Spanish |
| `fr_FR` | French |
| `de_DE` | German |
| `it_IT` | Italian |
| `ja_JP` | Japanese |
| `pt_BR` | Portuguese (Brazil) |
| `ko_KR` | Korean |

---

## API Sections

| API | Path Prefix | Auth Required | Description |
|---|---|---|---|
| Catalog API | `/products` | No (public) | Browse Printful's product catalog |
| Products API | `/sync_products` | Yes | Manage store sync products |
| Orders API | `/orders` | Yes | Create and manage orders |
| File Library API | `/files` | Yes | Upload and manage design files |
| Shipping Rate API | `/shipping/rates` | Yes | Calculate shipping costs |
| Tax Rate API | `/tax/rates` | Yes | Calculate tax obligations |
| Webhook API | `/webhooks` | Yes | Configure event notifications |
| Mockup Generator API | `/mockup-generator` | Yes | Generate product preview images |
| Store Information API | `/store` | Yes | Store settings and packing slips |
| Countries API | `/countries` | Yes | List countries with state/region data |
| Reports API | `/reports/stats` | Yes | Store analytics and statistics |
| Approval Sheets API | `/approval-sheets` | Yes | Design approval workflow |
| Warehouse Products API | `/warehouse-products` | Yes | Inventory management |
| Ecommerce Platform Sync | `/ecommerce` | Yes | Direct platform integrations |
| Product Templates | `/product-templates` | Yes | Saved design templates |

---

## Key Architectural Notes for Migration from Printify

1. **Variant IDs are critical:** "It is critically important to always refer to the Variant IDs (NOT Product IDs) when creating orders or sync products." This is different from Printify where Blueprint IDs are primary.

2. **No Shop ID in path:** Unlike Printify (`/v1/shops/{shop_id}/products.json`), Printful uses store context via token or `X-PF-Store-Id` header — no shop ID in the URL.

3. **Sync Products vs Catalog:** Printful separates the *catalog* (what they can print, via `/products`) from *your store products* (sync products, via `/sync_products`). You create sync products that map to catalog variants.

4. **Draft → Confirm flow:** Orders can be created as drafts first, then confirmed for fulfillment with `POST /orders/{id}/confirm`. Or created and immediately confirmed.

5. **Token expiration:** Private tokens DO have an expiration date (unlike Printify tokens). Monitor and rotate before expiry.

6. **Base URL difference:**
   - Printify: `https://api.printify.com/v1`
   - Printful: `https://api.printful.com` (no `/v1`)

---

## Developer Portal

- **Portal:** https://developers.printful.com/
- **Docs:** https://developers.printful.com/docs/
- Generate private tokens and manage OAuth apps from the portal dashboard.
