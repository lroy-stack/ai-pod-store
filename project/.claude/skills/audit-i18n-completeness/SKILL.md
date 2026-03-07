---
name: i18n Completeness Audit
description: >
  Comprehensive audit of internationalization — translation key parity, hardcoded strings,
  date/number/currency formatting, email translations, metadata translations, and locale routing.
  Use when asked to audit i18n, translations, localization, internationalization, or multilingual support.
allowed-tools: Read, Grep, Glob, Bash
---

# i18n Completeness Audit

Systematic audit of the SKAPARA storefront internationalization: next-intl configuration, translation key parity across en/es/de, hardcoded English strings in components, date/number/currency formatting, email translations, metadata translations, and locale middleware.

## Prerequisites

Before starting, read these files for architectural context:

- `CLAUDE.md` — route groups, architecture overview, i18n routing
- `frontend/src/i18n/routing.ts` — locale config (locales, default, prefix strategy)
- `frontend/src/i18n/request.ts` — dynamic import, fallback merge with English
- `frontend/src/middleware.ts` (252 lines) — locale detection and routing
- `frontend/messages/en.json` — reference translation file (1724 lines, 1493 keys)

## File Map

Keep this reference open throughout the audit. All paths relative to `frontend/`.

### i18n Configuration

| File | Role |
|---|---|
| `src/i18n/routing.ts` | Locale list ['en','es','de'], default 'en', prefix 'always' |
| `src/i18n/request.ts` | Dynamic message import, fallback merge with English base |
| `src/middleware.ts` | Locale detection, redirect, cookie-based persistence (252 lines) |
| `next.config.ts` | next-intl plugin integration |

### Translation Files

| File | Lines | Keys |
|---|---|---|
| `messages/en.json` | 1724 | 1493 (reference) |
| `messages/es.json` | 1724 | 1493 |
| `messages/de.json` | 1724 | 1493 |

### Key Consumers

| Pattern | Count | Description |
|---|---|---|
| `useTranslations` | 50+ components | Client-side translation hook |
| `getTranslations` | Server components/pages | Server-side translation function |
| `generateMetadata` | 32 pages | Metadata with localized titles/descriptions |

### Currency & Formatting

| File | Role |
|---|---|
| `src/lib/currency.ts` | Intl.NumberFormat, locale-aware EUR formatting |

### Email Translations

| File | Role |
|---|---|
| Email service (resend.ts) | Full en/es/de dictionaries inline for email subject/body |

---

## Workflow

Execute each phase sequentially. Record every finding with severity, file path, and line number.

### Phase 1: Translation Key Parity (6 checks)

#### 1.1 Key Count Comparison

- Read `messages/en.json`, `messages/es.json`, `messages/de.json`
- **Check**: All 3 files have identical key count (currently 1493)
- **Check**: No keys exist in en.json that are missing from es.json or de.json
- **Check**: No keys exist in es.json or de.json that are missing from en.json (orphaned keys)
- Use a script to diff key structures: `Bash` with `jq` to extract and compare key paths

#### 1.2 Empty or Placeholder Values

- **Check**: No values are empty strings `""` in any locale file
- **Check**: No values are obviously untranslated (English text in es.json or de.json)
- **Check**: No values are placeholder text like "TODO", "FIXME", "TRANSLATE ME"
- **Severity**: FAIL if user-facing strings show English in non-English locale

#### 1.3 Nested Key Structure Consistency

- **Check**: JSON structure is identical across all 3 files (same nesting levels)
- **Check**: No arrays where objects are expected (or vice versa)
- **Check**: Key names follow consistent naming convention (camelCase or dot-separated)

#### 1.4 Interpolation Variables

- Search for `{variable}` patterns in all translation files
- **Check**: Same interpolation variables exist in all locales for the same key
- **Check**: No locale has extra or missing variables compared to en.json
- **Check**: Variable names match what components pass to `t('key', { variable })`
- **Severity**: CRITICAL if interpolation mismatch causes runtime crash

#### 1.5 Pluralization Rules

- Search for `plural`, `one`, `other`, `zero`, `few`, `many` in translation files
- **Check**: Plural forms are correct for each locale (English: one/other, German: one/other, Spanish: one/other)
- **Check**: next-intl ICU message format is used correctly for plurals
- **Check**: No hardcoded plural logic in components (should use ICU `{count, plural, ...}`)

#### 1.6 Fallback Behavior

