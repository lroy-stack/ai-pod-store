# Profile & Account Management System — Audit

**Date**: 2026-03-04
**Status**: Functional with security issues

## Architecture

```
Middleware (JWT + CSRF) → /[locale]/(app)/profile/page.tsx (Server Component)
  ├── ProfileForm.tsx              → GET/PATCH /api/user/profile
  ├── ChangePasswordForm.tsx       → POST /api/profile/change-password
  ├── ShippingAddressList.tsx      → CRUD /api/shipping-addresses[/id]
  │   └── AddressForm.tsx          (reusable form component)
  ├── PaymentMethodsList.tsx       → GET /api/profile/payment-methods (Stripe)
  └── DeleteAccountSection.tsx     → POST /api/profile/delete
                                       └── Cron: /api/cron/hard-delete-accounts (30-day)
```

### Related pages
- `/[locale]/(app)/orders/` — Order list + detail (protected)
- `/[locale]/(app)/settings/billing/` — Stripe billing portal
- `/[locale]/profile/notifications/` — Notification center (⚠️ NOT in (app) group)

## Files Reference

### Pages & Routes
| File | Type | Description |
|------|------|-------------|
| `src/app/[locale]/(app)/profile/page.tsx` | Server | Profile page — renders 5 sub-components |
| `src/app/[locale]/(app)/profile/loading.tsx` | Server | Skeleton loading state |
| `src/app/[locale]/(app)/orders/page.tsx` | Server | Orders list page |
| `src/app/[locale]/(app)/orders/[id]/page.tsx` | Server | Order detail page |
| `src/app/[locale]/profile/notifications/page.tsx` | Client | Notifications (⚠️ wrong route group) |

### Components
| File | Description |
|------|-------------|
| `src/components/profile/ProfileForm.tsx` | Profile info, locale, currency, notification prefs |
| `src/components/profile/ChangePasswordForm.tsx` | Current + new password with validation |
| `src/components/profile/DeleteAccountSection.tsx` | Soft-delete with 30-day grace period |
| `src/components/profile/ShippingAddressList.tsx` | CRUD for shipping addresses |
| `src/components/profile/AddressForm.tsx` | Reusable address form |
| `src/components/profile/PaymentMethodsList.tsx` | Stripe cards (read-only) |

### API Routes
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/profile` | GET | Fetch profile (auto-creates if missing) |
| `/api/user/profile` | PATCH | Update name, phone, locale, currency, notifications |
| `/api/profile/change-password` | POST | Change password (rate limited: 10/5min) |
| `/api/profile/delete` | POST | Request account deletion (30-day grace) |
| `/api/profile/payment-methods` | GET | List Stripe payment methods |
| `/api/shipping-addresses` | GET/POST | List/create shipping addresses |
| `/api/shipping-addresses/[id]` | PUT/DELETE | Update/delete individual address |
| `/api/billing/portal` | POST | Create Stripe billing portal session |
| `/api/cron/hard-delete-accounts` | GET | Hard-delete accounts past 30-day grace |

### Auth Routes
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/session` | GET | Verify JWT, auto-refresh tokens |
| `/api/auth/login` | POST | Login + cancels soft-delete if active |
| `/api/auth/register` | POST | Register + create users row |
| `/api/auth/logout` | POST | Sign out + clear cookies |
| `/api/auth/forgot-password` | POST | Send reset email (anti-enumeration) |
| `/api/auth/reset-password` | POST | Handle reset token |
| `/api/auth/verify-email` | GET | Email verification callback |

### Hooks
| File | Description |
|------|-------------|
| `src/hooks/useAuth.ts` | Client auth state, 5-min refresh, cross-tab sync |

## Data Models

### UserProfile (from /api/user/profile)
```typescript
{
  id: string
  email: string          // read-only
  name: string
  avatar_url?: string    // not editable from UI
  locale: string         // 'en' | 'es' | 'de'
  currency: string       // 'EUR' | 'USD' | 'GBP'
  phone?: string
  email_verified: boolean
  notification_preferences: {
    email: boolean
    push: boolean
    sms: boolean
  }
}
```

### ShippingAddress
```typescript
{
  id: string
  label?: string
  full_name?: string
  street_line1: string
  street_line2?: string
  city: string
  state?: string
  postal_code: string
  country_code: string   // 2-letter ISO
  phone?: string
  is_default: boolean
}
```

### PaymentMethod (from Stripe)
```typescript
{
  id: string
  type: string           // 'card'
  card: {
    brand: string        // 'visa', 'mastercard'
    last4: string
    exp_month: number
    exp_year: number
    funding: string      // 'credit', 'debit'
  } | null
  created: number        // unix timestamp
}
```

