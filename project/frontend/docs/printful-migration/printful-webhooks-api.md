# Printful API — Webhook API

**Source:** https://developers.printful.com/docs/#tag/Webhook-API
**Fetched:** 2026-03-02

---

## Overview

Webhooks allow Printful to send real-time event notifications to your server when specific events occur (order status changes, shipments, stock updates, etc.).

**Authentication:** Required (Bearer token)
**Required Scope:** `webhooks` (read+write) or `webhooks/read` (read only)

---

## Endpoints

### 1. GET /webhooks — Get Webhook Configuration

**URL:** `GET https://api.printful.com/webhooks`

Returns the current webhook configuration for your store.

**Example Request:**
```bash
curl 'https://api.printful.com/webhooks' \
  --header 'Authorization: Bearer {token}'
```

**Response:**
```json
{
  "code": 200,
  "result": {
    "url": "https://your-store.com/api/webhooks/printful",
    "types": [
      "package_shipped",
      "order_created",
      "order_updated",
      "stock_updated"
    ]
  }
}
```

---

### 2. POST /webhooks — Set Up Webhook

**URL:** `POST https://api.printful.com/webhooks`

Configures (or replaces) the webhook endpoint and subscribed event types.

**Request Body:**
```json
{
  "url": "https://your-store.com/api/webhooks/printful",
  "types": [
    "package_shipped",
    "package_returned",
    "order_created",
    "order_updated",
    "order_failed",
    "order_canceled",
    "product_synced",
    "product_updated",
    "product_deleted",
    "stock_updated"
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string | Yes | HTTPS endpoint URL to receive events |
| `types` | array | Yes | Array of event type strings to subscribe to |

**Response:**
```json
{
  "code": 200,
  "result": {
    "url": "https://your-store.com/api/webhooks/printful",
    "types": [ "package_shipped", "order_created", ... ]
  }
}
```

---

### 3. DELETE /webhooks — Disable Webhooks

**URL:** `DELETE https://api.printful.com/webhooks`

Removes the webhook configuration entirely.

---

## Available Event Types

| Event Type | Trigger |
|---|---|
| `package_shipped` | A shipment has been dispatched (tracking number available) |
| `package_returned` | A return shipment has been received |
| `order_created` | A new order has been created |
| `order_updated` | An order has been modified |
| `order_failed` | Order processing failed |
| `order_canceled` | An order has been cancelled |
| `order_put_hold` | An order has been put on hold |
| `order_put_hold_approval` | Order on hold pending approval |
| `order_remove_hold` | Order hold has been removed |
| `order_refunded` | An order has been refunded |
| `product_synced` | A sync product has been fully configured |
| `product_updated` | A sync product has been updated |
| `product_deleted` | A sync product has been deleted |
| `stock_updated` | Stock/inventory levels have changed |

---

## Webhook Payload Structure

All webhook events follow this envelope structure:

```json
{
  "type": "package_shipped",
  "created": 1677800000,
  "retries": 0,
  "store": 12345,
  "data": {
    ...event-specific data...
  }
}
```

| Field | Type | Description |
|---|---|---|
| `type` | string | Event type identifier |
| `created` | integer | UNIX timestamp when event was created |
| `retries` | integer | Number of delivery retry attempts |
| `store` | integer | Printful store ID |
| `data` | object | Event-specific payload |

---

## Event Payloads

### package_shipped

```json
{
  "type": "package_shipped",
  "created": 1677800000,
  "store": 12345,
  "data": {
    "shipment": {
      "id": 1,
      "carrier": "DHL",
      "service": "DHL Express",
      "tracking_number": "1234567890",
      "tracking_url": "https://www.dhl.com/track?id=1234567890",
      "created": 1677800000,
      "ship_date": "2026-03-02",
      "shipped_at": 1677800000,
      "reshipment": false,
      "items": [
        {
          "item_id": 1,
          "quantity": 1,
          "picked": 1,
          "printed": 1
        }
      ]
    },
    "order": {
      "id": 123456,
      "external_id": "your-order-id-123",
      "status": "fulfilled"
    }
  }
}
```

