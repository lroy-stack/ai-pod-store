---
name: Email Templates & Deliverability Audit
description: >
  Comprehensive audit of all transactional, drip, and marketing email templates — CAN-SPAM compliance,
  RFC 8058 one-click unsubscribe, HTML structure, responsive design, i18n coverage, and deliverability
  configuration. Use when asked to audit emails, email templates, email compliance, or deliverability.
allowed-tools: Read, Grep, Glob, Bash
---

# Email Templates & Deliverability Audit

Systematic audit of all email-sending code paths: transactional order emails, drip sequences, abandoned cart recovery, newsletter, and webhook-triggered emails. Covers legal compliance, HTML quality, i18n, brand consistency, and deliverability.

## Prerequisites

Before starting, read these files for architectural context:

- `CLAUDE.md` — component standards, Supabase connection reference, environment variables
- `frontend/src/lib/resend.ts` — main email service (6 transactional templates, 821 lines)
- `frontend/src/lib/email-drip.ts` — drip queue system (78 lines)

## File Map

Keep this reference open throughout the audit. All paths relative to `frontend/src/`.

### Core Email Service

| File | Role |
|---|---|
| `lib/resend.ts` | 6 transactional email functions: sendOrderConfirmationEmail (50-174), sendOrderShippedEmail (179-294), sendOrderCancelledEmail (299-429), sendOrderDeliveredEmail (434-563), sendOrderFailedEmail (568-675), sendCreditPurchaseEmail (680-821) |
| `lib/resend.ts:12-24` | EMAIL_COLORS constant — shared color palette for all templates |

### Drip System

| File | Role |
|---|---|
| `lib/email-drip.ts` | Welcome drip sequence: 1h, 72h, 168h delays. Uses `drip_queue` table |
| `app/api/cron/drip/route.ts` | Drip cron handler (192 lines). Templates: welcome, tips, credit_offer. HAS RFC 8058 headers (lines 149-150) |

### Abandoned Cart Recovery

| File | Role |
|---|---|
| `app/api/cron/abandoned-cart-recovery/route.ts` | 2 recovery emails at 1h and 24h (300+ lines). NO unsubscribe links, NO RFC 8058 headers |

### Newsletter

| File | Role |
|---|---|
| `app/api/newsletter/subscribe/route.ts` | Double opt-in subscription (178 lines), confirmation token |
| `app/api/newsletter/unsubscribe/route.ts` | Unsubscribe handler (263 lines) |

### Webhook-Triggered Emails

| File | Role |
|---|---|
| `lib/pod/webhooks/handlers/` | Order lifecycle webhook handlers that trigger transactional emails |

### Database Tables

| Table | Purpose |
|---|---|
| `drip_queue` | Pending drip emails (user_id, template, scheduled_at, sent_at) |
| `newsletter_subscribers` | Newsletter subscriptions (email, confirmed, token) |

---

## Workflow

Execute each phase sequentially. Record every finding with severity, file path, and line number.

### Phase 1: CAN-SPAM & Legal Compliance (10 checks)

#### 1.1 Unsubscribe Links — Transactional Emails

- Read `lib/resend.ts` — all 6 email functions
- **Check**: Do transactional emails include an unsubscribe link? (CAN-SPAM requires for commercial content mixed with transactional)
- **Check**: Is the unsubscribe mechanism functional (hits a real endpoint)?
- **Known Gap**: Transactional emails have NO unsubscribe links — verify current status
- **Severity**: FAIL if commercial content (upsells, promotions) is included without unsubscribe

#### 1.2 Unsubscribe Links — Drip Emails

- Read `app/api/cron/drip/route.ts`
- **Check**: Drip emails include unsubscribe links (lines 149-150 have RFC 8058 headers — verify link in body too)
- **Check**: Unsubscribe link leads to a working endpoint
- **Check**: One-click unsubscribe actually removes user from drip queue

#### 1.3 Unsubscribe Links — Abandoned Cart

- Read `app/api/cron/abandoned-cart-recovery/route.ts`
- **Check**: Abandoned cart emails include unsubscribe/opt-out link
- **Known Gap**: NO unsubscribe links, NO RFC 8058 headers — verify current status
- **Severity**: CRITICAL if missing — abandoned cart emails are commercial, CAN-SPAM requires unsubscribe

