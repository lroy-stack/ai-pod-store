# MCP Server Tools Audit Report

**Date:** 2026-03-09
**Auditor:** Claude Opus 4.6
**Scope:** All 17 MCP tools in `/mcp-server/src/tools/`
**Server:** `@pod-ai/mcp-server` v1.0.0 (MCP SDK 1.26+)

---

## Executive Summary

The MCP server exposes 17 tools for e-commerce operations (product browsing, cart, checkout, orders, wishlist, profile, store info). Overall architecture is **well-structured** with proper use of MCP SDK `registerTool()`, Zod schemas, OAuth 2.1 JWT auth, audit logging, and rate limiting.

**Critical issues found: 2**
**High issues found: 4**
**Medium issues found: 7**
**Low issues found: 5**

### Scorecard

| Category | Score | Notes |
|---|---|---|
| Tool Registration | 9/10 | Excellent use of registerTool, annotations, descriptions |
| Input Validation | 8/10 | Zod everywhere, UUID validation, range limits |
| Authorization | 6/10 | Auth checks present but admin client bypasses RLS |
| Data Access Patterns | 4/10 | **CRITICAL** - Admin client used for ALL queries, RLS bypassed |
| Error Handling | 8/10 | Consistent pattern, no internal leaks (one exception) |
| SQL Injection | 9/10 | No raw SQL, Supabase query builder, ILIKE sanitized |
| Response Format | 8/10 | Consistent JSON, cents-to-decimal conversion, structured |
| Completeness | 6/10 | Missing coupon, review creation, return request tools |
| Performance | 7/10 | Some N+1 patterns, missing pagination on some tools |
| Business Logic | 7/10 | Price handling mostly correct, some currency issues |
| Tool Descriptions | 9/10 | Clear, AI-friendly, good parameter descriptions |
| Edge Cases | 7/10 | Most handled, some gaps with deleted products |

---

## 1. Tool Registration Pattern

### How Tools Are Registered

All 17 tools use `server.registerTool()` (MCP SDK 1.26+ pattern), with:
- Tool name (snake_case)
- Metadata object: `description`, `inputSchema` (Zod), `title`, `annotations`
- Handler wrapped in `withAuditLog()` for structured JSON logging

**Annotations** are properly set for all tools:
- `readOnlyHint` / `destructiveHint` / `idempotentHint` correctly reflect tool behavior
- `openWorldHint: true` on all tools (correct since they access Supabase/Stripe)

**Tool count constant** `TOOL_COUNT = 17` is hardcoded in `index.ts:135` and used in `/health` endpoint. Must be manually updated when tools are added -- fragile but acceptable.

### Classification

| # | Tool | Auth | Read-Only | Destructive |
|---|---|---|---|---|
| 1 | `search_products` | PUBLIC | Yes | No |
| 2 | `get_product_details` | PUBLIC | Yes | No |
| 3 | `get_product_reviews` | PUBLIC | Yes | No |
| 4 | `list_categories` | PUBLIC | Yes | No |
| 5 | `get_store_info` | PUBLIC | Yes | No |
| 6 | `get_store_policies` | PUBLIC | Yes | No |
| 7 | `get_cart` | PROTECTED | Yes | No |
| 8 | `update_cart` | PROTECTED | No | No |
| 9 | `create_checkout` | PROTECTED | No* | No |
| 10 | `get_order_status` | PROTECTED | Yes | No |
| 11 | `list_my_orders` | PROTECTED | Yes | No |
| 12 | `track_shipment` | PROTECTED | Yes | No |
| 13 | `list_wishlist` | PROTECTED | Yes | No |
| 14 | `add_to_wishlist` | PROTECTED | No | Yes |
| 15 | `remove_from_wishlist` | PROTECTED | No | Yes |
| 16 | `get_my_profile` | PROTECTED | Yes | No |
| 17 | `update_my_profile` | PROTECTED | No | Yes |

*`create_checkout` is marked `readOnlyHint: true` because it only creates a Stripe session and returns a URL; no local data is modified.

---

## 2. Per-Tool Audit

### 2.1 `search_products`

