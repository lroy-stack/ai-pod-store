# Printful API — Orders API

**Source:** https://developers.printful.com/docs/#tag/Orders-API
**Fetched:** 2026-03-02

---

## Overview

The Orders API manages the complete fulfillment lifecycle — creating orders, updating them, confirming them for production, and cancelling them.

**Authentication:** Required (Bearer token)
**Required Scope:** `orders` (read+write) or `orders/read` (read only)
**Rate limit:** 120 requests per minute

---

## Order Flow

```
POST /orders          →  Create order (status: draft)
POST /orders/{id}/confirm  →  Confirm for fulfillment (status: confirmed → processing → fulfilled)

-- OR --

POST /orders (with confirm: true)  →  Create + confirm in one call
POST /orders/estimate             →  Estimate costs without creating order
```

---

## Endpoints

### 1. GET /orders — List Orders

**URL:** `GET https://api.printful.com/orders`

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | string | Filter by status (draft, pending, failed, canceled, fulfilled, etc.) |
| `offset` | integer | Pagination offset |
| `limit` | integer | Items per page (max: 100) |

**Example:**
```bash
curl 'https://api.printful.com/orders?status=fulfilled&limit=20' \
  --header 'Authorization: Bearer {token}'
```

---

### 2. POST /orders — Create Order

**URL:** `POST https://api.printful.com/orders`

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `confirm` | boolean | If `true`, confirms order immediately (skips draft state) |
| `update_existing` | boolean | If `true`, updates existing order with same external_id |

**Request Body:**
```json
{
  "external_id": "your-order-id-123",
  "label": "Custom order note",
  "shipping": "STANDARD",
  "recipient": {
    "name": "Jane Doe",
    "company": "",
    "address1": "123 Main Street",
    "address2": "Apt 4B",
    "city": "Berlin",
    "state_code": "BE",
    "state_name": "Berlin",
    "country_code": "DE",
    "country_name": "Germany",
    "zip": "10115",
    "phone": "+49301234567",
    "email": "jane@example.com",
    "tax_number": "DE123456789"
  },
  "items": [
    {
      "id": "your-line-item-id",
      "external_id": "your-line-item-id",
      "variant_id": 4011,
      "sync_variant_id": 789012,
      "external_variant_id": "your-variant-id",
      "warehouse_product_variant_id": null,
      "quantity": 1,
      "price": "29.99",
      "retail_price": "29.99",
      "name": "SKAPARA Ghost Tee Black / M",
      "product": {
        "variant_id": 4011,
        "product_id": 71
      },
      "files": [
        {
          "id": 98765,
          "type": "front",
          "url": "https://your-cdn.com/design.png",
          "options": [],
          "hash": null,
          "filename": "design.png",
          "visible": true
        }
      ],
      "options": [],
      "sku": null,
      "discontinued": false,
      "out_of_stock": false
    }
  ],
  "retail_costs": {
    "currency": "EUR",
    "subtotal": "29.99",
    "discount": "0.00",
    "shipping": "3.99",
    "tax": "5.70"
  },
  "gift": {
    "subject": "A gift for you!",
    "message": "Happy Birthday! Enjoy this shirt."
  },
  "packing_slip": {
    "email": "support@skapara.com",
    "phone": "+1-555-0000",
    "message": "Thank you for shopping with SKAPARA!",
    "logo_url": "https://skapara.com/logo.png",
    "store_name": "SKAPARA",
    "custom_order_id": "ORDER-123"
  }
}
```

**recipient Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Full recipient name |
| `company` | string | No | Company name |
| `address1` | string | Yes | Street address line 1 |
| `address2` | string | No | Street address line 2 |
| `city` | string | Yes | City |
| `state_code` | string | Conditional | State/province code (required for US, CA, AU) |
| `state_name` | string | No | State/province full name |
| `country_code` | string | Yes | ISO 3166-1 alpha-2 country code (e.g., `DE`, `FR`, `ES`) |
| `country_name` | string | No | Full country name |
| `zip` | string | Yes | Postal code |
| `phone` | string | No | Phone number |
| `email` | string | No | Recipient email |
| `tax_number` | string | No | VAT/tax number (for B2B orders in EU) |

**items Array — Each Item:**

| Field | Type | Required | Description |
|---|---|---|---|
| `variant_id` | integer | Yes* | Printful catalog variant ID |
| `sync_variant_id` | integer | Yes* | Your sync variant ID (*one of variant_id or sync_variant_id required) |
| `external_variant_id` | string | No | Your external variant ID |
| `quantity` | integer | Yes | Quantity to order |
| `retail_price` | string | No | Override retail price for this item |
| `name` | string | No | Override item name |
| `files` | array | No | Override print files (for on-demand design) |
| `options` | array | No | Override options |

**shipping Values:**

| Value | Description |
|---|---|
| `STANDARD` | Standard shipping |
| `EXPRESS` | Express shipping |
| `OVERNIGHT` | Overnight (US only) |

**retail_costs Object:**

| Field | Type | Description |
|---|---|---|
| `currency` | string | Currency code (e.g., `EUR`, `USD`) |
| `subtotal` | string | Product subtotal |
| `discount` | string | Discount amount |
| `shipping` | string | Shipping cost charged to customer |
| `tax` | string | Tax amount |

**gift Object:**

| Field | Type | Description |
|---|---|---|
| `subject` | string | Gift email subject line |
| `message` | string | Gift message text (included in packing slip) |

**packing_slip Object:**

| Field | Type | Description |
|---|---|---|
| `email` | string | Support email on packing slip |
| `phone` | string | Support phone on packing slip |
| `message` | string | Custom message on packing slip |
| `logo_url` | string | Your logo URL for branded packing slip |
| `store_name` | string | Store name displayed on packing slip |
| `custom_order_id` | string | Custom order reference shown to customer |

