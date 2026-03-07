---
name: Webhooks & Idempotency Audit
description: >
  Comprehensive audit of ALL webhook handlers — Stripe and POD provider (Printify/Printful).
  Covers signature verification, idempotency guarantees, error isolation, retry safety, database
  transaction consistency, and monitoring. Use when asked to audit webhooks, idempotency, event
  handling, or webhook security.
allowed-tools: Read, Grep, Glob, Bash
---

# Webhooks & Idempotency Audit

Systematic audit of every webhook endpoint: signature verification, idempotent event processing, error isolation between event types, database transaction consistency, retry safety (always return 200 after signature verification), audit logging, and monitoring/alerting gaps.

## Prerequisites

Before starting, read these files for architectural context:

- `CLAUDE.md` — component standards, Supabase connection reference, Stripe/Printful details
- `memory/MEMORY.md` — current project state, known blockers, connection details

## File Map

Keep this reference open throughout the audit. All paths relative to `frontend/src/`.

### Stripe Webhook

| File | Role |
|---|---|
| `app/api/webhooks/stripe/route.ts` (1002 lines) | Main Stripe webhook handler — all Stripe events |

**Events handled in Stripe webhook:**

| Event | Purpose | Lines (approx) |
|---|---|---|
| `checkout.session.completed` | Creates order from paid session | 90-200 |
| `subscription.created` | Activates user subscription | 200-300 |
| `subscription.updated` | Updates subscription tier/status | 300-400 |
| `subscription.deleted` | Deactivates subscription | 400-450 |
| `payment_intent.succeeded` | Credit purchase fulfillment | 450-550 |
| `payment_intent.failed` | Failed payment logging | 550-600 |
| `invoice.payment_failed` | Subscription payment failure handling | 600-700 |
| `charge.dispute.created` | Dispute/chargeback handling | 700-800 |

**Key idempotency mechanisms:**
- Order creation: checks `orders.stripe_session_id` before INSERT (lines 151-162)
- Credit transactions: UNIQUE constraint on `(user_id, stripe_payment_id)` in `credit_transactions`
- Always returns 200 after successful signature verification

### POD Provider Webhooks

| File | Role |
|---|---|
| `app/api/webhooks/pod/[provider]/route.ts` (146 lines) | Dynamic route for Printify/Printful webhooks |

**Provider-specific signature verification:**
- Printify: HMAC signature verification
- Printful: Secret parameter verification

**Event normalization:**
- `providerInstance.normalizeEvent()` — converts provider-specific event to common format

### Webhook Event Handlers

| File | Role |
|---|---|
| `lib/pod/webhooks/handlers/order-shipped.ts` (167 lines) | Updates order status, sends shipping email |
| `lib/pod/webhooks/handlers/order-delivered.ts` | Updates order status, sends delivery email |
| `lib/pod/webhooks/handlers/order-cancelled.ts` | Updates order status, sends cancellation email |

### Supporting Infrastructure

| File | Role |
|---|---|
| `lib/stripe.ts` | Stripe client initialization |
| `lib/supabase-admin.ts` | Admin Supabase client (used in webhooks for RLS bypass) |
| `lib/pod/providers/` | Provider implementations with event normalization |

### Database Tables Affected by Webhooks

| Table | Webhook Source | Operation |
|---|---|---|
| `orders` | Stripe (checkout.session.completed) | INSERT |
| `order_items` | Stripe (checkout.session.completed) | INSERT |
| `notifications` | Stripe + POD | INSERT |
| `audit_log` | POD webhooks | INSERT |
| `credit_transactions` | Stripe (payment_intent.succeeded) | INSERT |
| `users` | Stripe (subscription.*) | UPDATE (tier, subscription_status) |

---

## Workflow

Execute each phase sequentially. Record every finding with severity, file path, and line number.

### Phase 1: Stripe Webhook Signature Verification (6 checks)

#### 1.1 Signature Construction

- Read `app/api/webhooks/stripe/route.ts` — lines 1-60
- **Check**: `stripe.webhooks.constructEvent()` is called with raw body (not parsed JSON)
- **Check**: Raw body is obtained via `request.text()` or equivalent (not `request.json()`)
- **Check**: Webhook signing secret is from env var (`STRIPE_WEBHOOK_SECRET`)
- **Check**: Secret is not hardcoded or logged
- **Severity**: CRITICAL if signature verification is missing or uses parsed body

#### 1.2 Signature Failure Handling

