# Printful API — Shipping Rate API

**Source:** https://developers.printful.com/docs/#tag/Shipping-Rate-API
**Fetched:** 2026-03-02

---

## Overview

The Shipping Rate API calculates shipping costs for a given recipient address and set of items. Use this at checkout to show customers accurate shipping costs before order creation.

**Authentication:** Required (Bearer token)
**Rate limit:** 120 requests per minute

---

## Endpoints

### POST /shipping/rates — Calculate Shipping Rates

**URL:** `POST https://api.printful.com/shipping/rates`

**Example Request:**
```bash
curl --request POST 'https://api.printful.com/shipping/rates' \
  --header 'Authorization: Bearer {token}' \
  --header 'Content-Type: application/json' \
  --data '{
    "recipient": {
      "address1": "Unter den Linden 1",
      "city": "Berlin",
      "country_code": "DE",
      "zip": "10117"
    },
    "items": [
      {
        "variant_id": 4011,
        "quantity": 1
      }
    ],
    "currency": "EUR",
    "locale": "de_DE"
  }'
```

**Request Body:**

```json
{
  "recipient": {
    "address1": "string",
    "address2": "string",
    "city": "string",
    "country_code": "string",
    "state_code": "string",
    "zip": "string"
  },
  "items": [
    {
      "variant_id": 4011,
      "sync_variant_id": 789012,
      "external_variant_id": "your-variant-id",
      "warehouse_product_variant_id": null,
      "quantity": 1,
      "value": "29.99"
    }
  ],
  "currency": "EUR",
  "locale": "de_DE"
}
```

**recipient Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `address1` | string | Yes | Street address |
| `address2` | string | No | Address line 2 |
| `city` | string | Yes | City |
| `country_code` | string | Yes | ISO 3166-1 alpha-2 (e.g., `DE`, `FR`, `ES`) |
| `state_code` | string | Conditional | Required for US, CA, AU |
| `zip` | string | Yes | Postal code |

**items Array — Each Item:**

| Field | Type | Required | Description |
|---|---|---|---|
| `variant_id` | integer | Yes* | Printful catalog variant ID |
| `sync_variant_id` | integer | No* | Your sync variant ID (alternative to variant_id) |
| `external_variant_id` | string | No | Your external variant ID |
| `quantity` | integer | Yes | Number of units |
| `value` | string | No | Retail value per item (for insurance/customs purposes) |

*Either `variant_id` or `sync_variant_id` is required.

**Top-level Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `currency` | string | No | Currency code for returned rates (e.g., `EUR`, `USD`) |
| `locale` | string | No | Locale for localized method names (e.g., `de_DE`) |

---

**Response:**
```json
{
  "code": 200,
  "result": [
    {
      "id": "STANDARD",
      "name": "Flat Rate (3-7 business days after fulfillment)",
      "rate": "3.99",
      "currency": "EUR",
      "minDeliveryDays": 3,
      "maxDeliveryDays": 7,
      "minDeliveryDate": "2026-03-07",
      "maxDeliveryDate": "2026-03-11"
    },
    {
      "id": "EXPRESS",
      "name": "DHL Express (1-3 business days after fulfillment)",
      "rate": "14.99",
      "currency": "EUR",
      "minDeliveryDays": 1,
      "maxDeliveryDays": 3,
      "minDeliveryDate": "2026-03-05",
      "maxDeliveryDate": "2026-03-07"
    }
  ]
}
```

**Response Rate Object Fields:**

| Field | Type | Description |
|---|---|---|
| `id` | string | Shipping rate ID — use this in order creation as `shipping` value |
| `name` | string | Display name for the shipping method |
| `rate` | string | Shipping cost amount |
| `currency` | string | Currency of the rate |
| `minDeliveryDays` | integer | Minimum delivery days (business days, post-fulfillment) |
| `maxDeliveryDays` | integer | Maximum delivery days (business days, post-fulfillment) |
| `minDeliveryDate` | string | Estimated earliest delivery date (ISO 8601) |
| `maxDeliveryDate` | string | Estimated latest delivery date (ISO 8601) |

---

## Available Shipping Methods (EU Context)

Based on Printful's EU fulfillment from Latvia:

| Rate ID | Method | Typical EU Delivery | Notes |
|---|---|---|---|
| `STANDARD` | Standard Flat Rate | 5-10 business days | Most affordable |
| `ECONOMY` | Economy | 7-14 business days | Cheapest option |
| `EXPRESS` | DHL/FedEx Express | 2-4 business days | Premium cost |
| `OVERNIGHT` | Overnight | 1 day | US only |

> Note: Available shipping methods vary by destination country. Always call `/shipping/rates` to get current, accurate options.

---

## EU Shipping Notes

### EU Fulfillment Center

Printful fulfills EU orders from their facility in **Riga, Latvia** (and potentially additional EU locations). This means:

- Orders to EU countries are fulfilled within the EU
- No import duties for EU customers (goods stay within EU)
- Faster shipping times for EU destinations compared to US fulfillment

### EU Countries Supported

All 27 EU member states plus Norway, Switzerland, UK, and other European countries. Use `GET /countries` to get the complete list.

### VAT Considerations

- Printful handles production/fulfillment VAT
- You are responsible for charging and remitting VAT to your EU customers
- For orders over EUR 150 shipped from outside the EU, IOSS registration may be required
- Since Printful fulfills EU orders from within the EU, IOSS generally does not apply

### Delivery Time Note

`minDeliveryDays` and `maxDeliveryDays` are **post-fulfillment** days. Add Printful's production time (typically 2-5 business days) to get the total estimated delivery time to your customer.

**Total delivery estimate formula:**
```
Total = avg_fulfillment_time (from catalog product) + maxDeliveryDays
Example: 3 days production + 7 days shipping = 10 days total
```

---

## Countries API

### GET /countries — Get Country List

**URL:** `GET https://api.printful.com/countries`

Returns all countries Printful ships to, with state/region data where applicable.

**Example Request:**
```bash
curl 'https://api.printful.com/countries' \
  --header 'Authorization: Bearer {token}'
```

**Response:**
```json
{
  "code": 200,
  "result": [
    {
      "code": "DE",
      "name": "Germany",
      "states": null
    },
    {
      "code": "US",
      "name": "United States",
      "states": [
        { "code": "CA", "name": "California" },
        { "code": "NY", "name": "New York" }
      ]
    }
  ]
}
```

---

## Tax Rate API

### POST /tax/rates — Calculate Tax Rate

**URL:** `POST https://api.printful.com/tax/rates`

**Request Body:**
```json
{
  "recipient": {
    "country_code": "DE",
    "state_code": null,
    "city": "Berlin",
    "zip": "10117"
  }
}
```

**Response:**
```json
{
  "code": 200,
  "result": {
    "required": true,
    "rate": 0.19,
    "shipping_taxable": false
  }
}
```

### GET /tax/countries — Get Tax Countries

**URL:** `GET https://api.printful.com/tax/countries`

Returns countries where Printful collects taxes. Use this to determine when to call `/tax/rates`.

---

## Implementation at Checkout (Next.js Pattern)

```typescript
// Calculate shipping rates for EU checkout
async function getShippingRates(
  recipient: ShippingAddress,
  cartItems: CartItem[]
): Promise<ShippingRate[]> {
  const items = cartItems.map(item => ({
    sync_variant_id: item.printfulVariantId,
    quantity: item.quantity,
    value: item.price.toString(),
  }));

  const response = await fetch('https://api.printful.com/shipping/rates', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PRINTFUL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: {
        address1: recipient.address1,
        city: recipient.city,
        country_code: recipient.countryCode,
        zip: recipient.zip,
      },
      items,
      currency: 'EUR',
      locale: 'en_US',
    }),
  });

  const data = await response.json();
  return data.result;
}
```

---

## Migration Notes: Printify vs Printful Shipping

| Feature | Printify | Printful |
|---|---|---|
| Shipping calc endpoint | Not available in API | `POST /shipping/rates` |
| Rate ID for order | Not applicable | `id` field from rates response |
| Delivery time in response | Not in shipping calc | `minDeliveryDays`, `maxDeliveryDays` |
| Tax calculation | Not available | `POST /tax/rates` |
| EU fulfillment center | Latvia (P410 Printful) | Latvia (same — Printful) |