---

### 3. GET /orders/{id} — Get Order

**URL:** `GET https://api.printful.com/orders/{id}`

Supports `@external_id` lookup: `/orders/@your-order-id-123`

**Response includes:**
- Full order details
- Current status
- Costs breakdown
- Shipment tracking information (once shipped)

---

### 4. DELETE /orders/{id} — Cancel Order

**URL:** `DELETE https://api.printful.com/orders/{id}`

Cancels an order. Only possible before production starts.

---

### 5. PUT /orders/{id} — Update Order

**URL:** `PUT https://api.printful.com/orders/{id}`

Updates order details such as shipping address. Only possible while order is in draft status.

---

### 6. POST /orders/{id}/confirm — Confirm Draft

**URL:** `POST https://api.printful.com/orders/{id}/confirm`

Transitions order from draft to confirmed, initiating fulfillment. No request body needed.

```bash
curl --request POST 'https://api.printful.com/orders/123456/confirm' \
  --header 'Authorization: Bearer {token}'
```

---

### 7. POST /orders/estimate — Estimate Costs

**URL:** `POST https://api.printful.com/orders/estimate`

Calculates costs without creating an order. Useful for showing shipping costs at checkout.

**Request Body:** Same structure as `POST /orders`.

**Response:**
```json
{
  "code": 200,
  "result": {
    "retail_costs": {
      "currency": "EUR",
      "subtotal": "29.99",
      "discount": "0.00",
      "shipping": "3.99",
      "tax": "5.70",
      "total": "39.68"
    },
    "costs": {
      "currency": "USD",
      "subtotal": "12.50",
      "discount": "0.00",
      "shipping": "4.99",
      "digitization": "0.00",
      "additional_fee": "0.00",
      "fulfillment_fee": "0.00",
      "tax": "0.00",
      "vat": "0.00",
      "total": "17.49"
    }
  }
}
```

---

## Order Object Schema

```json
{
  "id": 123456,
  "external_id": "your-order-id-123",
  "store": 12345,
  "status": "fulfilled",
  "shipping": "STANDARD",
  "shipping_service_name": "DHL Express",
  "created": 1677700000,
  "updated": 1677800000,
  "recipient": { ... },
  "items": [ ... ],
  "branding_items": [],
  "incomplete_items": [],
  "costs": {
    "currency": "USD",
    "subtotal": "12.50",
    "discount": "0.00",
    "shipping": "4.99",
    "digitization": "0.00",
    "additional_fee": "0.00",
    "fulfillment_fee": "0.00",
    "tax": "0.00",
    "vat": "2.75",
    "total": "20.24"
  },
  "retail_costs": {
    "currency": "EUR",
    "subtotal": "29.99",
    "discount": "0.00",
    "shipping": "3.99",
    "tax": "5.70",
    "total": "39.68"
  },
  "pricing_breakdown": [ ... ],
  "shipments": [
    {
      "id": 1,
      "carrier": "DHL",
      "service": "Express",
      "tracking_number": "1Z999AA1012345678",
      "tracking_url": "https://www.dhl.com/...",
      "created": 1677800000,
      "ship_date": "2026-03-02",
      "shipped_at": 1677800000,
      "reshipment": false,
      "items": [ ... ]
    }
  ],
  "gift": null,
  "packing_slip": null
}
```

## Order Status Values

| Status | Description |
|---|---|
| `draft` | Order created but not confirmed |
| `failed` | Order processing failed |
| `pending` | Order confirmed, awaiting fulfillment |
| `canceled` | Order cancelled |
| `onhold` | Order on hold |
| `inprocess` | Currently in production |
| `partial` | Partially shipped |
| `fulfilled` | Fully shipped |
| `archived` | Archived order |

---

## EU-Specific Notes

### VAT Handling

- Printful handles **VAT collection** for EU B2C orders automatically in many cases
- The `vat` field in `costs` represents VAT charged to Printful for production
- The `tax` field in `retail_costs` is the tax you charge your customer
- For EU orders, Printful may collect VAT via **IOSS** (Import One-Stop Shop) depending on order value and origin

### Recipient Tax Number

- For B2B EU orders, include `tax_number` in the recipient object (VAT registration number)
- Format: `DE123456789` (country code prefix + VAT number)

### Currency

- Printful charges you in your account's billing currency
- `retail_costs.currency` can be set to your customer-facing currency (e.g., EUR)
- `costs.currency` reflects your Printful billing currency

### EU Country Codes (ISO 3166-1 alpha-2)

Common EU countries for recipient:
```
DE = Germany    FR = France     ES = Spain      IT = Italy
NL = Netherlands  BE = Belgium  PL = Poland     SE = Sweden
AT = Austria    DK = Denmark    FI = Finland    PT = Portugal
```

---

## Migration Notes: Printify vs Printful Orders

| Feature | Printify | Printful |
|---|---|---|
| Create order endpoint | `POST /v1/shops/{id}/orders.json` | `POST /orders` |
| Order items reference | `print_provider_id` + `blueprint_id` + `variant_id` | `variant_id` (catalog) or `sync_variant_id` |
| Draft → confirm | No draft concept (direct) | Explicit `confirm` step or `?confirm=true` |
| Custom packing slip | Via dashboard branding | `packing_slip` object in request body |
| Gift messages | `gift_message` field | `gift.message` object |
| Cost estimate | No equivalent documented | `POST /orders/estimate` |
| External ID lookup | Not documented | `@external_id` prefix on GET/DELETE/PUT |
| Tracking | Webhook only | In order object + webhook |