## DB Schema (users table)
```
id                       UUID PK
email                    VARCHAR(255) UNIQUE
name                     VARCHAR(255)
avatar_url               VARCHAR(255)
locale                   VARCHAR(2) DEFAULT 'en'
currency                 VARCHAR(3) DEFAULT 'EUR'
phone                    VARCHAR(20)
email_verified           BOOLEAN
notification_preferences JSONB DEFAULT '{"email":true,"push":true,"sms":false}'
stripe_customer_id       VARCHAR(255)
deletion_requested_at    TIMESTAMPTZ (soft-delete marker)
created_at               TIMESTAMPTZ
updated_at               TIMESTAMPTZ
```

### Related tables
- `shipping_addresses` — user_id FK, CRUD from profile
- `notifications` — user_id FK, displayed in notifications page
- `cart_items` — user_id FK, deleted on hard-delete
- `orders` — user_id FK, anonymized on hard-delete
- `wishlist_items` — user_id FK, deleted on hard-delete

## Security Measures

### Working correctly
- JWT validation in middleware for `/profile` and `/orders`
- CSRF token validation on mutation requests
- Rate limiting on auth routes (IP-based) and change-password (user-based)
- Turnstile CAPTCHA on login/register
- Anti-enumeration on forgot-password (always returns success)
- 30-day soft-delete grace period (GDPR compliant)
- Hard-delete cron anonymizes orders, deletes personal data
- Login cancels pending deletion automatically
- Cross-tab auth sync via localStorage events

### Security Issues

#### CRITICAL: change-password uses signInWithPassword()
**File**: `src/app/api/profile/change-password/route.ts:76-79`
**Problem**: Verifies current password by calling `supabase.auth.signInWithPassword()`, which creates a second session.
**Risk**: Session leak, race conditions, could fail with already-signed-in errors.
**Fix**: Use Supabase RPC function to verify password hash server-side, or use `supabase.auth.reauthenticate()`.

#### HIGH: Notifications page not auth-protected
**File**: `src/app/[locale]/profile/notifications/page.tsx`
**Problem**: Route is at `/[locale]/profile/notifications/` (outside `(app)` group).
**Risk**: Page may be accessible without authentication since middleware only protects routes inside `(app)`.
**Fix**: Move to `src/app/[locale]/(app)/profile/notifications/page.tsx`.

#### MEDIUM: Billing portal locale hardcoded
**File**: `src/app/api/billing/portal/route.ts:49`
**Problem**: Return URL hardcoded to `/en/settings/billing`.
**Fix**: Extract locale from user profile or request.

## Incomplete Features

| Feature | UI exists | Backend exists | Blocker |
|---------|:---------:|:--------------:|---------|
| Avatar upload | Button (disabled) | avatar_url column | No upload handler |
| Remove payment method | Button (disabled) | Stripe supports it | No API route |
| Email change | No | Supabase supports it | Not implemented |
| MFA/2FA | No | Supabase supports it | Not implemented |
| Deletion countdown | No | `deletion_requested_at` exists | No UI |
| Password strength meter | No | N/A | Not implemented |

## Account Deletion Flow (GDPR)

```
1. User clicks "Delete Account" → DeleteAccountSection.tsx
2. Confirmation dialog shown with warnings
3. POST /api/profile/delete { confirm: true }
4. Server: SET deletion_requested_at = NOW() on users table
5. Server: Send confirmation email via Resend (30-day grace info)
6. Server: Clear session cookies, sign out
7. User redirected to homepage

--- Grace period (30 days) ---

8a. User logs in → Login route UNSETS deletion_requested_at → deletion cancelled
8b. 30 days pass → Cron job /api/cron/hard-delete-accounts:
    - DELETE FROM shipping_addresses WHERE user_id = ...
    - DELETE FROM personalizations WHERE user_id = ...
    - DELETE FROM wishlists WHERE user_id = ...
    - DELETE FROM notifications WHERE user_id = ...
    - DELETE FROM user_consents WHERE user_id = ...
    - DELETE FROM messages WHERE user_id = ...
    - DELETE FROM conversations WHERE user_id = ...
    - DELETE FROM cart_items WHERE user_id = ...
    - UPDATE orders SET customer_name='Deleted User', customer_email=NULL, shipping_address=NULL
    - DELETE FROM users WHERE id = ...
    - supabase.auth.admin.deleteUser(id)
```