#### 1.4 RFC 8058 One-Click Unsubscribe Headers

- Search for `List-Unsubscribe`, `List-Unsubscribe-Post` across all email-sending files
- **Check**: Drip emails have RFC 8058 headers (verified in cron/drip)
- **Check**: Abandoned cart emails have RFC 8058 headers
- **Check**: Newsletter emails have RFC 8058 headers
- **Benchmark**: Gmail/Yahoo require RFC 8058 for bulk senders (>5000 emails/day) since Feb 2024

#### 1.5 Physical Address

- Search for address, street, postal, physical in email template HTML across all senders
- **Check**: Every commercial email includes a physical mailing address
- **Check**: Address is in the email footer (not hidden)
- **Check**: Address is consistent across all email types

#### 1.6 Sender Identification

- Search for `from:`, `From`, `reply`, `replyTo` in all email-sending code
- **Check**: From address uses a real domain (not noreply@gmail.com)
- **Check**: From name is the brand name (SKAPARA or configured brand)
- **Check**: Reply-To is set to a monitored address
- **Check**: From address is consistent across all email types

#### 1.7 Subject Line Compliance

- Read subject lines in all email functions
- **Check**: Subject lines are not deceptive or misleading
- **Check**: Subject lines are localized per user locale
- **Check**: No ALL CAPS subjects (spam trigger)

#### 1.8 GDPR Consent (EU Store)

- Search for `consent`, `opt_in`, `gdpr`, `marketing_consent` in newsletter and drip code
- **Check**: Newsletter uses double opt-in (confirmation email before adding to list)
- **Check**: Drip sequence only sends to users who consented to marketing
- **Check**: Consent timestamp is recorded in database
- **Severity**: CRITICAL for EU store — GDPR requires explicit consent for marketing emails

#### 1.9 Opt-Out Processing Time

- Read unsubscribe handler logic
- **Check**: Unsubscribe is processed immediately (not "within 10 days")
- **Check**: No further emails are sent after unsubscribe (check drip queue cleanup)
- **Benchmark**: CAN-SPAM allows 10 business days, but best practice is immediate

#### 1.10 Email Type Classification

- Review all email-sending code paths
- **Check**: Are emails correctly classified as transactional vs. commercial?
- **Check**: Credit purchase confirmation — is this purely transactional or does it include promotions?
- **Check**: Drip "credit_offer" template — this is commercial, verify it has full CAN-SPAM compliance

### Phase 2: HTML Email Structure & Rendering (8 checks)

#### 2.1 DOCTYPE & Character Encoding

- Read HTML output in each email function in `lib/resend.ts`
- **Check**: HTML starts with `<!DOCTYPE html>` and `<html>` tag
- **Check**: `<meta charset="utf-8">` is present
- **Check**: `<meta name="viewport" content="width=device-width, initial-scale=1.0">` is present
- **Benchmark**: Without DOCTYPE, Outlook renders in quirks mode

#### 2.2 Inline CSS

- Examine CSS in email HTML templates
- **Check**: All styles are inline (not in `<style>` block or external CSS)
- **Check**: No CSS classes that depend on `<style>` tag (Gmail strips `<style>` in non-AMP)
- **Check**: If `<style>` is used, it is duplicated as inline styles for fallback
- **Benchmark**: Gmail, Yahoo, and Outlook all handle inline CSS reliably

#### 2.3 Responsive Design

- Check email HTML for responsive patterns
- **Check**: Email uses `max-width: 600px` container (email client standard)
- **Check**: Images use `max-width: 100%` and `height: auto`
- **Check**: Font sizes are readable on mobile (min 14px body, 22px headings)
- **Check**: Buttons have minimum 44px tap targets
- **Benchmark**: 60%+ of emails are read on mobile

#### 2.4 Image Handling

- Search for `<img`, `src=`, image URLs in email HTML
- **Check**: All images have `alt` text
- **Check**: Images use absolute URLs (not relative paths)
- **Check**: Logo/brand images are hosted on reliable CDN (not localhost)
- **Check**: Email is readable with images disabled (text fallbacks)

#### 2.5 Table-Based Layout

