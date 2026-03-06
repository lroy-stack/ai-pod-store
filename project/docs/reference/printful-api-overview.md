# Printful API Overview

## Base Information

**Base URL:** `https://api.printful.com/`

**API Type:** RESTful API using HTTP protocol

**HTTP Methods:** GET, POST, PUT, DELETE

**Response Format:** JSON

---

## Response Structure

All API responses follow a consistent format:

```json
{
  "code": 200,
  "result": {
    // Response data or error description
  },
  "paging": {
    "total": 100,
    "offset": 0,
    "limit": 20
  }
}
```

### Response Fields

- **code** (integer): HTTP status code (200 for success)
- **result** (object/array/string): The actual response data or error message
- **paging** (object, optional): Pagination metadata containing:
  - `total`: Total number of results
  - `offset`: Current offset in results
  - `limit`: Maximum results per page

---

## Authentication

Printful supports two authorization approaches:

### 1. Private Token (Personal Store Integration)

**Use Case:** Single store integration, personal API usage

**Implementation:**
```
Authorization: Bearer {private_token}
```

**Token Types:**
- Store-level private token: Access to specific store
- Account-level tokens: Require `X-PF-Store-Id` header for store context

### 2. OAuth 2.0 (Public Apps / Multi-Tenant)

**Use Case:** Third-party applications serving multiple users

**OAuth Flow:**

1. **Redirect to Authorization:**
```
https://www.printful.com/oauth/authorize?client_id={id}&state={state}&redirect_url={url}
```

2. **User Authorization:** User grants permission and receives authorization code

3. **Exchange Code for Tokens:**
```
POST https://www.printful.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code={code}&client_id={id}&client_secret={secret}&redirect_uri={url}
```

4. **Token Response:**
```json
{
  "access_token": "{access_token}",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "{refresh_token}"
}
```

**Token Lifetimes:**
- Access tokens: Valid for 1 hour
- Refresh tokens: Valid for 90 days

**Refresh Token Usage:**
```
POST https://www.printful.com/oauth/token
grant_type=refresh_token&refresh_token={refresh_token}&client_id={id}&client_secret={secret}
```

---

## OAuth Scopes

Available permission scopes for OAuth applications:

| Scope | Description |
|-------|-------------|
| `orders` | Full order access (read/write) |
| `orders/read` | Order read-only access |
| `sync_products` | Full product sync access (read/write) |
| `sync_products/read` | Product read-only access |
| `file_library` | File library access (read/write) |
| `file_library/read` | File library read-only access |
| `webhooks` | Webhook configuration (read/write) |
| `webhooks/read` | Webhook read-only access |
| `product_templates` | Product templates (read/write) |
| `product_templates/read` | Product templates read-only access |

**Note:** Account-level scopes (product_templates) only available for account-level tokens.

---

## Required Headers

### Standard Headers (All Requests)

```
Authorization: Bearer {private_token}
X-PF-Store-Id: {store_id}  # Required for account-level tokens
Content-Type: application/json
```

### Optional Headers

```
X-PF-Language: es_ES  # For response translations
```

**Supported Languages:**
- English: `en_US`, `en_GB`, `en_CA`
- Spanish: `es_ES`
- French: `fr_FR`
- German: `de_DE`
- Italian: `it_IT`
- Japanese: `ja_JP`

---

## Rate Limiting

### General Rate Limits

**Standard Endpoints:** 120 API calls per minute

**Resource-Intensive Endpoints:** Lower rate limits (typically 10-30 calls per minute):
- Mockup generator: `/mockups`
- Print file generation
- Heavy computational operations

### Unauthenticated Catalog Requests

- **Limit:** 30 requests per 60 seconds
- **Lockout:** 60-second temporary block if limit exceeded
- **Note:** No authentication required for public catalog browsing

### Rate Limit Handling

When rate limited:
1. Server returns HTTP 429 (Too Many Requests)
2. Response includes retry information
3. Implement exponential backoff: wait and retry with increasing delays

**Recommended Retry Strategy:**
```
Initial wait: 1 second
Max wait: 60 seconds
Backoff multiplier: 2x per attempt
```

---

## Error Handling

### HTTP Status Codes

| Code Range | Meaning | Examples |
|------------|---------|----------|
| 2xx | Success | 200 OK, 201 Created |
| 4xx | Client Error | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Validation Error |
| 5xx | Server Error | 500 Internal Server Error, 503 Service Unavailable |

