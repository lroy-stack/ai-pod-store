# Printful API — API Types and Access Modes

**Source:** https://developers.printful.com/
**Fetched:** 2026-03-02

---

## Overview

Printful offers two distinct API access modes, designed for different use cases. Understanding which mode to use is critical for our migration planning.

---

## Mode 1: Private Token (Store Integration)

### What It Is

A **Private Token** is a static bearer token you generate in the Printful Developer Portal. It grants your backend service direct access to your Printful store.

### Use Case

- **Our primary use case:** Backend service connecting to our Printful store to manage products, sync inventory, create orders, etc.
- Internal tooling, cron jobs, automated order creation
- "Build and improve — Generate private tokens and build solutions for your company or private projects"

### Characteristics

| Property | Value |
|---|---|
| Token type | Static bearer token |
| Expiration | YES — has an expiration date (must rotate before expiry) |
| Refresh needed | No OAuth refresh flow — generate a new token manually |
| Scope | Configurable at generation time |
| Store access | One store (store-level) or all stores (account-level) |
| Setup complexity | Low — generate in portal, add to `.env` |

### How to Get a Token

1. Go to https://developers.printful.com/
2. Log in with your Printful account
3. Navigate to "Private Tokens"
4. Click "Generate Token"
5. Select scopes (permissions) needed
6. Copy token and store in environment variable

### Recommended Scopes for Our Integration

```
orders           — Create and manage customer orders
sync_products    — Create and manage store products
file_library     — Upload design files
webhooks         — Configure event notifications
```

### Token Rotation Strategy

Since tokens expire, implement a rotation reminder:

```typescript
// Store token expiry date alongside token
// Example .env:
PRINTFUL_API_TOKEN=eyJ...
PRINTFUL_API_TOKEN_EXPIRES=2026-09-02T00:00:00Z

// Check in health endpoint or startup:
const expiresAt = new Date(process.env.PRINTFUL_API_TOKEN_EXPIRES!);
const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
if (daysUntilExpiry < 30) {
  console.warn(`⚠️ PRINTFUL TOKEN EXPIRES IN ${Math.floor(daysUntilExpiry)} DAYS`);
  // Send alert to Telegram/Slack
}
```

### Making Requests

```typescript
// TypeScript — Private Token usage
const PRINTFUL_BASE_URL = 'https://api.printful.com';

async function printfulFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`${PRINTFUL_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${process.env.PRINTFUL_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Printful API error ${response.status}: ${error.result?.message}`);
  }

  return response.json();
}

// Usage:
const products = await printfulFetch('/sync_products?limit=100');
```

---

## Mode 2: Public App (OAuth 2.0)

### What It Is

A **Public App** uses OAuth 2.0 to allow your application to access Printful on behalf of multiple different Printful users. Each user authorizes your app and you receive tokens scoped to their store.

### Use Case

- **Our potential future use case:** Customer-facing design module where customers connect their own Printful accounts
- Third-party apps distributed on the Printful App Store
- "Create and share — Build apps that empower Printful users to do more"
- "Build apps distributable to thousands of Printful users"

### Characteristics

| Property | Value |
|---|---|
| Token type | OAuth 2.0 access + refresh tokens |
| Access token expiry | 1 hour |
| Refresh token expiry | 90 days of non-use |
| Scope | Requested during OAuth authorization |
| Multi-user | Yes — one app, many users |
| Setup complexity | High — requires OAuth server, token storage per user |

### OAuth Flow Summary

```
1. User clicks "Connect Printful Account" in your app
2. Redirect to: https://www.printful.com/oauth/authorize?client_id=...
3. User approves permissions on Printful
4. Printful redirects to your callback URL with ?code=...
5. Your server exchanges code for access_token + refresh_token
6. Store tokens per user in your database
7. Use access_token for API calls on behalf of that user
8. Refresh access_token every hour using refresh_token
```

### Token Storage Pattern

```typescript
// Supabase table for OAuth tokens
// CREATE TABLE printful_tokens (
//   user_id UUID REFERENCES auth.users(id),
//   access_token TEXT NOT NULL,
//   refresh_token TEXT NOT NULL,
//   expires_at TIMESTAMPTZ NOT NULL,
//   store_id INTEGER,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );

async function getPrintfulToken(userId: string): Promise<string> {
  const { data } = await supabase
    .from('printful_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!data) throw new Error('No Printful token found for user');

  // Refresh if expiring within 5 minutes
  if (new Date(data.expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    return await refreshPrintfulToken(userId, data.refresh_token);
  }

  return data.access_token;
}
```

---

## Comparison: Private Token vs Public App

| Feature | Private Token | Public App (OAuth) |
|---|---|---|
| **Setup time** | Minutes | Hours/days |
| **Best for** | Our store backend | Customer-facing integrations |
| **Users supported** | 1 store | Unlimited users |
| **Token expiry** | Long-lived (set at creation) | 1 hour (auto-refresh) |
| **Token refresh** | Manual (generate new) | Automatic via refresh token |
| **Security** | Store in `.env` / secrets manager | Store per-user in database |
| **Scopes** | Set once at generation | User grants at authorization |
| **Portal needed** | Developer Portal only | Developer Portal + OAuth server |

---

## Our Migration Recommendation

### Phase 1: Private Token (Immediate)

For the initial migration from Printify to Printful, use **Private Token mode**:

```env
# .env.local
PRINTFUL_API_TOKEN=your_private_token_here
PRINTFUL_STORE_ID=your_store_id_here
PRINTFUL_API_TOKEN_EXPIRES=2026-09-02T00:00:00Z
```

This covers all backend operations:
- Product sync (replacing Printify sync)
- Order creation (replacing Printify order creation)
- Webhook configuration
- File uploads

### Phase 2: Public App (Future)

If we build a **design studio** feature where customers can create products on their own Printful accounts, implement OAuth. This is not needed for Phase 1.

---

## Developer Portal

- **Portal URL:** https://developers.printful.com/
- **Sign in** with your Printful merchant account
- **Actions available:**
  - Generate private tokens with custom scopes
  - Register OAuth apps (for Public App mode)
  - View API documentation
  - Read API changelog / release notes

---

## Environment Variables Reference

```env
# Required for Private Token mode (Phase 1)
PRINTFUL_API_TOKEN=           # Bearer token from Developer Portal
PRINTFUL_STORE_ID=            # Your Printful store ID
PRINTFUL_API_TOKEN_EXPIRES=   # ISO 8601 expiry date (track for rotation)

# Required for Webhooks
PRINTFUL_WEBHOOK_SECRET=      # Secret token embedded in webhook URL

# Required for Public App mode (Phase 2 only)
PRINTFUL_CLIENT_ID=           # OAuth app client ID
PRINTFUL_CLIENT_SECRET=       # OAuth app client secret
PRINTFUL_REDIRECT_URL=        # OAuth callback URL
```

---

## Comparison with Printify Environment Variables

| Variable | Printify | Printful |
|---|---|---|
| API Token | `PRINTIFY_API_TOKEN` | `PRINTFUL_API_TOKEN` |
| Shop/Store ID | `PRINTIFY_SHOP_ID` (in URL path) | `PRINTFUL_STORE_ID` (in header or token scope) |
| Token Expiry | No expiry | `PRINTFUL_API_TOKEN_EXPIRES` (track!) |
| Webhook Secret | Part of webhook URL | `PRINTFUL_WEBHOOK_SECRET` |
| Base URL | `https://api.printify.com/v1` | `https://api.printful.com` |