- Check if emails use table-based layout (required for Outlook compatibility)
- **Check**: Main structure uses `<table>` elements (not `<div>` flex/grid)
- **Check**: Tables use `role="presentation"` for accessibility
- **Check**: Cell padding is used instead of margin (margin is unreliable in email)
- **Benchmark**: Outlook renders only table-based layouts correctly

#### 2.6 Dark Mode Support

- Search for `color-scheme`, `prefers-color-scheme`, `mso-`, dark mode patterns in email HTML
- **Check**: `<meta name="color-scheme" content="light dark">` is present
- **Check**: Dark mode overrides are provided (or colors are dark-mode-safe)
- **Check**: Logo has transparent background or dark mode variant
- **Benchmark**: 30%+ of users use dark mode in email clients

#### 2.7 Preview Text

- Search for preview text, preheader, hidden text patterns in email HTML
- **Check**: Each email has a preview/preheader text (the snippet shown in inbox list)
- **Check**: Preview text is not just a repeat of the subject line
- **Check**: Preview text is hidden from the email body (zero-size div technique)
- **Benchmark**: Preview text significantly impacts open rates

#### 2.8 Email Size

- Estimate total HTML size of each email template
- **Check**: Email HTML is under 100KB (Gmail clips emails over 102KB)
- **Check**: No large base64 inline images (use hosted URLs instead)
- **Check**: No unnecessary whitespace or comments in production HTML

### Phase 3: Internationalization (6 checks)

#### 3.1 Locale Parameter

- Read each email function signature in `lib/resend.ts`
- **Check**: All 6 transactional emails accept a `locale` parameter
- **Check**: Drip emails pass user's locale to templates
- **Check**: Abandoned cart emails use the user's preferred locale
- **Check**: Default locale fallback exists (en)

#### 3.2 Translation Coverage

- Read translation dictionaries in `lib/resend.ts` for each email
- **Check**: All 3 locales (en, es, de) are present for every email
- **Check**: Subject lines are translated
- **Check**: Body text is translated (not just subject)
- **Check**: Button/CTA text is translated
- **Check**: Footer text is translated

#### 3.3 Translation Quality

- Spot-check German and Spanish translations
- **Check**: No machine translation artifacts (awkward phrasing, wrong formality level)
- **Check**: Currency formatting matches locale (EUR with comma decimal for DE/ES)
- **Check**: Date formatting matches locale
- **Check**: Brand name "SKAPARA" is not translated (proper noun)

#### 3.4 Drip Template Translations

- Read drip cron route for template rendering
- **Check**: welcome, tips, credit_offer templates have en/es/de versions
- **Check**: Locale is stored in drip_queue or derived from user profile

#### 3.5 Abandoned Cart Translations

- Read abandoned cart recovery route
- **Check**: Recovery emails support all 3 locales
- **Check**: Product names in cart are displayed in user's locale (if translated)

#### 3.6 RTL Support

- **Check**: Is RTL (right-to-left) considered? (Not required for en/es/de but good for future ar/he)
- **Note**: Low priority for current locales, but flag if HTML structure would break with `dir="rtl"`

### Phase 4: Brand Consistency (5 checks)

#### 4.1 Color Palette

- Read `EMAIL_COLORS` constant in `lib/resend.ts:12-24`
- **Check**: Colors are defined in a single constant (not hardcoded per email)
- **Check**: Colors match brand guidelines (cross-reference with BRAND_IDENTITY.md)
- **Check**: All emails use EMAIL_COLORS (no rogue hex values)
- **Check**: Sufficient contrast ratios for accessibility (WCAG AA: 4.5:1 for text)

#### 4.2 Logo & Branding

- Search for logo, brand, header in email HTML
- **Check**: Brand logo appears in every email header
- **Check**: Logo links to the store homepage
- **Check**: Logo URL is absolute and hosted on CDN
- **Check**: Brand name appears consistently (SKAPARA, not variations)

#### 4.3 Footer Consistency

- Compare footer content across all email types
- **Check**: Footer includes: brand name, physical address, unsubscribe (where required), social links
- **Check**: Footer is identical across email types (single source of truth)
- **Check**: Social media links are present and correct
- **Check**: Copyright year is dynamic (not hardcoded)