- **File:** `src/tools/search-products.ts`
- **Description:** "Search for products in the store catalog by title, description, or category"
- **Input Schema:** `{ query: string (1-200), limit?: number (1-50, default 10) }`
- **Auth Required:** No
- **Tables Accessed:** `products`
- **Client Used:** Admin (service key) -- **bypasses RLS**

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | Admin client bypasses RLS | CRITICAL | Uses `SUPABASE_SERVICE_KEY` which bypasses all Row Level Security. Any product is queryable regardless of RLS policies (e.g., tenant isolation, draft products). Only filters by `status = 'active'` in application code. |
| 2 | `total` field is misleading | LOW | Returns `mappedProducts.length` (capped by limit), not the actual total count of matching products. AI may interpret this as "there are only 10 results" when there are 500. |
| 3 | No offset/pagination | MEDIUM | No `offset` parameter, so AI cannot paginate through results beyond the first page. |
| 4 | ILIKE on 3 fields without index | LOW | `or(title.ilike, description.ilike, category.ilike)` may be slow on large catalogs. Consider full-text search or trigram index. |

**Positive:**
- `sanitizeForLike()` properly escapes `%`, `_`, `\` for PostgreSQL ILIKE -- prevents ILIKE injection
- Zod enforces max query length (200 chars) and limit bounds
- Consistent error response structure

### 2.2 `get_product_details`

- **File:** `src/tools/get-product-details.ts`
- **Description:** "Get detailed information about a specific product, including variants, images, and pricing"
- **Input Schema:** `{ product_id: UUID }`
- **Auth Required:** No
- **Tables Accessed:** `products`, `product_variants`
- **Client Used:** Admin (service key)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | Fetches `SELECT *` from products | MEDIUM | `select('*')` retrieves all columns including potentially sensitive fields (internal notes, printful_id, cost data, margin data). Should select only public-facing fields. |
| 2 | No check for product visibility | LOW | Filters by `status = 'active'` but if there are other visibility rules (e.g., region-restricted, tenant-specific), they are bypassed since admin client skips RLS. |
| 3 | Returns all variants without pagination | LOW | For products with many variants (100+), response can be large. |

**Positive:**
- UUID validation via Zod `z.string().uuid()`
- Two-query pattern (product + variants) is clean, not N+1
- Properly extracts unique sizes/colors for AI convenience
- Handles JSONB images array safely with null checks

### 2.3 `get_product_reviews`

- **File:** `src/tools/get-product-reviews.ts`
- **Description:** "Get reviews for a product. Returns paginated list of reviews with rating, text, and author name."
- **Input Schema:** `{ product_id: UUID, page?: int (default 1), limit?: int (1-20, default 10) }`
- **Auth Required:** No
- **Tables Accessed:** `products`, `reviews`, `users`
- **Client Used:** Admin (service key)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | User names exposed via admin client | HIGH | Fetches `users.name` using admin client, which bypasses any RLS on the `users` table. While review author names are typically public, this pattern could expose names for users who haven't set their profile to public. |
| 2 | N+1-adjacent pattern for user names | MEDIUM | Fetches all unique user_ids and does a second query. This is acceptable (batch, not N+1), but if `userIds` is empty, it passes an empty array to `.in('id', [])` which may behave unexpectedly depending on Supabase/PostgREST version. |
| 3 | No product existence validation before reviews query | LOW | Checks `products` table for avg_rating, but doesn't verify product is `active`. Could return reviews for deleted/draft products. |

**Positive:**
- Proper pagination with `page` and `limit`
- Only shows `status = 'approved'` reviews
- Returns aggregate `average_rating` and `total_reviews` alongside individual reviews

### 2.4 `list_categories`

- **File:** `src/tools/list-categories.ts`
- **Description:** "List all product categories with product counts. Useful for browsing the store without a search query."
- **Input Schema:** `{}` (no parameters)
- **Auth Required:** No
- **Tables Accessed:** `products`
- **Client Used:** Admin (service key)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | Fetches ALL active products to count categories | HIGH | Queries every active product (`select('category, images')`) to count categories client-side. With 250+ products, this fetches all rows just to group and count. Should use a `GROUP BY` RPC or a materialized view. |
| 2 | No caching | MEDIUM | Category list rarely changes but is computed from scratch every call. Should cache in Redis with a short TTL (e.g., 5 minutes). |

**Positive:**
- Proper slug generation
- Sorted by product count (most popular first)
- Uses first product image as category image (smart default)

### 2.5 `get_cart`

- **File:** `src/tools/get-cart.ts`
- **Description:** "Get the authenticated user's current shopping cart contents, including product details, quantities, and prices"
- **Input Schema:** `{}` (no parameters)
- **Auth Required:** Yes
- **Tables Accessed:** `cart_items`, `products` (join), `product_variants` (join)
- **Client Used:** Admin (service key)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | Empty cart defaults to `currency: 'USD'` | MEDIUM | Line 97: `currency: 'USD'` for empty carts. But the store default is EUR. Should be `'EUR'` or pulled from user profile. |
| 2 | Image URL extraction inconsistent | LOW | Line 112: `images[0]` extracts the raw first element, but doesn't access `.src` or `.url` like other tools do. May return a JSONB object instead of a URL string. |
| 3 | Admin client bypasses cart_items RLS | HIGH | If RLS on `cart_items` is configured to restrict access to own items, the admin client bypasses it. The tool manually filters by `user_id`, but there's no defense-in-depth. |

**Positive:**
- Proper auth check at the top
- Efficient single query with JOIN to products and variants
- Calculates cart total correctly
- Uses variant price with fallback to base price

### 2.6 `update_cart`

- **File:** `src/tools/update-cart.ts`
- **Description:** "Add, update, or remove items from the shopping cart. Set quantity > 0 to add/update, or quantity = 0 to remove."
- **Input Schema:** `{ product_id: UUID, variant_id?: UUID, quantity: int (0-100) }`
- **Auth Required:** Yes
- **Tables Accessed:** `products`, `product_variants`, `cart_items`
- **Client Used:** Admin (service key)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | No stock validation | MEDIUM | Adds items to cart without checking stock/inventory levels. POD products are made-to-order so this may be acceptable, but `is_available` check on the variant level is done (good). |
| 2 | Race condition on quantity update | LOW | Between checking existing item and updating, another request could modify the cart. Low risk for single-user cart. |

**Positive:**
- Excellent variant resolution logic: auto-selects if only one variant, prompts AI with `needsVariantSelection` and `available_variants` if multiple
- Validates product exists and is `active`
- Validates variant exists, belongs to product, and is enabled/available
- Three clear cases: remove (qty=0), update existing, add new
- Proper `updated_at` timestamp on updates

### 2.7 `create_checkout`

- **File:** `src/tools/create-checkout.ts`
- **Description:** "Create a Stripe Checkout Session for cart items and return the checkout URL. NEVER processes payment directly."
- **Input Schema:** `{ success_url?: URL, cancel_url?: URL }`
- **Auth Required:** Yes
- **Tables Accessed:** `cart_items`, `products` (join), `product_variants` (join), `users`
- **Client Used:** Admin (service key) + Stripe API

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | Stripe API key at module scope | MEDIUM | `STRIPE_SECRET_KEY` is read at line 35 at module load time. If env var is empty, it creates a Stripe client with empty key. Should validate or use `getStripeClient()` from `lib/stripe.ts`. |
| 2 | Stripe error message leaks | HIGH | Line 181: `error: err.message` exposes raw Stripe error messages to the AI/user. Stripe errors can contain sensitive information (API key fragments, internal error codes). Should return a generic error. |
| 3 | No cart clearing after checkout creation | LOW | Cart items remain after checkout session is created. If user creates multiple sessions, they could accumulate. (This may be intentional -- Stripe webhooks typically clear the cart on payment success.) |
| 4 | Success URL allows open redirect | MEDIUM | `success_url` and `cancel_url` accept any URL. An attacker could craft a checkout that redirects to a phishing site after payment. Should validate URLs against allowed domains. |
| 5 | Hardcoded shipping countries | LOW | Line 163: `allowed_countries` is hardcoded to 8 countries. Should be configurable or match store configuration. |
| 6 | Currency from product, not normalized | LOW | Uses `product?.currency || 'usd'` -- lowercase 'usd' default is inconsistent with the rest of the codebase which uses 'EUR'. |

**Positive:**
- Strong security comment about NEVER processing payments directly
- Proper Stripe Checkout Session pattern
- Includes metadata (user_id, locale) for webhook processing
- Enables promotion codes (`allow_promotion_codes: true`)
- Requires billing address
- Collects shipping address

### 2.8 `get_order_status`

- **File:** `src/tools/get-order-status.ts`
- **Description:** "Get detailed information about a specific order by ID, including status and line items."
- **Input Schema:** `{ order_id: UUID }`
- **Auth Required:** Yes
- **Tables Accessed:** `orders`, `order_items`, `products` (join)
- **Client Used:** Admin (service key)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | Ownership check AFTER data fetch | MEDIUM | Fetches the entire order (including another user's data) before checking `user_id !== userId`. The admin client already bypassed RLS, so the data was readable. Should filter by `user_id` in the query. |
| 2 | Shipping address exposed | LOW | Returns full `shipping_address` JSON. May contain PII (name, full address). |

**Positive:**
- Proper PGRST116 error handling for not-found
- Ownership verification (even if after fetch)
- Clean line items transformation with cents-to-decimal conversion
- Conditional field inclusion (only includes tracking_number, shipped_at, etc. if present)

### 2.9 `list_my_orders`

- **File:** `src/tools/list-my-orders.ts`
- **Description:** "Get the authenticated user's order history with optional filters for status and limit"
- **Input Schema:** `{ limit?: int (1-100, default 20), status?: enum }`
- **Auth Required:** Yes
- **Tables Accessed:** `orders`
- **Client Used:** Admin (service key)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | No pagination (offset) | MEDIUM | Only has `limit`, no `offset` or `page`. User with 200+ orders cannot browse beyond first 100. |
| 2 | Missing `item_count` in response | LOW | `OrderItem` interface defines `item_count?` but it's never populated. Requires a JOIN or subquery on `order_items`. |

**Positive:**
- Filters by `user_id` in query (not post-fetch)
- Status enum validation via Zod
- Newest first ordering
- Clean response format

### 2.10 `track_shipment`

- **File:** `src/tools/track-shipment.ts`
- **Description:** "Get shipment tracking information for a specific order by ID."
- **Input Schema:** `{ order_id: UUID }`
- **Auth Required:** Yes
- **Tables Accessed:** `orders`
- **Client Used:** Admin (service key)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | Same ownership-after-fetch pattern as get_order_status | MEDIUM | Fetches order data before checking ownership. Should add `.eq('user_id', userId)` to the query. |

**Positive:**
- Graceful handling of unshipped orders (returns status without error)
- Clean shipping address parsing
- Proper ownership verification

### 2.11 `add_to_wishlist`

- **File:** `src/tools/add-to-wishlist.ts`
- **Description:** "Add a product (and optionally a variant) to the authenticated user's default wishlist"
- **Input Schema:** `{ product_id: UUID, variant_id?: UUID }`
- **Auth Required:** Yes
- **Tables Accessed:** `products`, `product_variants`, `wishlists`, `wishlist_items`
- **Client Used:** Admin (service key)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | Does not check product status | MEDIUM | Verifies product exists but doesn't check `status = 'active'`. Can add inactive/draft products to wishlist. |
| 2 | Auto-creates wishlist | LOW | Creates a wishlist on first add. This is a side effect on a write tool, which is acceptable but should be documented. |

**Positive:**
- Validates variant belongs to product
- Handles duplicate detection via UNIQUE constraint (23505 error code)
- Clean "get or create" pattern for default wishlist

### 2.12 `list_wishlist`

- **File:** `src/tools/list-wishlist.ts`
- **Description:** "List all items in the authenticated user's default wishlist with product details"
- **Input Schema:** `{}` (no parameters)
- **Auth Required:** Yes
- **Tables Accessed:** `wishlists`, `wishlist_items`, `products` (join), `product_variants` (join)
- **Client Used:** Admin (service key)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | Auto-creates wishlist on read | LOW | If no wishlist exists, creates one just to return empty results. Unnecessary side effect on a read-only tool. |
| 2 | No pagination | LOW | Returns all wishlist items without limit. Large wishlists could produce big payloads. |
| 3 | Shows deleted/inactive products | LOW | Doesn't filter by product status. Wishlist may show products that are no longer available. |

**Positive:**
- Efficient JOIN query
- Includes product name, price, image, and variant info
- Sorted by `added_at` descending (newest first)

### 2.13 `remove_from_wishlist`

- **File:** `src/tools/remove-from-wishlist.ts`
- **Description:** "Remove a product (and optionally a variant) from the authenticated user's default wishlist"
- **Input Schema:** `{ product_id: UUID, variant_id?: UUID }`
- **Auth Required:** Yes
- **Tables Accessed:** `wishlists`, `wishlist_items`
- **Client Used:** Admin (service key)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | Without variant_id, only removes items with `variant_id IS NULL` | MEDIUM | Line 86: `query = query.is('variant_id', null)`. If user added a product WITH a variant, calling remove without variant_id won't remove it. This is confusing -- the description says "remove a product" which implies removing all entries for that product. |

**Positive:**
- Graceful handling when no wishlist exists (returns `removed: false`)
- Idempotent (removing non-existent item is safe)
- Returns `removed` boolean for confirmation

### 2.14 `get_my_profile`

- **File:** `src/tools/get-my-profile.ts`
- **Description:** "Get the authenticated user's profile information including name, email, locale, and currency preferences"
- **Input Schema:** `{}` (no parameters)
- **Auth Required:** Yes
- **Tables Accessed:** `users`
- **Client Used:** Admin (service key)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | None significant | -- | Clean implementation. |

**Positive:**
- Minimal data exposure (only id, email, name, locale, currency, created_at)
- Proper defaults for missing fields

### 2.15 `update_my_profile`

- **File:** `src/tools/update-my-profile.ts`
- **Description:** "Update the authenticated user's profile information (name, locale). Uses context injection."
- **Input Schema:** `{ name?: string, locale?: enum('en','es','de') }`
- **Auth Required:** Yes
- **Tables Accessed:** `users`
- **Client Used:** Admin (service key)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | No name length validation | MEDIUM | `name` field has no max length. User could set a 10,000-character name. Should add `.max(100)` or similar. |
| 2 | No name content sanitization | LOW | Name could contain HTML/script tags. While this is stored in DB and not rendered by the MCP server, downstream consumers might render it unsafely. |

**Positive:**
- Context injection pattern: userId comes from authInfo, NOT from input parameters
- Validates at least one field is provided
- Locale restricted to valid enum values
- Returns updated profile for confirmation

### 2.16 `get_store_info`

- **File:** `src/tools/get-store-info.ts`
- **Description:** "Get general information about the store, including name, description, supported currencies, and features"
- **Input Schema:** `{}` (no parameters)
- **Auth Required:** No
- **Tables Accessed:** None (static/env data)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | Hardcoded data, not from DB | LOW | Store name, description, features are hardcoded or from env vars. Changes require redeployment. Fine for now. |

**Positive:**
- No database access (fast, no errors possible)
- Good AI-friendly response with features list
- Supports env var overrides for store name/description

### 2.17 `get_store_policies`

- **File:** `src/tools/get-store-policies.ts`
- **Description:** "Get store policies including shipping, returns/refunds, and privacy information"
- **Input Schema:** `{}` (no parameters)
- **Auth Required:** No
- **Tables Accessed:** None (hardcoded)

**Issues:**
| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | Hardcoded policy text | LOW | Policies are hardcoded in TypeScript. Should eventually come from CMS/database for easy updates. |
| 2 | Brand name "POD AI Store" instead of "SKAPARA" | LOW | Privacy policy references "POD AI Store" but the brand is "SKAPARA". |

**Positive:**
- Comprehensive policy text
- Structured by category (shipping, returns, privacy)
- GDPR compliance section included

---

## 3. Cross-Cutting Concerns

### 3.1 CRITICAL: Admin Client Used for ALL Queries

**Severity: CRITICAL**

Every single tool uses `getSupabaseClient()` which returns a client initialized with `SUPABASE_SERVICE_KEY`. This client **bypasses ALL Row Level Security (RLS)** policies.

**Impact:**
- If RLS policies on `products`, `orders`, `cart_items`, `users`, `wishlists`, or `wishlist_items` are meant to restrict access (e.g., multi-tenancy, soft-deleted products), those restrictions are completely bypassed
- The only access control is application-level `user_id` filtering, which is a single point of failure
- If any tool has a bug in its userId check, data from ALL users is accessible

**Recommendation:**
For protected tools, create a per-request Supabase client using the user's JWT (from `authInfo.token`) or at minimum use the anon key with a `supabase.auth.setSession()` call. This provides defense-in-depth via RLS.

For public tools, the admin client is acceptable since they only query `status = 'active'` products, but a public/anon client would be safer.

### 3.2 Authorization Pattern

**Severity: Overall GOOD, with caveats**

All 11 protected tools consistently check:
```typescript
if (!authInfo || !authInfo.extra?.userId) {
  return { success: false, error: 'Authentication required...' };
}
```

The JWT validation in `src/auth/session.ts` properly:
- Verifies signature with `jose.jwtVerify`
- Checks issuer
- Checks revocation (Redis + in-memory fallback)
- Returns null for invalid/expired tokens (public tools still work)

**However:** The MCP SDK does NOT enforce auth at the transport level. Invalid tokens result in `authInfo = null`, and the tool handler is still called. Each tool must check auth individually. If a developer forgets the auth check, the tool becomes public. There is no middleware-level auth enforcement.

### 3.3 Error Handling

**Severity: GOOD overall, one HIGH issue**

Consistent pattern across all tools:
- Try/catch wrapping
- `console.error` for internal logging
- Generic error messages returned to caller (e.g., "Failed to fetch cart items")
- `success: boolean` field in all responses
- No stack traces leaked

**Exception:** `create_checkout` (line 181) returns `err.message` directly, which can leak Stripe internal error details.

### 3.4 SQL Injection

**Severity: SAFE**

No raw SQL anywhere. All queries use Supabase query builder (`.from().select().eq().single()`). The one ILIKE pattern in `search_products` is properly sanitized with `sanitizeForLike()`.

### 3.5 Response Format Consistency

All tools return:
```typescript
{
  success: boolean,
  error?: string,       // only on failure
  [data]?: ...          // tool-specific data on success
}
```

Prices are consistently converted from cents to decimal (`/ 100`).

Currency is generally uppercased, with one inconsistency: `get_cart` defaults to `'USD'` for empty carts while the store default is EUR.

### 3.6 Rate Limiting

Rate limiting is applied at the HTTP handler level (`index.ts:735`) with per-tool limits:
- `create_checkout`: 5/min
- `search_products`: 60/min
- `update_cart`: 30/min
- `add_to_wishlist` / `remove_from_wishlist`: 30/min

Redis sliding window with in-memory fallback. Well-implemented.

### 3.7 Audit Logging

All tools are wrapped with `withAuditLog()` which logs:
- Timestamp, tool name, duration, success, user_id
- Sanitized input (redacts tokens, passwords, API keys)

Good implementation. Logs to stdout as structured JSON.

---

## 4. Missing Tools (Completeness Gap)

Tools that a full e-commerce MCP server should have but are currently missing:

| Missing Tool | Priority | Description |
|---|---|---|
| `validate_coupon` / `apply_coupon` | HIGH | Coupon system exists in frontend but no MCP tool. AI cannot apply discounts. |
| `submit_review` | MEDIUM | Can read reviews but not create them. AI should help users leave reviews. |
| `request_return` | MEDIUM | No way to initiate returns via AI. Policy says "contact support". |
| `get_shipping_estimate` | MEDIUM | No way to get shipping cost before checkout. |
| `search_products_by_category` | LOW | Must use search_products with category name as query (works but suboptimal). |
| `clear_cart` | LOW | Can only remove items one-by-one (quantity=0). No bulk clear. |
| `get_product_availability` | LOW | No explicit stock/availability check tool. |
| `update_shipping_address` | LOW | No way to update default shipping address via AI. |
| `contact_support` | LOW | No tool to create support tickets or send messages. |
| `get_product_recommendations` | LOW | No personalized recommendations tool. |

---

## 5. Ownership Verification Pattern Issues

### fetch-then-check vs. filter-in-query

Two tools (`get_order_status`, `track_shipment`) fetch data first, then check ownership:

```typescript
// CURRENT (vulnerable to timing attacks, loads unauthorized data into memory)
const { data: orderData } = await supabase.from('orders').eq('id', order_id).single();
if (orderData.user_id !== userId) { return error; }

