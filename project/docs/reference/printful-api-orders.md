# Printful Orders API Reference

## Overview

The Orders API allows you to create, retrieve, update, and cancel orders in Printful. All order operations require authentication.

**Base URL:** `https://api.printful.com/`

**Authentication:** Bearer token required

---

## Order Status Workflow

Orders progress through the following states during their lifecycle:

### Order States

| State | Description | Next States |
|-------|-------------|------------|
| **draft** | Order created but not submitted for fulfillment | confirmed, cancelled |
| **confirmed** | Order submitted and awaiting processing | processing, failed, cancelled |
| **processing** | Printful is preparing the order | shipped, failed |
| **shipped** | Order has been dispatched | completed, cancelled |
| **completed** | Order successfully delivered | - |
| **cancelled** | Order cancelled by user or system | - |
| **failed** | Order fulfillment failed | - |

### Order Lifecycle Events

```
Draft Order Created
     ↓
Confirm for Fulfillment
     ↓
Processing (Production)
     ↓
Shipped (In Transit)
     ↓
Completed (Delivered)
```

---

## Order Endpoints

### List Orders

Retrieve all orders with optional filtering.

```http
GET /orders?offset=0&limit=20&status=all
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `offset` | integer | 0 | Number of results to skip |
| `limit` | integer | 20 | Maximum results per page (1-100) |
| `status` | string | all | Filter by order status (draft, confirmed, processing, shipped, completed, cancelled, failed, all) |

**Response:**

```json
{
  "code": 200,
  "result": [
    {
      "id": "12345",
      "external_id": "ext_12345",
      "status": "confirmed",
      "shipping": "STANDARD",
      "created": 1609459200,
      "updated": 1609545600,
      "recipient": {
        "name": "John Doe",
        "address1": "123 Main St",
        "address2": "",
        "city": "New York",
        "state_code": "NY",
        "country_code": "US",
        "zip": "10001",
        "email": "john@example.com",
        "phone": "+1234567890"
      },
      "items": [
        {
          "id": "item_1",
          "external_id": "ext_item_1",
          "variant_id": 1234,
          "product_id": 567,
          "quantity": 2,
          "price": "19.99",
          "currency": "USD"
        }
      ],
      "costs": {
        "currency": "USD",
        "subtotal": "39.98",
        "discount": "0.00",
        "shipping": "10.00",
        "tax": "0.00",
        "total": "49.98"
      },
      "shipping_service_name": "Standard (5-7 business days)"
    }
  ],
  "paging": {
    "total": 500,
    "offset": 0,
    "limit": 20
  }
}
```

---

### Create Order

Create a new draft order.

```http
POST /orders
Content-Type: application/json
```

**Request Body:**

```json
{
  "external_id": "ext_order_12345",
  "shipping": "STANDARD",
  "recipient": {
    "name": "John Doe",
    "address1": "123 Main St",
    "address2": "Apt 4B",
    "city": "New York",
    "state_code": "NY",
    "country_code": "US",
    "zip": "10001",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "items": [
    {
      "variant_id": 1234,
      "quantity": 2,
      "price": "19.99",
      "files": [
        {
          "id": "file_id_1",
          "type": "front"
        }
      ],
      "options": [
        {
          "id": "pod_full_color_front",
          "value": true
        }
      ]
    }
  ],
  "gift": {
    "subject": "Birthday Gift",
    "message": "Happy Birthday!"
  },
  "packing_slip": {
    "email": "shipping@example.com",
    "phone": "+1234567890",
    "message": "Thank you for your order!"
  }
}
```

**Required Fields:**

- `recipient` - Shipping address object (all sub-fields required)
- `items` - Array with at least one item
- `shipping` - Shipping method code

**Recipient Object:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Full name (max 100 chars) |
| `address1` | string | Street address (required) |
| `address2` | string | Apartment, suite, etc. (optional) |
| `city` | string | City name (required) |
| `state_code` | string | State/province code (required for US/CA/AU) |
| `country_code` | string | 2-letter country code (required) |
| `zip` | string | Postal code (required) |
| `email` | string | Email address |
| `phone` | string | Phone number |

**Item Object:**

| Field | Type | Description |
|-------|------|-------------|
| `variant_id` | integer | Printful variant ID (required) |
| `quantity` | integer | Order quantity (required) |
| `price` | string | Unit price in USD (optional, server calculates if omitted) |
| `files` | array | Design files with placement info |
| `options` | array | Product options (embroidery colors, etc.) |

**File Object:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | File ID from file library |
| `type` | string | Placement: front, back, sleeve, etc. |
| `position` | object | Optional positioning data |

**Options Array:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Option ID (e.g., "pod_full_color_front") |
| `value` | string/boolean/integer | Option value |

**Gift/Packing Slip Object:**

| Field | Type | Description |
|-------|------|-------------|
| `subject` | string | Gift message subject |
| `message` | string | Gift message body |
| `email` | string | Packing slip email |
| `phone` | string | Packing slip phone |
| `message` | string | Packing slip message |

**Response:**

```json
{
  "code": 200,
  "result": {
    "id": "12345",
    "external_id": "ext_order_12345",
    "status": "draft",
    "shipping": "STANDARD",
    "created": 1609459200,
    "updated": 1609459200,
    "recipient": { /* ... */ },
    "items": [ /* ... */ ],
    "costs": {
      "currency": "USD",
      "subtotal": "39.98",
      "discount": "0.00",
      "shipping": "0.00",
      "tax": "0.00",
      "total": "39.98"
    }
  }
}
```

---

### Get Order

Retrieve a specific order by ID.

```http
GET /orders/{id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Order ID |

**Response:**

Returns complete order object (see Create Order response structure).

---

### Update Order

Modify a draft order before confirmation.

```http
PUT /orders/{id}
Content-Type: application/json
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Order ID |

**Request Body:**

```json
{
  "shipping": "EXPRESS",
  "recipient": {
    "name": "John Doe",
    "address1": "456 Oak Ave",
    "address2": "",
    "city": "Boston",
    "state_code": "MA",
    "country_code": "US",
    "zip": "02101",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "items": [
    {
      "variant_id": 5678,
      "quantity": 1,
      "price": "24.99"
    }
  ]
}
```

**Limitations:**

- Can only update orders in `draft` status
- Cannot update orders that are already confirmed or shipped
- All items must be provided (partial updates not supported)

---

### Confirm Draft Order

Submit a draft order for fulfillment.

```http
POST /orders/{id}/confirm
Content-Type: application/json
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Order ID |

**Request Body (Optional):**

```json
{
  "external_id": "ext_order_12345"
}
```

**Response:**

```json
{
  "code": 200,
  "result": {
    "id": "12345",
    "status": "confirmed",
    "updated": 1609459300
  }
}
```

**Effects:**

- Status changes from `draft` to `confirmed`
- Order moved into fulfillment queue
- Cannot be modified after confirmation

---

### Cancel Order

Cancel an order (draft or processing only).

```http
DELETE /orders/{id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Order ID |

**Response:**

```json
{
  "code": 200,
  "result": {
    "id": "12345",
    "status": "cancelled",
    "updated": 1609459400
  }
}
```

**Cancellation Rules:**

- Draft orders: Can be cancelled anytime
- Confirmed/Processing: May not be cancellable (contact Printful)
- Shipped: Cannot be cancelled (contact for return/RMA)

---

### Estimate Order Costs

Calculate estimated costs before creating an order.

```http
POST /orders/calculate/estimate
Content-Type: application/json
```

**Request Body:**

```json
{
  "recipient": {
    "address1": "123 Main St",
    "city": "New York",
    "state_code": "NY",
    "country_code": "US",
    "zip": "10001"
  },
  "items": [
    {
      "variant_id": 1234,
      "quantity": 2
    }
  ],
  "shipping": "STANDARD"
}
```

**Response:**

```json
{
  "code": 200,
  "result": {
    "costs": {
      "currency": "USD",
      "subtotal": "39.98",
      "discount": "0.00",
      "shipping": "10.00",
      "tax": "0.00",
      "total": "49.98"
    }
  }
}
```

---

## Order Data Structures

### Order Object

```json
{
  "id": "12345",
  "external_id": "ext_order_12345",
  "status": "confirmed",
  "shipping": "STANDARD",
  "shipping_service_name": "Standard (5-7 business days)",
  "created": 1609459200,
  "updated": 1609545600,
  "recipient": {
    "name": "John Doe",
    "address1": "123 Main St",
    "address2": "Apt 4B",
    "city": "New York",
    "state_code": "NY",
    "country_code": "US",
    "zip": "10001",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "items": [ /* array of Item objects */ ],
  "costs": {
    "currency": "USD",
    "subtotal": "39.98",
    "discount": "0.00",
    "shipping": "10.00",
    "tax": "3.50",
    "total": "53.48"
  },
  "shipments": [
    {
      "id": "ship_123",
      "carrier": "USPS",
      "service": "Priority Mail",
      "tracking_number": "9400111899223456789012",
      "tracking_url": "https://tools.usps.com/go/TrackConfirmAction?...",
      "label_url": "https://api.printful.com/orders/12345/shipments/ship_123/label",
      "estimated_delivery": "2021-01-10",
      "shipped_at": 1609459200
    }
  ],
  "gift": {
    "subject": "Birthday Gift",
    "message": "Happy Birthday!"
  }
}
```

### Item Object

```json
{
  "id": "item_1",
  "external_id": "ext_item_1",
  "variant_id": 1234,
  "product_id": 567,
  "quantity": 2,
  "price": "19.99",
  "currency": "USD",
  "name": "T-Shirt (White, S)",
  "product_name": "Classic T-Shirt",
  "files": [
    {
      "id": "file_123",
      "type": "front",
      "hash": "abc123def456",
      "url": "https://storage.printful.com/..."
    }
  ],
  "options": [
    {
      "id": "pod_full_color_front",
      "value": true
    }
  ]
}
```

### Shipment Object

```json
{
  "id": "ship_123",
  "carrier": "USPS",
  "service": "Priority Mail",
  "tracking_number": "9400111899223456789012",
  "tracking_url": "https://tools.usps.com/go/TrackConfirmAction?...",
  "label_url": "https://api.printful.com/orders/12345/shipments/ship_123/label",
  "estimated_delivery": "2021-01-10",
  "estimated_delivery_date": 1641772800,
  "shipped_at": 1609459200,
  "picked_up_at": null,
  "delivered_at": null,
  "returned_at": null,
  "original_order": true,
  "items": [
    {
      "item_id": "item_1",
      "quantity": 2
    }
  ]
}
```

---

## Shipping Methods

### Available Shipping Options

| Shipping Code | Description | Delivery Time | Cost* |
|---------------|-------------|---------------|-------|
| STANDARD | Standard Shipping | 5-7 business days | ~$10 |
| EXPRESS | Express Shipping | 2-3 business days | ~$20 |
| OVERNIGHT | Overnight Shipping | Next business day | ~$30+ |

*Costs vary by destination and order weight.

### Shipping Service Names

The API returns human-readable shipping service names:
- "Standard (5-7 business days)"
- "Express (2-3 business days)"
- "Overnight"
- Carrier-specific options (USPS, UPS, FedEx, DHL)

---

## Tracking Information

### Shipment Tracking

When an order is shipped, the Shipment object includes:

| Field | Type | Description |
|-------|------|-------------|
| `carrier` | string | Carrier name (USPS, UPS, FedEx, DHL) |
| `service` | string | Service level |
| `tracking_number` | string | Tracking number for carrier |
| `tracking_url` | string | Direct URL to carrier tracking page |
| `estimated_delivery` | string | Estimated delivery date (YYYY-MM-DD) |
| `shipped_at` | integer | UNIX timestamp when shipped |
| `delivered_at` | integer | UNIX timestamp when delivered (null if not delivered) |

### Tracking URL

The `tracking_url` is a pre-formatted link directly to the carrier's tracking system:

```
https://tools.usps.com/go/TrackConfirmAction?...
https://www.ups.com/track?...
https://www.fedex.com/...
```

---

## Webhooks for Orders

The following webhook events are available for orders:

| Event | Trigger | Use Case |
|-------|---------|----------|
| `order_created` | New order created | Inventory sync, notifications |
| `order_updated` | Order status changed | Status update notifications |
| `order_confirmed` | Order confirmed for production | Production queue update |
| `order_failed` | Order fulfillment failed | Error handling |
| `order_canceled` | Order cancelled | Cleanup, refunds |
| `order_put_hold` | Order placed on hold | Notification to user |
| `order_put_hold_approval` | Hold approval required | Review process |
| `order_remove_hold` | Hold removed | Continuation notification |
| `package_shipped` | Package dispatched | Tracking notifications |
| `package_returned` | Return received | Return processing |
| `order_refunded` | Refund processed | Financial reconciliation |

---

## Common Order Workflows

### Creating and Confirming an Order

1. **POST /orders** - Create draft order
2. **POST /orders/{id}/confirm** - Confirm for fulfillment
3. **Monitor status** via polling or webhooks
4. **GET /orders/{id}** - Retrieve tracking info when shipped

### Calculating Shipping Before Order

1. **POST /orders/calculate/estimate** - Get costs
2. **Show costs to customer**
3. **POST /orders** - Create order with confirmed shipping
4. **POST /orders/{id}/confirm** - Confirm order

### Batch Order Processing

```
For each order:
  1. POST /orders - Create
  2. Validate response
  3. POST /orders/{id}/confirm - Confirm

Monitor fulfillment:
  GET /orders?status=processing
  GET /orders/{id}
```

### Handling Order Failures

```
1. GET /orders/{id}
2. Check status = "failed"
3. Review error information
4. Create new order or refund customer
5. Contact Printful support if needed
```

---

## Best Practices

### Order Creation

1. **Use external_id** for order reconciliation with your system
2. **Validate addresses** before creating orders
3. **Estimate costs** before showing to customer
4. **Use gift/packing slip** for personalization
5. **Store order ID** immediately after creation

### Order Management

1. **Don't modify confirmed orders** - create new order instead
2. **Monitor order status** via webhooks (more efficient than polling)
3. **Implement retry logic** for failed orders
4. **Keep external_id mapping** for reconciliation
5. **Log all order operations** for auditing

### Tracking & Shipping

1. **Parse tracking_url** for customer notifications
2. **Update customer** when shipment info available
3. **Provide estimated_delivery** date in customer communications
4. **Handle carrier updates** via webhook notifications
5. **Archive shipment data** for order history

---

## Error Scenarios

### Invalid Recipient Address

```json
{
  "code": 422,
  "error": {
    "reason": "ValidationFailed",
    "message": "Invalid postal code for country"
  }
}
```

### Insufficient Stock

```json
{
  "code": 422,
  "error": {
    "reason": "OutOfStock",
    "message": "Variant 1234 is currently out of stock"
  }
}
```

### Invalid Variant

```json
{
  "code": 404,
  "error": {
    "reason": "NotFound",
    "message": "Variant not found"
  }
}
```

### Cannot Modify Confirmed Order

```json
{
  "code": 422,
  "error": {
    "reason": "ValidationFailed",
    "message": "Cannot modify order with status 'confirmed'"
  }
}
```

---

## Rate Limits

- General limit: **120 API calls per minute**
- Recommended delay between requests: **500-1000ms**
- Batch operations should be spaced to respect rate limits

---

## See Also

- [Catalog API Reference](printful-api-catalog.md)
- [Products API Reference](printful-api-products.md)
- [Shipping Calculation](printful-api-overview.md#shipping-rate-api)