#### 4.4 Tone & Voice

- Read copy across all email types
- **Check**: Tone is consistent (friendly, professional, on-brand)
- **Check**: Order status emails are clear and action-oriented
- **Check**: Error/failure emails are empathetic (not robotic)
- **Check**: CTAs use action verbs ("Track Your Order", "Shop Now")

#### 4.5 Template Reuse

- Check if emails share a common layout wrapper
- **Check**: Is there a shared email layout function/template (header + footer wrapper)?
- **Check**: Or does each email duplicate the full HTML structure?
- **Recommendation**: DRY email layout reduces inconsistency risk

### Phase 5: Error Handling & Reliability (6 checks)

#### 5.1 Send Failure Handling

- Search for `try`, `catch`, `error`, `resend` in all email-sending files
- **Check**: Every `resend.emails.send()` call is wrapped in try-catch
- **Check**: Send failures are logged with context (email type, recipient, error)
- **Check**: Send failures do not crash the parent operation (order still processes)
- **Check**: Failed sends are retried (or queued for retry)

#### 5.2 Rate Limiting on Sends

- Search for `rate`, `limit`, `throttle`, `delay` in email-sending code
- **Check**: Bulk email sends (drip cron, abandoned cart cron) are rate-limited
- **Check**: Resend API rate limits are respected (check Resend docs for limits)
- **Check**: No infinite loops possible in cron handlers

#### 5.3 Bounce Handling

- Search for `bounce`, `complaint`, `webhook`, `suppression` in email-related code
- **Check**: Resend bounce webhooks are configured
- **Check**: Hard bounces remove the email from future sends
- **Check**: Complaint (spam report) suppresses future sends
- **Severity**: FAIL if bounces are ignored — harms sender reputation

#### 5.4 Email Preview/Test Endpoint

- Search for `preview`, `test`, `email.*test`, `send.*test` in API routes
- **Check**: Admin can preview email templates before sending
- **Check**: Admin can send test emails to a specific address
- **Check**: Test sends are logged differently from production sends

#### 5.5 Idempotency

- Read drip cron and abandoned cart cron logic
- **Check**: Drip cron does not re-send already-sent emails (checks `sent_at`)
- **Check**: Abandoned cart does not re-send to users who already received recovery email
- **Check**: Cron jobs are idempotent (safe to run multiple times)

#### 5.6 Email Queue Monitoring

- Search for queue, pending, stuck, failed in drip and email code
- **Check**: Is there visibility into the drip queue (admin dashboard or logs)?
- **Check**: Stuck/failed queue items are surfaced
- **Check**: Queue has a TTL (old unsent items expire)

### Phase 6: Deliverability & Infrastructure (5 checks)

#### 6.1 SPF/DKIM/DMARC

- Check for DNS configuration references, domain verification
- **Check**: SPF record includes Resend's sending IPs
- **Check**: DKIM is configured (Resend provides this)
- **Check**: DMARC policy is set (at minimum p=none for monitoring)
- **Note**: These are DNS-level checks — audit can only verify configuration references in code/docs

#### 6.2 Sending Domain

- Read from address configuration in email code
- **Check**: Emails are sent from a custom domain (not @resend.dev)
- **Check**: Domain matches the store domain (skapara.com or subdomain)
- **Check**: No-reply address is used for transactional, monitored address for support

#### 6.3 Resend API Configuration

- Search for `RESEND_API_KEY`, `Resend` initialization in code
- **Check**: API key is in environment variable (not hardcoded)
- **Check**: Resend client is initialized once (singleton pattern)
- **Check**: API key has appropriate permissions (not overly broad)

#### 6.4 Email Analytics

- Search for `track`, `open`, `click`, `analytics` in email code
- **Check**: Open tracking is enabled (via Resend or tracking pixel)
- **Check**: Click tracking is enabled for CTAs
- **Check**: Analytics data is accessible (Resend dashboard or custom)

#### 6.5 Suppression List

- Search for `suppress`, `blacklist`, `block`, `opt_out` in email code
- **Check**: Unsubscribed users are added to a suppression list
- **Check**: Suppression list is checked before every send
- **Check**: Suppression persists across email types (unsubscribe from drip also suppresses abandoned cart)

---

## Output Format

