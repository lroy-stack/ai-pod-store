# Printful API — Authentication

**Source:** https://developers.printful.com/docs/#section/Authentication
**Fetched:** 2026-03-02

---

## Overview

The Printful API supports two authentication methods:

1. **Private Token** — for personal/internal store integrations
2. **Public App (OAuth 2.0)** — for third-party applications serving multiple users

All authenticated requests must include:
```
Authorization: Bearer {token}
```

---

## Method 1: Private Token

### When to Use
- Building an API integration for your own Printful store
- Internal tooling, cron jobs, backend services
- Our use case: POD AI Store backend connecting to our Printful store

### Token Characteristics
- Generated in the Developer Portal: https://developers.printful.com/
- **Do have an expiration date** — unlike Printify tokens, these expire
- Must be refreshed before expiration (generate a new token and update your service)
- No OAuth flow needed — simple bearer token

### Access Levels

| Level | Description | Extra Header Required |
|---|---|---|
| **Store-level** | Access to one specific store | None |
| **Account-level** | Access to all stores under your Printful account | `X-PF-Store-Id` required |

### Making Requests

```bash
# Store-level token — no extra header needed
curl --location --request GET 'https://api.printful.com/store' \
  --header 'Authorization: Bearer {private_token}'

# Account-level token — must specify which store
curl --location --request GET 'https://api.printful.com/store' \
  --header 'Authorization: Bearer {private_token}' \
  --header 'X-PF-Store-Id: {store_id}'
```

### Getting Your Store ID

Use the Store Information API:
```bash
GET https://api.printful.com/store
```
The response contains your store's ID.

---

## Method 2: Public App (OAuth 2.0)

### When to Use
- Building an app that many Printful users will install
- Our potential use case: Customer-facing design module where customers connect their own Printful accounts
- Third-party integrations distributed to multiple merchants

### OAuth Flow

#### Step 1: Generate Installation URL

Redirect the user to:
```
https://www.printful.com/oauth/authorize?client_id={clientId}&state={stateValue}&redirect_url={redirectUrl}
```

| Parameter | Description |
|---|---|
| `client_id` | Your app's client ID from the Developer Portal |
| `state` | Random string for CSRF protection (verify on callback) |
| `redirect_url` | Your callback URL (must match registered URL) |

#### Step 2: User Authorizes

The user sees Printful's authorization screen and grants permission to the requested scopes.

#### Step 3: Exchange Authorization Code for Tokens

After authorization, Printful redirects to your `redirect_url` with a `code` parameter.

```bash
POST https://www.printful.com/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "client_id": "{your_client_id}",
  "client_secret": "{your_client_secret}",
  "code": "{authorization_code}"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

#### Step 4: Use Access Token

```bash
curl --location --request GET 'https://api.printful.com/store' \
  --header 'Authorization: Bearer {access_token}'
```

#### Step 5: Refresh Access Token

Access tokens expire after **1 hour**. Refresh tokens expire after **90 days of non-use**.

```bash
POST https://www.printful.com/oauth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "client_id": "{your_client_id}",
  "client_secret": "{your_client_secret}",
  "refresh_token": "{refresh_token}"
}
```

---

## OAuth Scopes

Scopes control what actions the token can perform. Request only the scopes you need.

| Scope | Access Level | Description |
|---|---|---|
| `orders` | Read + Write | Full access to create and manage orders |
| `orders/read` | Read only | View orders only |
| `sync_products` | Read + Write | Create, update, delete sync products |
| `sync_products/read` | Read only | View sync products only |
| `file_library` | Read + Write | Upload and manage design files |
| `file_library/read` | Read only | View file library only |
| `webhooks` | Read + Write | Configure webhook events |
| `webhooks/read` | Read only | View webhook configuration |
| `product_templates` | Read + Write | Manage product templates (account-level only) |
| `product_templates/read` | Read only | View product templates |

### Scope Notes
- `product_templates` is account-level only (not available for store-level apps)
- Catalog API (`/products`) is **public** — no scope required

---

## Required Headers Summary

| Header | Required For | Value |
|---|---|---|
| `Authorization` | All authenticated requests | `Bearer {token}` |
| `X-PF-Store-Id` | Account-level token requests | `{store_id}` (integer) |
| `X-PF-Language` | Localized responses (optional) | `en_US`, `de_DE`, `es_ES`, etc. |
| `Content-Type` | POST/PUT requests with body | `application/json` |

---

## Migration Note: Printify vs Printful Auth

| Feature | Printify | Printful |
|---|---|---|
| Base Auth Header | `Authorization: Bearer {token}` | `Authorization: Bearer {token}` |
| Shop/Store in URL | Yes (`/v1/shops/{shop_id}/`) | No — use header or store-level token |
| Token Expiry | No expiry (until deleted) | YES — expiration date exists |
| Rate Limit Header | None documented | None documented |
| Required Extra Headers | `User-Agent: POD-AI-Store/1.0` (Cloudflare) | Not mentioned |
| Multi-store Access | Separate token per shop | Account-level token + `X-PF-Store-Id` |

### Recommended Environment Variables for Our Integration

```env
PRINTFUL_API_TOKEN=your_private_token_here
PRINTFUL_STORE_ID=your_store_id_here
```

### TypeScript Client Pattern (Recommended)

```typescript
const PRINTFUL_BASE_URL = 'https://api.printful.com';

const headers = {
  'Authorization': `Bearer ${process.env.PRINTFUL_API_TOKEN}`,
  'Content-Type': 'application/json',
};

// If using account-level token:
// headers['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;
```