// BETTER (filter in query, never loads unauthorized data)
const { data: orderData } = await supabase.from('orders').eq('id', order_id).eq('user_id', userId).single();
if (!orderData) { return 'Order not found'; }
```

The current pattern is safe because the admin client bypasses RLS (the data is accessible anyway), but it's a bad practice. If the code is ever migrated to use a user-scoped client, the fetch-then-check pattern would need to change.

---

## 6. Summary of Issues by Severity

### CRITICAL (2)

1. **Admin client bypasses RLS for ALL queries** -- Every tool uses the service key client. No defense-in-depth via database-level access control. If any ownership check has a bug, all user data is exposed.
2. **`list_categories` fetches ALL products** -- Fetches every active product to compute category counts. O(n) data transfer on every call. Will degrade as catalog grows.

### HIGH (4)

1. **`create_checkout` leaks Stripe error messages** -- `err.message` returned directly to caller.
2. **`get_cart` admin client bypasses cart_items RLS** -- Application-level userId filter is the only protection.
3. **`get_product_reviews` exposes user names via admin client** -- Bypasses any RLS on users table.
4. **`get_order_status` / `track_shipment` ownership check AFTER data fetch** -- Loads unauthorized data into memory before checking.

### MEDIUM (7)

1. **`search_products` has no offset/pagination** -- Cannot browse beyond first page.
2. **`get_product_details` uses SELECT * ** -- May expose internal/sensitive columns.
3. **`get_cart` defaults to USD instead of EUR** for empty carts.
4. **`list_categories` has no caching** -- Expensive computation on every call.
5. **`create_checkout` allows open redirect** via success_url/cancel_url.
6. **`update_my_profile` has no name length limit** -- Unbounded string.
7. **`remove_from_wishlist` only removes variant_id IS NULL items** when no variant_id specified.

### LOW (5)

1. `search_products` total count is misleading (returns page count, not total).
2. `list_my_orders` missing `item_count` field that's in the interface.
3. `get_store_policies` uses "POD AI Store" instead of "SKAPARA" brand name.
4. `list_wishlist` auto-creates wishlist on read (unnecessary side effect).
5. `create_checkout` hardcodes shipping countries list.

---

## 7. Recommendations (Priority Order)

1. **Create a user-scoped Supabase client** for protected tools that uses the user's auth context, providing RLS as defense-in-depth alongside application-level checks.
2. **Fix `create_checkout` to not leak Stripe errors** -- return generic "Checkout creation failed" message.
3. **Add pagination (offset) to `search_products` and `list_my_orders`**.
4. **Optimize `list_categories`** with a database function or Redis cache.
5. **Change ownership checks to filter-in-query** for `get_order_status` and `track_shipment`.
6. **Validate success_url/cancel_url** against allowed domains in `create_checkout`.
7. **Add `validate_coupon` tool** -- the coupon system exists in the frontend but is inaccessible via MCP.
8. **Add `.max(100)` to name field** in `update_my_profile` schema.
9. **Replace `SELECT *`** in `get_product_details` with explicit column list.
10. **Fix empty cart currency** from `'USD'` to `'EUR'`.

---

*Report generated 2026-03-09 by Claude Opus 4.6*
*Files audited: 17 tool files + index.ts + lib/supabase.ts + auth/session.ts + lib/audit-log.ts + middleware/rate-limit.ts*