- **Check**: Invalid signature returns HTTP 400 (not 200 — must not acknowledge bad events)
- **Check**: Error message does not leak the webhook secret or internal details
- **Check**: Failed verification is logged for monitoring

#### 1.3 Event Type Routing

- **Check**: Event type is extracted from verified event object (not from request body before verification)
- **Check**: Unknown event types are handled gracefully (logged and return 200)
- **Check**: Switch/if-else covers all documented event types

#### 1.4 HTTP Method

- **Check**: Only POST is accepted (GET returns 405)
- **Check**: Content-Type is not strictly enforced (Stripe sends various types)

#### 1.5 Replay Protection

- **Check**: Stripe's built-in timestamp tolerance is not overridden to an unsafe value
- **Check**: Events older than 5 minutes (Stripe default) are rejected by `constructEvent`
- **Benchmark**: Stripe default tolerance is 300 seconds — do not increase this

#### 1.6 Multiple Webhook Endpoints

- Search for other Stripe webhook routes in the codebase
- **Check**: There is only ONE Stripe webhook endpoint (multiple endpoints = duplicate processing risk)
- **Check**: If multiple exist, they handle disjoint event sets

### Phase 2: POD Webhook Signature Verification (5 checks)

#### 2.1 Provider Routing

- Read `app/api/webhooks/pod/[provider]/route.ts`
- **Check**: Dynamic `[provider]` parameter is validated against allowed list (printify, printful)
- **Check**: Unknown provider returns 400 (not 500 or unhandled error)

#### 2.2 Printify Signature

- Search for HMAC, signature verification in POD webhook and provider files
- **Check**: HMAC-SHA256 signature is verified against request body
- **Check**: Printify webhook secret is from env var
- **Check**: Timing-safe comparison is used (not `===`)
- **Severity**: CRITICAL if timing-safe comparison is missing (timing attack vulnerability)

#### 2.3 Printful Signature

- **Check**: Printful webhook secret/token verification is implemented
- **Check**: Secret is from env var
- **Check**: Verification happens before any event processing

#### 2.4 Event Normalization

- **Check**: `providerInstance.normalizeEvent()` converts to a common event schema
- **Check**: Normalization failures are caught and logged (not thrown to crash handler)
- **Check**: Normalized event includes: event_type, order_id, provider, timestamp, raw_data

#### 2.5 Audit Logging

- **Check**: Every POD webhook event is logged to `audit_log` table
- **Check**: Log includes: provider, event_type, payload (sanitized), timestamp, processing_result
- **Check**: Failed events are logged with error details

### Phase 3: Idempotency — Stripe Events (8 checks)

#### 3.1 Order Creation Idempotency

- Read `app/api/webhooks/stripe/route.ts` — checkout.session.completed handler
- **Check**: Before INSERT into `orders`, handler checks if order with same `stripe_session_id` exists
- **Check**: If order already exists, handler returns 200 without creating duplicate
- **Check**: The idempotency check and INSERT are in the same transaction (no TOCTOU race)
- **Severity**: CRITICAL if duplicate orders can be created on webhook retry

#### 3.2 Credit Transaction Idempotency

- Read payment_intent.succeeded handler
- **Check**: `credit_transactions` table has UNIQUE constraint on `(user_id, stripe_payment_id)`
- **Check**: Duplicate INSERT is caught via unique constraint violation (not pre-check only)
- **Check**: Constraint violation returns 200 (not 500 — Stripe would retry on 500)

#### 3.3 Subscription Idempotency