- Read `src/i18n/request.ts`
- **Check**: Missing keys fall back to English (en.json) gracefully
- **Check**: Fallback merge is deep (nested keys fall back individually, not whole sections)
- **Check**: Console warning is logged for missing translation keys in development
- **Check**: Production does NOT show raw key paths to users (e.g., `Common.button.submit`)

### Phase 2: Hardcoded Strings in Components (8 checks)

#### 2.1 User-Facing Text in TSX

- Grep for common hardcoded English patterns in `.tsx` files:
  - `>"[A-Z][a-z]` (text content starting with capital letter inside JSX)
  - `placeholder="[A-Z]` (hardcoded placeholder text)
  - `title="[A-Z]` (hardcoded title attributes)
  - `aria-label="[A-Z]` (hardcoded ARIA labels)
- **Check**: No user-visible English strings are hardcoded in components
- **Check**: Button labels, headings, descriptions all use `t('key')` pattern
- **Severity**: FAIL for visible UI text; WARN for aria-labels and tooltips

#### 2.2 Error Messages

- Search for `throw new Error`, `toast.error`, `toast.success`, `console.error` with string literals
- **Check**: User-facing error messages (toast, alert) use translated strings
- **Check**: Console/logging errors can remain in English (developer-facing)
- **Check**: API error responses that reach the UI are translated client-side

#### 2.3 Form Validation Messages

- Search for validation messages in form components and Zod schemas
- **Check**: Zod schema error messages use translated strings (via `t()` or `message` override)
- **Check**: Required field messages are translated
- **Check**: Format validation messages (email, phone, etc.) are translated

#### 2.4 Confirmation Dialogs

- Search for `confirm(`, `window.confirm`, `DialogDescription`, `AlertDialogDescription`
- **Check**: All confirmation dialog text uses translations
- **Check**: "Cancel"/"OK"/"Delete" button labels are translated

#### 2.5 Empty States & Loading

- Search for empty state messages: "No items", "Nothing found", "Loading..."
- **Check**: Empty state messages in lists/grids use translations
- **Check**: Loading indicators with text use translations
- **Check**: Search "no results" messages are translated

#### 2.6 Date/Time Display Strings

- Search for date-related strings: "ago", "yesterday", "today", "just now"
- **Check**: Relative time strings use Intl.RelativeTimeFormat or translated strings
- **Check**: No hardcoded English date labels ("January", "Monday", etc.)

#### 2.7 Currency & Price Labels

- Search for "$", "EUR", "Price:", "Total:", "Subtotal:" in components
- **Check**: Currency labels use translations, not hardcoded strings
- **Check**: "Free shipping", "Out of stock" type labels are translated
- **Check**: Price formatting uses locale-aware `Intl.NumberFormat`

#### 2.8 Legal & Policy Text

- Search for legal pages (terms, privacy, shipping, returns)
- **Check**: Legal content is available in all 3 locales
- **Check**: Legal pages use translated content (not just English everywhere)
- **Severity**: WARN — legal pages in local language are a best practice for EU compliance

### Phase 3: Date, Number & Currency Formatting (6 checks)

#### 3.1 Currency Formatting

- Read `src/lib/currency.ts`
- **Check**: Uses `Intl.NumberFormat` with locale parameter
- **Check**: Currency is EUR for all locales (EU-only store)
- **Check**: Decimal separator matches locale convention (1.234,56 for de, 1,234.56 for en)
- **Check**: Currency symbol position matches locale (EUR prefix/suffix varies by locale)
- **Check**: Formatting is consistent across all price displays (product cards, cart, checkout)

#### 3.2 Date Formatting

- Search for `new Date`, `toLocaleDateString`, `Intl.DateTimeFormat`, `format(` in components
- **Check**: Dates use `Intl.DateTimeFormat` with locale parameter
- **Check**: Date format matches locale convention (DD/MM/YYYY for es/de, MM/DD/YYYY for en)
- **Check**: No hardcoded date formatting (`date.getMonth() + '/' + date.getDate()`)

#### 3.3 Number Formatting

- Search for `toLocaleString`, `Intl.NumberFormat` usage
- **Check**: Large numbers use locale-appropriate separators (1,000 en vs 1.000 de)
- **Check**: Percentages follow locale conventions
- **Check**: Quantity inputs accept locale-appropriate number formats

#### 3.4 Timezone Handling