### order_created / order_updated

```json
{
  "type": "order_created",
  "created": 1677700000,
  "store": 12345,
  "data": {
    "order": {
      "id": 123456,
      "external_id": "your-order-id-123",
      "status": "pending",
      "shipping": "STANDARD",
      "created": 1677700000,
      "updated": 1677700000
    }
  }
}
```

### order_failed

```json
{
  "type": "order_failed",
  "created": 1677700000,
  "store": 12345,
  "data": {
    "order": {
      "id": 123456,
      "external_id": "your-order-id-123",
      "status": "failed"
    },
    "reason": "Payment failed"
  }
}
```

### product_synced / product_updated / product_deleted

```json
{
  "type": "product_synced",
  "created": 1677700000,
  "store": 12345,
  "data": {
    "sync_product": {
      "id": 123456,
      "external_id": "your-sku-123",
      "name": "SKAPARA Ghost Tee",
      "synced": 4
    }
  }
}
```

### stock_updated

```json
{
  "type": "stock_updated",
  "created": 1677700000,
  "store": 12345,
  "data": {
    "variants": [
      {
        "id": 4011,
        "in_stock": false,
        "availability_status": [
          { "region": "EU", "status": "out_of_stock" }
        ]
      }
    ]
  }
}
```

### package_returned

```json
{
  "type": "package_returned",
  "created": 1677800000,
  "store": 12345,
  "data": {
    "shipment": {
      "id": 1,
      "tracking_number": "1234567890"
    },
    "order": {
      "id": 123456,
      "external_id": "your-order-id-123"
    }
  }
}
```

---

## Webhook Security

Printful does not send a signature header by default (unlike Stripe's `Stripe-Signature`). Recommended security practices:

1. **Secret in URL:** Include a secret token in your webhook URL path or query string:
   ```
   https://your-store.com/api/webhooks/printful?secret=your-secret-here
   ```

2. **IP Whitelisting:** Validate that requests come from Printful's IP range (check their docs/support for current IP list).

3. **HTTPS only:** Always use HTTPS endpoints — Printful will not deliver to HTTP.

4. **Idempotency:** The `retries` field indicates if a delivery was retried. Always handle webhooks idempotently (same event delivered twice should not cause duplicate processing).

---

## Webhook Delivery

- Printful will retry failed deliveries (non-200 responses)
- `retries` field in payload shows retry count
- Your endpoint should respond with HTTP 200 quickly (within a few seconds)
- Do heavy processing asynchronously — acknowledge receipt immediately

---

## Implementation Example (Next.js API Route)

```typescript
// /api/webhooks/printful/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== process.env.PRINTFUL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json();
  const { type, data } = payload;

  switch (type) {
    case 'package_shipped':
      await handleShipment(data.shipment, data.order);
      break;
    case 'order_failed':
      await handleOrderFailure(data.order, data.reason);
      break;
    case 'stock_updated':
      await handleStockUpdate(data.variants);
      break;
    case 'product_synced':
      await handleProductSynced(data.sync_product);
      break;
  }

  return NextResponse.json({ received: true });
}
```

---

## Migration Notes: Printify vs Printful Webhooks

| Feature | Printify | Printful |
|---|---|---|
| Setup endpoint | `POST /v1/shops/{id}/webhooks.json` | `POST /webhooks` |
| Signature verification | HMAC header | No built-in signature (use secret in URL) |
| Publishing events | `product:publish:started`, `product:publish:succeeded`, `product:publish:failed` | `product_synced`, `product_updated` |
| Shipping event | `order:shipment:created` | `package_shipped` |
| Order failure | `order:creation:failed` | `order_failed` |
| Multiple webhooks | One per topic | Single URL + array of event types |
| Delete specific webhook | `DELETE /webhooks/{id}` | `DELETE /webhooks` (removes all) |