- Read subscription.created/updated/deleted handlers
- **Check**: Subscription updates are idempotent (applying same update twice = same result)
- **Check**: Subscription status transitions are valid (can't go from cancelled to active without new subscription)
- **Check**: `subscription_id` is stored and checked for dedup

#### 3.4 Payment Failed Idempotency

- Read payment_intent.failed and invoice.payment_failed handlers
- **Check**: Failed payment logging is idempotent (duplicate fail events don't create duplicate notifications)
- **Check**: User is not spammed with multiple failure notifications for same event

#### 3.5 Dispute Idempotency

- Read charge.dispute.created handler
- **Check**: Dispute handling is idempotent
- **Check**: Order status update from dispute is idempotent (setting "disputed" on already "disputed" order is no-op)

#### 3.6 Stripe Event ID Tracking

- Search for `event.id`, `stripe_event_id` in webhook handler
- **Check**: Is Stripe event ID (`evt_xxx`) stored and checked for global dedup?
- **Check**: If not, assess risk — Stripe can send same event ID multiple times on retry
- **Benchmark**: Best practice is to store processed event IDs in a dedup table with TTL

#### 3.7 Database Transaction Boundaries

- Search for `BEGIN`, `TRANSACTION`, `.rpc(`, `supabase.from(...).insert(...).select(` patterns
- **Check**: Order creation (order + order_items + notification) is in a single transaction
- **Check**: If any step fails, all steps are rolled back (not partial order)
- **Check**: Supabase client supports transactions (or uses RPC for atomic operations)
- **Severity**: FAIL if order can be created without order_items (partial write)

#### 3.8 Concurrent Webhook Handling

- **Check**: Two concurrent webhooks for different events don't interfere (e.g., subscription update + order creation)
- **Check**: Two concurrent webhooks for SAME event (retry) are handled via idempotency checks
- **Check**: Database locks (row-level or advisory) are used where needed

### Phase 4: Idempotency — POD Events (5 checks)

#### 4.1 Order Shipped Idempotency

- Read `lib/pod/webhooks/handlers/order-shipped.ts`
- **Check**: Shipping update is idempotent (setting status to "shipped" on already "shipped" order is no-op)
- **Check**: Tracking number update is idempotent (same tracking = no duplicate notification)
- **Check**: Email is not sent again if order is already "shipped"
- **Severity**: FAIL if duplicate shipping emails are sent

#### 4.2 Order Delivered Idempotency

- Read `lib/pod/webhooks/handlers/order-delivered.ts`
- **Check**: Delivery update is idempotent
- **Check**: Duplicate delivery webhook does not re-send email

#### 4.3 Order Cancelled Idempotency

- Read `lib/pod/webhooks/handlers/order-cancelled.ts`
- **Check**: Cancellation is idempotent
- **Check**: Refund is not triggered twice on duplicate cancellation events
- **Check**: If refund is triggered, it has its own idempotency (Stripe refund idempotency key)
- **Severity**: CRITICAL if duplicate refunds are possible

#### 4.4 Status Transition Validation

- **Check**: Order status follows valid transitions (pending -> processing -> shipped -> delivered)
- **Check**: Invalid transitions are rejected (can't go from "delivered" back to "processing")
- **Check**: Transition validation is in the handler (not just in the DB)

#### 4.5 Event Dedup at POD Level

- **Check**: POD webhook events have a unique event ID from the provider
- **Check**: Event ID is stored and checked before processing
- **Check**: If no provider event ID, what prevents duplicate processing?

### Phase 5: Error Isolation & Retry Safety (7 checks)

#### 5.1 Always Return 200

- Read both webhook route files
- **Check**: After successful signature verification, handler ALWAYS returns 200
- **Check**: Even if internal processing fails (DB error, email error), response is still 200
- **Check**: Only signature verification failure returns non-200 (400)
- **Severity**: CRITICAL if processing errors return 500 (Stripe will retry endlessly)

#### 5.2 Error Isolation Between Events

- **Check**: Failure in one event handler does not affect other events
- **Check**: Each event type has its own try-catch block
- **Check**: A crash in subscription handler doesn't prevent order creation handler from working

#### 5.3 Email Sending Failure

- Search for email sending in webhook handlers (Resend, nodemailer, etc.)
- **Check**: Email sending failure is caught and logged (not thrown)
- **Check**: Order/status update succeeds even if email fails
- **Check**: Failed emails are queued for retry (or at least logged for manual follow-up)
- **Severity**: FAIL if email failure causes order creation to fail

#### 5.4 Database Error Handling

- **Check**: Supabase errors (connection timeout, constraint violation) are caught
- **Check**: Caught DB errors are logged with context (event type, event ID, error message)
- **Check**: DB errors return 200 (with internal logging) — not 500

#### 5.5 External Service Failures

- **Check**: Printful API calls from webhook handlers (e.g., fetching order details) handle timeouts
- **Check**: If external call fails, webhook still returns 200 (with internal error logging)
- **Check**: Retry logic for external calls has backoff (not infinite retry)

#### 5.6 Payload Size Limits

- **Check**: Webhook endpoint has body size limit (large payloads could be attack vector)
- **Check**: Next.js default body limit is appropriate (or explicitly configured)
- **Check**: Oversized payloads are rejected before processing

#### 5.7 Timeout Handling

- **Check**: Webhook handler completes within Stripe's timeout (20 seconds)
- **Check**: Long-running operations (email, Printful API) are async/queued (not blocking response)
- **Check**: If processing takes too long, response is still sent and processing continues in background
- **Benchmark**: Stripe expects response within 20 seconds; retries on timeout

### Phase 6: Database Consistency (6 checks)

#### 6.1 Order Creation Atomicity

- Read checkout.session.completed handler in detail
- **Check**: `orders` INSERT and `order_items` INSERTs happen atomically
- **Check**: If `order_items` INSERT fails, the `orders` row is rolled back
- **Check**: `notifications` INSERT failure does not roll back the order
- **Severity**: CRITICAL if partial orders can exist (order without items)

#### 6.2 User Tier Update Consistency

- Read subscription.* handlers
- **Check**: User `tier` and `subscription_status` updates are atomic
- **Check**: Subscription metadata (plan_id, period_end) is updated consistently
- **Check**: Downgrade cleans up tier-specific data (or marks for cleanup)

#### 6.3 Credit Balance Integrity

- Read payment_intent.succeeded handler
- **Check**: Credit is added atomically (INSERT credit_transaction + UPDATE user balance)
- **Check**: UNIQUE constraint prevents double-credit
- **Check**: If UPDATE fails after INSERT, balance is inconsistent — is this handled?
- **Severity**: CRITICAL if users can receive double credits

#### 6.4 Order Status Updates

- Read POD webhook handlers
- **Check**: Status update uses UPDATE with WHERE clause including current status (optimistic locking)
- **Check**: If UPDATE matches 0 rows (status already changed), handler returns success
- **Check**: Status history is preserved (audit trail of status changes)

#### 6.5 Notification Creation

- **Check**: Notifications are created for: order placed, shipped, delivered, cancelled, payment failed
- **Check**: Notification creation failure is non-blocking (order still processes)
- **Check**: Notifications are user-scoped (correct user_id)

#### 6.6 Audit Log Completeness

- Search for `audit_log` INSERTs across all webhook handlers
- **Check**: All event types are logged (not just POD events)
- **Check**: Log entries include: event_type, source (stripe/printify/printful), payload_hash, result, error
- **Check**: Sensitive data is redacted from audit log (no card numbers, no full addresses)

### Phase 7: Monitoring, Alerting & Operational Readiness (6 checks)

#### 7.1 Webhook Secret Rotation

- **Check**: Is there a documented process for rotating webhook secrets?
- **Check**: Can secrets be rotated without downtime (e.g., support for old+new secret during transition)?
- **Check**: Stripe supports multiple webhook signing secrets — is this leveraged?
- **Benchmark**: Secrets should be rotated at least annually

#### 7.2 Failed Webhook Monitoring

- Search for monitoring, alerting, error reporting integrations (Sentry, LogRocket, etc.)
- **Check**: Failed webhook processing is reported to an error tracking service
- **Check**: Alerts fire when webhook failure rate exceeds threshold
- **Check**: Dashboard or log query exists for webhook health

#### 7.3 Dead Letter Queue

- Search for DLQ, dead letter, failed_events, retry_queue patterns
- **Check**: Events that fail processing after all retries are stored for manual review
- **Check**: If no DLQ exists, how are permanently failed events handled?
- **Benchmark**: Production systems should have a DLQ or equivalent

#### 7.4 Webhook Health Endpoint

- Search for health check, status endpoint related to webhooks
- **Check**: Is there a way to verify webhook connectivity (e.g., test event processing)?
- **Check**: Stripe dashboard shows webhook delivery status — is it monitored?

#### 7.5 Rate Limiting on Webhook Endpoints

- **Check**: Webhook endpoints are not rate-limited (they should accept all events)
- **Check**: However, abuse protection exists (e.g., reject events from non-Stripe IPs)
- **Check**: Body size limits protect against payload abuse

#### 7.6 Logging Standards

- **Check**: All webhook logs include correlation ID (Stripe event ID or provider event ID)
- **Check**: Log levels are appropriate (INFO for success, ERROR for failure, WARN for dedup skip)
- **Check**: Logs are structured (JSON format) for searchability
- **Check**: PII is not logged (no email addresses, names, or addresses in logs)

---

## Output Format

Generate `AUDIT_WEBHOOKS_IDEMPOTENCY_[DATE].md` at the workspace root with the following structure:

```markdown
# Webhooks & Idempotency Audit — [DATE]

## Executive Summary

[2-3 paragraph overview: what is solid, what has gaps, what is at risk. State whether webhooks are production-safe for payment processing and order fulfillment.]

## Scorecard

| Category | Checks | Pass | Warn | Fail | Critical | Score |
|---|---|---|---|---|---|---|
| Stripe Signature Verification | 6 | X | X | X | X | X% |
| POD Signature Verification | 5 | X | X | X | X | X% |
| Idempotency — Stripe Events | 8 | X | X | X | X | X% |
| Idempotency — POD Events | 5 | X | X | X | X | X% |
| Error Isolation & Retry Safety | 7 | X | X | X | X | X% |
| Database Consistency | 6 | X | X | X | X | X% |
| Monitoring & Operations | 6 | X | X | X | X | X% |
| **TOTAL** | **43** | **X** | **X** | **X** | **X** | **X%** |

## Findings

| ID | Severity | Category | Finding | File:Line | Recommendation |
|---|---|---|---|---|---|
| WH-001 | CRITICAL | Idempotency | [description] | `src/app/api/webhooks/stripe/route.ts:XX` | [fix] |
| WH-002 | FAIL | Error Isolation | [description] | `src/lib/pod/webhooks/handlers/order-shipped.ts:XX` | [fix] |
| WH-003 | WARN | Monitoring | [description] | N/A | [fix] |
| ... | ... | ... | ... | ... | ... |

## Critical Blockers (Must Fix Before Production)

1. [WH-001] — [description and fix]
2. ...

## High Priority (Fix Within Sprint)

1. [WH-0XX] — [description]
2. ...

## Warnings (Fix Before V2)

1. [WH-0XX] — [description]
2. ...

## Priority Actions

1. **Immediate** (before launch): [list CRITICAL items — any idempotency gaps on payment/order events]
2. **This sprint**: [list FAIL items — error isolation, email failure handling]
3. **Next sprint**: [list WARN items — monitoring, DLQ, secret rotation]

## Webhook Event Matrix

| Event | Source | Idempotency Key | Dedup Mechanism | Email Sent | Status |
|---|---|---|---|---|---|
| checkout.session.completed | Stripe | stripe_session_id | SELECT before INSERT | Order confirmation | [PASS/FAIL] |
| subscription.created | Stripe | subscription_id | [describe] | Welcome email | [PASS/FAIL] |
| subscription.updated | Stripe | subscription_id | [describe] | None | [PASS/FAIL] |
| subscription.deleted | Stripe | subscription_id | [describe] | Cancellation email | [PASS/FAIL] |
| payment_intent.succeeded | Stripe | stripe_payment_id | UNIQUE constraint | Credit confirmation | [PASS/FAIL] |
| payment_intent.failed | Stripe | [describe] | [describe] | Failure notice | [PASS/FAIL] |
| invoice.payment_failed | Stripe | [describe] | [describe] | Payment reminder | [PASS/FAIL] |
| charge.dispute.created | Stripe | [describe] | [describe] | None (admin alert) | [PASS/FAIL] |
| order.shipped | POD | [describe] | [describe] | Shipping notification | [PASS/FAIL] |
| order.delivered | POD | [describe] | [describe] | Delivery notification | [PASS/FAIL] |
| order.cancelled | POD | [describe] | [describe] | Cancellation notice | [PASS/FAIL] |
```

## Severity Levels

- **CRITICAL**: Double charges, duplicate orders, duplicate refunds, missing signature verification, data corruption. Blocks production launch.
- **FAIL**: Missing idempotency on non-financial events, email spam on retry, partial database writes. Must fix before release.
- **WARN**: Missing monitoring, no DLQ, missing audit logs, no secret rotation plan. Should fix before V2.
- **PASS**: Meets standards and payment processing best practices.

## Notes

- Always verify findings against actual code (read the file, cite the line number). Never report speculative issues.
- Webhooks are the backbone of payment processing and order fulfillment. Any CRITICAL finding is a hard launch blocker.
- Pay special attention to the "return 200" rule: after signature verification passes, the handler MUST return 200 regardless of internal errors. Returning 500 causes Stripe to retry, potentially creating duplicates or causing webhook suspension.
- For idempotency checks, verify not just that the check exists, but that it is atomic with the write (no TOCTOU window).
- For each CRITICAL or FAIL finding, include a concrete code-level recommendation with the specific fix.
- The Webhook Event Matrix in the output must be filled with real data from the codebase (actual idempotency keys used, not assumptions).