- Search for `timezone`, `UTC`, `getTimezoneOffset` in date-related code
- **Check**: Dates are stored in UTC in database
- **Check**: Displayed dates are converted to user's timezone or store timezone
- **Check**: Order timestamps show correct local time for the customer

#### 3.5 Unit Formatting

- Search for "cm", "inch", "kg", "lb", "oz", "g" in product/size guide components
- **Check**: Size guide uses metric units for EU locales (cm, kg)
- **Check**: No hardcoded imperial units for EU customers
- **Check**: Unit labels are translated

#### 3.6 Sorting & Collation

- Search for `.sort(`, `localeCompare` in components that sort user-visible text
- **Check**: Text sorting uses `localeCompare` with correct locale
- **Check**: German umlauts sort correctly (a < b < ... < z, with a, o, u in correct positions)
- **Check**: Spanish n sorts correctly

### Phase 4: Email & Notification Translations (4 checks)

#### 4.1 Email Subject Lines

- Read email service file (resend.ts or equivalent)
- **Check**: Email subjects are translated for all 3 locales
- **Check**: Customer receives email in their preferred locale
- **Check**: Locale is determined from user profile or order locale

#### 4.2 Email Body Content

- **Check**: Email body templates exist in en/es/de
- **Check**: Dynamic content (order details, product names) is correctly interpolated
- **Check**: Email footer/legal text is translated
- **Check**: Unsubscribe link text is translated

#### 4.3 Push Notifications / Toast Messages

- Search for `toast(`, `toast.success`, `toast.error` calls in components
- **Check**: Toast messages use `t('key')` not hardcoded strings
- **Check**: Success/error notifications are in user's locale
- **Check**: At least critical toasts (order placed, payment failed) are translated

#### 4.4 Transactional Messages

- Search for order confirmation, shipping notification, password reset flows
- **Check**: Order confirmation emails/pages are localized
- **Check**: Password reset emails are in user's locale
- **Check**: Account verification messages are translated

### Phase 5: Metadata & SEO Translations (4 checks)

#### 5.1 Page Titles & Descriptions

- Grep for `generateMetadata` across all page files
- **Check**: `generateMetadata` calls `getTranslations` for localized content
- **Check**: Titles differ per locale (not all English)
- **Check**: Descriptions are properly translated (not machine-translated gibberish)

#### 5.2 OG Tags Per Locale

- **Check**: Open Graph title/description change per locale
- **Check**: `og:locale` is set correctly per locale (en_US, es_ES, de_DE)
- **Check**: `og:locale:alternate` lists other available locales

#### 5.3 Structured Data Translation

- **Check**: JSON-LD Product schema uses translated product descriptions per locale
- **Check**: BreadcrumbList names are translated
- **Check**: Organization name remains consistent (SKAPARA) across locales

#### 5.4 URL Slug Translation

- **Check**: Product slugs are locale-aware (or universal slugs used across locales)
- **Check**: Category names in URLs are consistent across locales
- **Check**: No broken links from locale-specific URL patterns

### Phase 6: Middleware & Routing (5 checks)

#### 6.1 Locale Detection

- Read `src/middleware.ts`
- **Check**: Accept-Language header is parsed for initial locale detection
- **Check**: Cookie-based locale persistence works (user switches once, stays in that locale)
- **Check**: URL locale prefix overrides cookie/header detection
- **Check**: Invalid locale in URL falls back to default (en)

#### 6.2 Locale Switching

- Search for locale switcher component
- **Check**: Language selector is available on all pages
- **Check**: Switching locale preserves current page path (not redirect to home)
- **Check**: Switching locale sets cookie for persistence
- **Check**: All locale options are visible (en, es, de)

#### 6.3 Redirect Behavior

- **Check**: Root `/` redirects to `/[detected-locale]/`
- **Check**: Paths without locale prefix redirect to locale version (301)
- **Check**: No redirect loops
- **Check**: API routes are NOT affected by locale middleware

#### 6.4 Static Asset Paths

- **Check**: Static assets (images, fonts, CSS) are NOT locale-prefixed
- **Check**: Public directory assets work regardless of locale
- **Check**: next/image paths are locale-independent

#### 6.5 Dynamic Route Parameters

- **Check**: Dynamic routes like `/[locale]/shop/[slug]` receive correct locale parameter
- **Check**: Locale is available in both server and client components
- **Check**: `useLocale()` and `useTranslations()` work in nested components

### Phase 7: Edge Cases & Quality (5 checks)

#### 7.1 Long Text Handling