### Error Response Format

```json
{
  "code": 404,
  "result": "Not Found",
  "error": {
    "reason": "NotFound",
    "message": "Not Found"
  }
}
```

### Common Error Codes

| Code | Reason | Description |
|------|--------|-------------|
| 400 | BadRequest | Missing or invalid parameters |
| 401 | Unauthorized | Invalid or missing authentication token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | NotFound | Resource does not exist |
| 422 | ValidationFailed | Request validation failed |
| 429 | TooManyRequests | Rate limit exceeded |
| 500 | InternalError | Server error |
| 503 | ServiceUnavailable | Temporary service unavailability |

### Handling Errors

Always check the `code` field in responses. Even if HTTP status is 2xx, the response structure follows the same format. Always validate:

```javascript
if (response.code >= 400) {
  // Handle error
  console.error(response.error.message);
}
```

---

## Pagination

### Pagination Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `offset` | integer | Number of results to skip (0-based) |
| `limit` | integer | Maximum results per page (1-100) |

### Default Pagination

- **Default limit:** 20 results per page
- **Maximum limit:** 100 results per page
- **Default offset:** 0

### Pagination Example

```
GET /orders?offset=20&limit=20
```

### Pagination Response

```json
{
  "code": 200,
  "result": [
    { "id": 1, ... },
    { "id": 2, ... }
  ],
  "paging": {
    "total": 500,
    "offset": 20,
    "limit": 20
  }
}
```

**Interpretation:**
- 500 total results available
- Currently showing results 20-39
- Next call: `offset=40&limit=20`

---

## Data Format Standards

### Timestamps

- Format: UNIX timestamp (seconds since January 1, 1970)
- Example: `1609459200` represents 2021-01-01 00:00:00 UTC
- Timezone: All times in UTC

### Currencies

- Format: String with decimal point (e.g., "19.99")
- Currency code provided separately in responses
- Common currencies: USD, EUR, GBP, CAD

### Booleans

- Format: Boolean (true/false) or numeric (1/0)
- Examples: `"is_discontinued": true`

### Arrays and Objects

- JSON standard format
- Nested objects permitted
- Null values used for missing data

---

## Request Best Practices

### Connection Management

- Use HTTP/1.1 Keep-Alive for multiple requests
- Implement connection pooling
- Set reasonable timeouts (30-60 seconds)

### Error Retry Strategy

```
1. Attempt 1: Immediate
2. Attempt 2: Wait 1 second
3. Attempt 3: Wait 2 seconds
4. Attempt 4: Wait 4 seconds
5. Max attempts: 5
```

### Batch Operations

For multiple operations:
1. Group related calls (e.g., get products, then variants)
2. Space requests to respect rate limits
3. Consider using webhooks for async notifications

### API Consumer Best Practices

1. **Cache responses** where appropriate (especially catalog data)
2. **Implement proper error handling** for all responses
3. **Monitor rate limits** and adjust request frequency
4. **Log requests and responses** for debugging
5. **Validate input** before sending to API
6. **Use meaningful User-Agent headers** for debugging

---

## API Feature Summary

| API | Purpose | Auth Required |
|-----|---------|---|
| **Catalog** | Browse products, variants, categories | No (limited rate) |
| **Products** | Manage synced products in store | Yes |
| **Orders** | Create and manage orders | Yes |
| **Files** | Upload and manage design files | Yes |
| **Shipping** | Calculate shipping rates | Yes |
| **Tax** | Calculate tax amounts | Yes |
| **Webhooks** | Configure event notifications | Yes |
| **Stores** | Manage store information | Yes |
| **Mockups** | Generate product mockups | Yes |
| **Templates** | Manage product templates | Yes |
| **Reports** | Access statistics and analytics | Yes |
| **Approvals** | Manage approval sheets | Yes |

---

## Getting Started Checklist

- [ ] Obtain Printful API token from account settings
- [ ] Identify store ID (available in store settings)
- [ ] Test authentication with simple catalog request
- [ ] Implement error handling for all responses
- [ ] Set up rate limit tracking
- [ ] Configure webhook notifications (optional)
- [ ] Test with non-critical data first
- [ ] Implement logging for debugging

---

## Support Resources

- Official API Documentation: https://developers.printful.com
- Status Page: https://status.printful.com
- Help Center: https://help.printful.com
- Support Contact: support@printful.com