Generate `AUDIT_EMAIL_TEMPLATES_[DATE].md` at the workspace root with the following structure:

```markdown
# Email Templates & Deliverability Audit — [DATE]

## Executive Summary

[2-3 paragraph overview: compliance status, template quality, deliverability posture. State risk level for EU store operation.]

## Scorecard

| Category | Checks | Pass | Warn | Fail | Critical | Score |
|---|---|---|---|---|---|---|
| CAN-SPAM & Legal Compliance | 10 | X | X | X | X | X% |
| HTML Email Structure | 8 | X | X | X | X | X% |
| Internationalization | 6 | X | X | X | X | X% |
| Brand Consistency | 5 | X | X | X | X | X% |
| Error Handling & Reliability | 6 | X | X | X | X | X% |
| Deliverability & Infrastructure | 5 | X | X | X | X | X% |
| **TOTAL** | **40** | **X** | **X** | **X** | **X** | **X%** |

## Findings

| ID | Severity | Category | Finding | File:Line | Recommendation |
|---|---|---|---|---|---|
| EM-001 | CRITICAL | CAN-SPAM | [description] | `src/app/api/cron/abandoned-cart-recovery/route.ts:XX` | [fix] |
| EM-002 | FAIL | HTML Structure | [description] | `src/lib/resend.ts:XX` | [fix] |
| EM-003 | WARN | Brand | [description] | `src/lib/resend.ts:XX` | [fix] |
| ... | ... | ... | ... | ... | ... |

## Critical Blockers (Must Fix Before Production)

1. [EM-001] — [description and fix]
2. ...

## High Priority (Fix Within Sprint)

1. [EM-0XX] — [description]
2. ...

## Warnings (Fix Before V2)

1. [EM-0XX] — [description]
2. ...

## Email Inventory

| Email Type | Function/File | Locale Support | Unsubscribe | RFC 8058 | CAN-SPAM Status |
|---|---|---|---|---|---|
| Order Confirmation | resend.ts:sendOrderConfirmationEmail | en/es/de | No | No | [status] |
| Order Shipped | resend.ts:sendOrderShippedEmail | en/es/de | No | No | [status] |
| Order Cancelled | resend.ts:sendOrderCancelledEmail | en/es/de | No | No | [status] |
| Order Delivered | resend.ts:sendOrderDeliveredEmail | en/es/de | No | No | [status] |
| Order Failed | resend.ts:sendOrderFailedEmail | en/es/de | No | No | [status] |
| Credit Purchase | resend.ts:sendCreditPurchaseEmail | en/es/de | No | No | [status] |
| Drip: Welcome | cron/drip/route.ts | [check] | Yes | Yes | [status] |
| Drip: Tips | cron/drip/route.ts | [check] | Yes | Yes | [status] |
| Drip: Credit Offer | cron/drip/route.ts | [check] | Yes | Yes | [status] |
| Cart Recovery 1h | cron/abandoned-cart-recovery | [check] | No | No | [status] |
| Cart Recovery 24h | cron/abandoned-cart-recovery | [check] | No | No | [status] |
| Newsletter Confirm | newsletter/subscribe | [check] | N/A | N/A | [status] |

## Priority Actions

1. [Numbered list of fixes ordered by severity and effort]
```

## Severity Levels

- **CRITICAL**: Legal compliance violation (CAN-SPAM, GDPR), email deliverability risk (no SPF/DKIM), security issue. Blocks production launch.
- **FAIL**: Broken functionality, missing i18n, rendering issues in major clients. Must fix before release.
- **WARN**: Sub-optimal pattern, missing best practice, minor UX gap. Should fix before V2.
- **PASS**: Meets standards and best practices.

## Notes

- Always verify findings against actual code (read the file, cite the line number). Never report speculative issues.
- CAN-SPAM violations carry fines up to $50,120 per email. GDPR violations up to 4% of annual revenue.
- For EU stores (SKAPARA), GDPR consent requirements are stricter than CAN-SPAM.
- Test email rendering mentally against: Gmail (web + mobile), Outlook (desktop + web), Apple Mail, Yahoo Mail.
- RFC 8058 one-click unsubscribe is required by Gmail/Yahoo for bulk senders since February 2024.