- **Check**: German translations (typically 30% longer than English) don't break layouts
- **Check**: Buttons, tabs, and navigation items accommodate longer text without overflow
- **Check**: Truncation with ellipsis is used where space is limited
- **Benchmark**: German compound words can be very long (e.g., "Datenschutzerklaerung")

#### 7.2 Special Characters

- **Check**: German umlauts (a, o, u, ss) display correctly everywhere
- **Check**: Spanish characters (n, accent marks) display correctly
- **Check**: UTF-8 encoding is set in HTML meta tag and server responses
- **Check**: Database stores UTF-8 correctly (product names, descriptions)

#### 7.3 RTL Considerations

- **Check**: Current locales (en, es, de) are all LTR — no RTL support needed
- **Check**: If RTL locale is added later, CSS uses logical properties (start/end vs left/right)
- **Severity**: INFO — note for future expansion only

#### 7.4 Translation Quality

- Spot-check 20 random keys across es.json and de.json:
- **Check**: Translations are natural, not machine-translated
- **Check**: Formal/informal register is consistent (German Sie vs du)
- **Check**: Brand terms remain untranslated where appropriate (SKAPARA, product names)
- **Check**: No English leakage in translated content

#### 7.5 Missing Locale Support

- **Check**: All third-party libraries respect locale (date pickers, calendars, selects)
- **Check**: Stripe checkout uses customer's locale
- **Check**: Printful product descriptions are stored per locale in Supabase
- **Check**: Admin panel handles multilingual product content (titles, descriptions per locale)

---

## Output Format

Generate `AUDIT_I18N_COMPLETENESS_[DATE].md` at the workspace root with the following structure:

```markdown
# i18n Completeness Audit — [DATE]

## Executive Summary

[2-3 paragraph overview: translation coverage, formatting compliance, critical gaps. State whether the store is ready for multilingual EU launch.]

## Scorecard

| Category | Checks | Pass | Warn | Fail | Critical | Score |
|---|---|---|---|---|---|---|
| Translation Key Parity | 6 | X | X | X | X | X% |
| Hardcoded Strings | 8 | X | X | X | X | X% |
| Date/Number/Currency Formatting | 6 | X | X | X | X | X% |
| Email & Notification Translations | 4 | X | X | X | X | X% |
| Metadata & SEO Translations | 4 | X | X | X | X | X% |
| Middleware & Routing | 5 | X | X | X | X | X% |
| Edge Cases & Quality | 5 | X | X | X | X | X% |
| **TOTAL** | **38** | **X** | **X** | **X** | **X** | **X%** |

## Findings

| ID | Severity | Category | Finding | File:Line | Recommendation |
|---|---|---|---|---|---|
| I18N-001 | CRITICAL | Key Parity | [description] | `messages/de.json:L342` | [fix] |
| I18N-002 | FAIL | Hardcoded Strings | [description] | `src/components/storefront/CartView.tsx:88` | [fix] |
| I18N-003 | WARN | Formatting | [description] | `src/lib/currency.ts:15` | [fix] |
| ... | ... | ... | ... | ... | ... |

## Critical Blockers (Must Fix Before Production)

1. [I18N-001] — [description and fix]
2. ...

## High Priority (Fix Within Sprint)

1. [I18N-0XX] — [description]
2. ...

## Warnings (Fix Before V2)

1. [I18N-0XX] — [description]
2. ...

## Priority Actions

1. [Highest priority action]
2. ...
```

## Severity Levels

- **CRITICAL**: Interpolation mismatch causing runtime crash, missing locale causing 500 errors, fallback failure exposing raw keys to users. Blocks multilingual launch.
- **FAIL**: Hardcoded English in user-facing components, missing translations for key flows (checkout, cart, errors), broken locale switching. Must fix before launch.
- **WARN**: Suboptimal date/number formatting, minor hardcoded strings in low-traffic pages, translation quality issues. Fix for V2.
- **PASS**: Meets i18n best practices for EU multilingual storefront.

## Notes

- Always verify findings against actual code (read the file, cite the line number). Never report speculative issues.
- Use `jq` or script-based comparison for translation key parity — do not manually compare 1493 keys.
- For hardcoded string detection, focus on user-visible text in JSX return statements, not developer comments or console logs.
- For each CRITICAL or FAIL finding, include a concrete code-level recommendation (not just "fix this").
- The current state is 100% key parity (1493 keys) — verify this is still true and flag any regression.
