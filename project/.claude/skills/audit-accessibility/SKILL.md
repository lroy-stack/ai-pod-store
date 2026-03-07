---
name: Accessibility (a11y) Audit
description: >
  Comprehensive WCAG 2.1 AA/AAA audit — skip navigation, ARIA labels, keyboard navigation, focus
  management, form labels, image alt text, color contrast, reduced motion, semantic HTML, and touch
  targets. Use when asked to audit accessibility, a11y, WCAG, screen reader support, or keyboard navigation.
allowed-tools: Read, Grep, Glob, Bash
---

# Accessibility (a11y) Audit

Systematic WCAG 2.1 AA/AAA audit of the SKAPARA storefront: skip navigation, ARIA attributes, keyboard navigation, focus management in modals/dialogs, form label association, image alt text, color contrast, prefers-reduced-motion, semantic HTML structure, screen reader compatibility, and touch target sizing.

## Prerequisites

Before starting, read these files for architectural context:

- `CLAUDE.md` — component standards, shadcn/ui mapping, semantic tokens, responsive patterns
- `frontend/src/components/storefront/StorefrontHeader.tsx` — canonical reference implementation
- `frontend/src/components/storefront/StorefrontSidebar.tsx` — canonical reference implementation
- `frontend/src/components/ui/button.tsx` — focus-visible pattern used across all 16 UI components

## File Map

Keep this reference open throughout the audit. All paths relative to `frontend/src/`.

### Skip Navigation

| File | Role |
|---|---|
| `app/[locale]/(landing)/layout.tsx` (lines 10-16) | Skip nav link: `<a href="#main-content" className="sr-only focus:not-sr-only...">` |
| `components/storefront/StorefrontLayout.tsx` | Skip nav link for app layout |

### ARIA Implementation (30 files)

Files with `aria-label`, `aria-describedby`, or `aria-*` attributes — search across all components under `components/` and `app/`.

### Screen Reader Support (21 files)

Files using `sr-only` class for visually hidden but screen-reader-accessible text.

### Focus Management

| File | Pattern |
|---|---|
| All 16 UI components in `components/ui/` | `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]` |
| `components/storefront/CartView.tsx` | Enter key handler for coupon input |
| `components/storefront/DetailPanel.tsx` | Enter/Space key handlers |
| `components/storefront/ChatArea.tsx` | Keyboard interaction |
| `components/ui/carousel.tsx` | Arrow key navigation |

### Form Labels

| File | Pattern |
|---|---|
| 4 files with explicit `htmlFor` | Direct label-input association |
| Multiple files using shadcn/ui `Label` component | Component-based label association |

### Motion Sensitivity

| File | Feature |
|---|---|
| `components/landing/MetaballsBackground.tsx` | `prefers-reduced-motion` media query |
| `app/globals.css` | `prefers-reduced-motion` CSS |

### Semantic HTML

Components using `<main>`, `<nav>`, `<header>`, `<footer>`, `<article>`, `<section>` — verify across layouts and page components.

---

## Workflow

Execute each phase sequentially. Record every finding with severity, file path, and line number.

### Phase 1: Skip Navigation & Landmarks (6 checks)

#### 1.1 Skip Navigation Links

- Read `app/[locale]/(landing)/layout.tsx` lines 10-16
- Read `components/storefront/StorefrontLayout.tsx` for app skip nav
- **Check**: Skip nav link exists as first focusable element in both layouts
- **Check**: Link uses `sr-only focus:not-sr-only` pattern (hidden until focused)
- **Check**: Link target `#main-content` has corresponding `id="main-content"` on `<main>`
- **Check**: Skip nav is keyboard-accessible (Tab reveals it, Enter activates it)
- **Severity**: FAIL if skip nav is missing or broken — WCAG 2.4.1 (Level A)

#### 1.2 ARIA Landmarks

- Search for `role="banner"`, `role="navigation"`, `role="main"`, `role="contentinfo"` or their semantic HTML equivalents
- **Check**: Page has exactly one `<main>` element (or `role="main"`)
- **Check**: Navigation areas use `<nav>` or `role="navigation"`
- **Check**: Header uses `<header>` or `role="banner"`
- **Check**: Footer uses `<footer>` or `role="contentinfo"`
- **Check**: Multiple `<nav>` elements have distinct `aria-label` (e.g., "Main navigation", "Footer navigation")

#### 1.3 Heading Hierarchy

- Search for `<h1>`, `<h2>`, `<h3>`, `<h4>`, `<h5>`, `<h6>` across page components
- **Check**: Each page has exactly one `<h1>`
- **Check**: Heading levels are sequential (no skipping from h1 to h3)
- **Check**: Headings describe the content they precede
- **Check**: No headings used purely for styling (use CSS instead)
- **Severity**: WARN — WCAG 1.3.1 (Level A)

#### 1.4 Semantic HTML Elements

- Search for `<main>`, `<nav>`, `<header>`, `<footer>`, `<article>`, `<section>`, `<aside>` usage
- **Check**: Product listings use `<article>` for each product card
- **Check**: Content sections use `<section>` with headings (not naked `<div>` blocks)
- **Check**: Sidebar uses `<aside>` or `<nav>`
- **Check**: No `<div>` soup where semantic elements would be appropriate

#### 1.5 Page Title

- **Check**: Every page has a unique, descriptive `<title>` (via metadata/generateMetadata)
- **Check**: Title format follows "Page Name | SKAPARA" pattern
- **Check**: Dynamic pages have dynamic titles (product name, category name)
- **Severity**: FAIL — WCAG 2.4.2 (Level A)

#### 1.6 Language Attribute

- Read `app/[locale]/layout.tsx`
- **Check**: `<html lang={locale}>` is set dynamically based on route locale
- **Check**: Lang value matches BCP 47 codes (en, es, de)
- **Check**: Any inline content in a different language uses `lang` attribute on that element
- **Severity**: FAIL if missing — WCAG 3.1.1 (Level A)

### Phase 2: ARIA Labels & Roles (8 checks)

#### 2.1 Interactive Elements — Buttons

- Grep for `<Button`, `<button`, `<IconButton` across all components
- **Check**: All icon-only buttons have `aria-label` (e.g., close, menu, cart, search, delete)
- **Check**: Buttons with text content do NOT have redundant `aria-label`
- **Check**: Toggle buttons use `aria-pressed` or `aria-expanded`
- **Severity**: CRITICAL for icon-only buttons without labels — WCAG 4.1.2 (Level A)

#### 2.2 Interactive Elements — Links

- Grep for `<Link`, `<a ` across all components
- **Check**: Links have descriptive text (not "click here" or "read more" without context)
- **Check**: Links that open in new tab have `aria-label` or visible indicator + `rel="noopener"`
- **Check**: Adjacent links to same destination are merged (not duplicate tab stops)

#### 2.3 Form Controls

- Grep for `<Input`, `<input`, `<Select`, `<Textarea`, `<Checkbox`, `<Switch` in form components
- **Check**: Every form input has an associated `<Label>` (via `htmlFor` or wrapping)
- **Check**: Required fields are indicated with `aria-required="true"` or `required` attribute
- **Check**: Error states use `aria-invalid="true"` and `aria-describedby` pointing to error message
- **Check**: Form groups use `<fieldset>` and `<legend>` where appropriate
- **Severity**: FAIL for unlabeled inputs — WCAG 1.3.1 / 4.1.2 (Level A)

#### 2.4 Dialog & Modal Accessibility

- Read `components/ui/dialog.tsx`, `components/ui/sheet.tsx`, `components/ui/alert-dialog.tsx`
- **Check**: Dialogs have `role="dialog"` and `aria-modal="true"` (shadcn/ui provides this)
- **Check**: Dialogs have `aria-labelledby` pointing to title element
- **Check**: Focus is trapped inside open dialog (Tab cycles within dialog)
- **Check**: Escape key closes dialog
- **Check**: Focus returns to trigger element on close
- **Severity**: FAIL if focus trap is broken — WCAG 2.4.3 (Level A)

#### 2.5 Dropdown Menu Accessibility

- Read `components/ui/dropdown-menu.tsx`
- **Check**: Menu trigger has `aria-haspopup="true"` and `aria-expanded`
- **Check**: Menu items use `role="menuitem"`
- **Check**: Arrow keys navigate between items
- **Check**: Escape closes menu and returns focus to trigger
- **Check**: Type-ahead selection works (typing first letter of item)

#### 2.6 Tabs Accessibility

- Read `components/ui/tabs.tsx`
- **Check**: Tab list has `role="tablist"`
- **Check**: Each tab has `role="tab"` with `aria-selected` and `aria-controls`
- **Check**: Tab panels have `role="tabpanel"` with `aria-labelledby`
- **Check**: Arrow keys move between tabs (Left/Right for horizontal)
- **Check**: Home/End keys move to first/last tab

#### 2.7 Live Regions

- Search for `aria-live`, `aria-atomic`, `role="alert"`, `role="status"` in components
- **Check**: Toast notifications use `role="alert"` or `aria-live="assertive"` (sonner handles this)
- **Check**: Cart count updates use `aria-live="polite"`
- **Check**: Loading states announce to screen readers (`aria-live="polite"` or `role="status"`)
- **Check**: Form validation errors are announced via live region
- **Severity**: WARN — WCAG 4.1.3 (Level AA)

#### 2.8 Custom Widget Patterns

- Search for custom interactive components (carousel, accordion, color picker, star rating)
- **Check**: `components/ui/carousel.tsx` — arrow key navigation, `aria-roledescription="carousel"`
- **Check**: Color picker — selected color announced to screen readers
- **Check**: Star rating (if exists) — `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- **Check**: Any custom widget follows WAI-ARIA Authoring Practices

### Phase 3: Keyboard Navigation (7 checks)

#### 3.1 Full Keyboard Operability

- Test keyboard flow through key pages: landing, shop, product detail, cart, checkout
- **Check**: Every interactive element is reachable via Tab key
- **Check**: Tab order follows visual layout (left-to-right, top-to-bottom)
- **Check**: No keyboard traps (user can Tab away from any element)
- **Check**: No elements require mouse hover to reveal (hidden menus need keyboard alternative)
- **Severity**: CRITICAL — WCAG 2.1.1 (Level A)

#### 3.2 Focus Visibility

- Read `components/ui/button.tsx` and check `focus-visible` pattern
- **Check**: All 16 UI components use `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`
- **Check**: Focus indicator is visible in both light and dark themes
- **Check**: Focus indicator has sufficient contrast (3:1 ratio against adjacent colors)
- **Check**: Focus indicator is not just color change (uses outline/ring, not just color)
- **Severity**: FAIL if focus is invisible — WCAG 2.4.7 (Level AA)

#### 3.3 Focus Management in SPAs

- Search for `focus()`, `tabIndex`, `useRef` in page transition and navigation components
- **Check**: Focus moves to main content area on route change (SPA navigation)
- **Check**: `tabIndex={-1}` is used on programmatically focused elements (main content after navigation)
- **Check**: Focus is not lost after dynamic content updates (loading states, list changes)

#### 3.4 Keyboard Shortcuts

- Search for `keydown`, `keyup`, `addEventListener.*key`, `onKeyDown` in components
- **Check**: CartView handles Enter key for coupon submission
- **Check**: DetailPanel handles Enter/Space for actions
- **Check**: ChatArea handles keyboard interaction (Enter to send)
- **Check**: Carousel handles Arrow keys for navigation
- **Check**: Shortcuts do not conflict with screen reader shortcuts
- **Check**: No single-character shortcuts that activate accidentally (WCAG 2.1.4 Level A)

#### 3.5 Modal/Sheet Focus Trap

- Read `components/ui/dialog.tsx`, `components/ui/sheet.tsx`
- **Check**: When dialog opens, focus moves to first focusable element inside
- **Check**: Tab/Shift+Tab cycles within dialog (no escape to background)
- **Check**: Background content is inert (`aria-hidden="true"` on main content)
- **Check**: On close, focus returns to the element that triggered the dialog

#### 3.6 Scroll & Viewport Keyboard

- **Check**: Page can be scrolled with keyboard (Space, Page Up/Down, Home/End)
- **Check**: Scrollable containers within page are keyboard-accessible
- **Check**: Sticky headers do not obscure focused elements
- **Check**: "Back to top" button is keyboard-accessible

#### 3.7 Mobile Keyboard (Virtual)

- **Check**: `inputMode` is set correctly on inputs (numeric for phone/zip, email for email)
- **Check**: `autocomplete` attributes help keyboard suggestions
- **Check**: Virtual keyboard does not obscure the active input field
- **Check**: Enter key submits forms from the last field

### Phase 4: Color Contrast & Visual (6 checks)

#### 4.1 Text Contrast — WCAG AA

- Review semantic token definitions for text/background combinations
- **Check**: `text-foreground` on `bg-background` — minimum 4.5:1 ratio for normal text
- **Check**: `text-muted-foreground` on `bg-background` — minimum 4.5:1 ratio
- **Check**: `text-primary-foreground` on `bg-primary` — minimum 4.5:1 ratio
- **Check**: `text-destructive-foreground` on `bg-destructive` — minimum 4.5:1 ratio
- **Check**: All text/background combinations meet AA in BOTH light and dark themes
- **Severity**: FAIL — WCAG 1.4.3 (Level AA)

#### 4.2 Text Contrast — WCAG AAA

- **Check**: Primary text meets 7:1 ratio (AAA enhanced contrast)
- **Check**: Large text (18pt/14pt bold) meets 4.5:1 ratio for AAA
- **Check**: oklch color tokens are designed for AAA compliance (verify against actual values)
- **Benchmark**: SKAPARA claims WCAG AAA — verify this claim

#### 4.3 Non-Text Contrast

- **Check**: UI component boundaries (input borders, button borders) have 3:1 contrast ratio
- **Check**: Focus indicators have 3:1 contrast against adjacent colors
- **Check**: Icons have sufficient contrast against background
- **Check**: Chart/graph elements (if any) are distinguishable
- **Severity**: FAIL — WCAG 1.4.11 (Level AA)

#### 4.4 Color Not Sole Indicator

- **Check**: Error states use icon + text in addition to red color
- **Check**: Success states use icon + text in addition to green color
- **Check**: Form validation errors have text messages, not just red border
- **Check**: Links are distinguishable from text by underline or icon (not just color)
- **Check**: Required fields have visual indicator beyond color (asterisk, text)
- **Severity**: FAIL — WCAG 1.4.1 (Level A)

#### 4.5 Dark Mode Accessibility

- **Check**: Dark mode maintains same contrast ratios as light mode
- **Check**: Images remain visible in dark mode (no transparency issues)
- **Check**: Text on images is readable in both modes
- **Check**: Semantic tokens correctly flip values between themes

#### 4.6 High Contrast Mode

- **Check**: Components degrade gracefully in Windows High Contrast Mode
- **Check**: Focus indicators remain visible in high contrast
- **Check**: No content is lost in forced-colors mode
- **Benchmark**: Windows High Contrast Mode support is a best practice for enterprise accessibility

### Phase 5: Images & Media (5 checks)

#### 5.1 Image Alt Text

- Grep for `<img`, `<Image` across all components
- **Check**: All meaningful images have descriptive `alt` text
- **Check**: Decorative images use `alt=""` (empty alt, not missing alt attribute)
- **Check**: Product images have alt text with product name + variant info
- **Check**: No images have `alt` attribute missing entirely
- **Check**: Alt text is concise but descriptive (not "image" or "photo")
- **Severity**: FAIL — WCAG 1.1.1 (Level A)

#### 5.2 SVG Accessibility

- Search for `<svg` in components
- **Check**: Decorative SVGs have `aria-hidden="true"`
- **Check**: Meaningful SVGs have `role="img"` and `aria-label` or `<title>` element
- **Check**: SVG icons in buttons are hidden from screen readers (button has its own label)

#### 5.3 Background Images

- Search for `background-image`, `bg-[url` in components and CSS
- **Check**: No essential content is conveyed solely through background images
- **Check**: Background images have text alternatives nearby if meaningful

#### 5.4 Image Loading States

- **Check**: Images show placeholder or skeleton during load
- **Check**: Broken images show meaningful alt text (not broken image icon)
- **Check**: Loading states are announced to screen readers

#### 5.5 Video & Audio (if applicable)

- Search for `<video>`, `<audio>`, `<iframe>` (YouTube embeds) in components
- **Check**: Videos have captions/subtitles
- **Check**: Audio has transcript
- **Check**: Auto-playing media has pause/stop control
- **Check**: No media auto-plays with sound
- **Severity**: FAIL if present without captions — WCAG 1.2.2 (Level A)

### Phase 6: Motion & Animations (4 checks)

#### 6.1 Prefers Reduced Motion

- Read `components/landing/MetaballsBackground.tsx` and `app/globals.css`
- **Check**: `@media (prefers-reduced-motion: reduce)` is respected
- **Check**: MetaballsBackground disables or simplifies animation
- **Check**: CSS transitions/animations are disabled or reduced
- **Check**: All animated components respect this media query (not just the 2 known files)
- **Severity**: FAIL — WCAG 2.3.3 (Level AAA)

#### 6.2 Animation Duration

- Search for `transition`, `animate-`, `@keyframes` in CSS and components
- **Check**: No animation runs for more than 5 seconds without user control
- **Check**: Animations can be paused/stopped
- **Check**: No infinite looping animations without reduced-motion alternative
- **Severity**: WARN — WCAG 2.2.2 (Level A)

#### 6.3 Flashing Content

- **Check**: No content flashes more than 3 times per second
- **Check**: No rapidly changing colors or brightness
- **Severity**: CRITICAL — WCAG 2.3.1 (Level A) — can cause seizures

#### 6.4 Scroll-Based Animations

- Search for `IntersectionObserver`, `scroll`, `parallax` in components
- **Check**: Scroll-triggered animations respect prefers-reduced-motion
- **Check**: Content is accessible even with animations disabled
- **Check**: No content is hidden until scroll animation triggers

### Phase 7: Touch Targets & Mobile (5 checks)

#### 7.1 Touch Target Size

- Search for button/link dimensions in toolbar, navigation, and form components
- **Check**: All interactive elements have minimum 44x44px touch target (WCAG 2.5.5 Level AAA)
- **Check**: Spacing between adjacent targets prevents accidental activation
- **Check**: Small icons have expanded hit area via padding (p-3 or larger)
- **Check**: Close buttons, menu items, and form controls meet minimum size
- **Severity**: FAIL for targets below 24x24px — WCAG 2.5.8 (Level AA)

#### 7.2 Mobile Navigation Accessibility

- Read `components/storefront/StorefrontSidebar.tsx`
- **Check**: Hamburger menu button has `aria-label="Open menu"` (or translated equivalent)
- **Check**: Mobile sidebar (Sheet) traps focus correctly
- **Check**: Menu items are large enough to tap
- **Check**: Active page is indicated (aria-current="page")

#### 7.3 Pinch & Zoom

- Search for `user-scalable`, `maximum-scale` in meta viewport
- **Check**: Viewport meta does NOT disable pinch-to-zoom (`user-scalable=no` is forbidden)
- **Check**: `maximum-scale` is not set below 2.0 (or is absent)
- **Severity**: FAIL — WCAG 1.4.4 (Level AA)

#### 7.4 Touch Gestures

- **Check**: No functionality requires complex gestures (multi-finger, path-based)
- **Check**: Swipe-based interactions have button alternatives
- **Check**: Drag-and-drop has keyboard alternative
- **Severity**: FAIL — WCAG 2.5.1 (Level A)

#### 7.5 Responsive Text Sizing

- **Check**: Text can be resized up to 200% without loss of content or functionality
- **Check**: No text is clipped or overlapped at 200% zoom
- **Check**: Horizontal scrolling is not required at 320px viewport width
- **Severity**: FAIL — WCAG 1.4.4 (Level AA)

### Phase 8: Screen Reader Testing Checklist (3 checks)

#### 8.1 Reading Order

- **Check**: DOM order matches visual order (CSS does not rearrange content in misleading ways)
- **Check**: Flexbox/Grid `order` property is not used to visually reorder content away from DOM order
- **Check**: Hidden content uses proper hiding (`display:none`, `hidden`, `aria-hidden`) not just visual hiding

#### 8.2 Dynamic Content Announcements

- **Check**: Toast notifications are announced (sonner uses `role="alert"`)
- **Check**: Cart updates are announced
- **Check**: Loading completion is announced
- **Check**: Error messages are announced immediately

#### 8.3 Table Accessibility (if applicable)

- Search for `<table>`, `<Table` in components
- **Check**: Data tables have `<thead>`, `<th>` with `scope` attribute
- **Check**: Tables have `<caption>` or `aria-label`
- **Check**: Complex tables use `headers` attribute to associate cells with headers

---

## Output Format

Generate `AUDIT_ACCESSIBILITY_[DATE].md` at the workspace root with the following structure:

```markdown
# Accessibility (a11y) Audit — [DATE]

## Executive Summary

[2-3 paragraph overview: WCAG compliance level, strengths (shadcn/ui baseline, semantic tokens), critical gaps, overall production-readiness for accessible use.]

## Scorecard

| Category | Checks | Pass | Warn | Fail | Critical | Score |
|---|---|---|---|---|---|---|
| Skip Navigation & Landmarks | 6 | X | X | X | X | X% |
| ARIA Labels & Roles | 8 | X | X | X | X | X% |
| Keyboard Navigation | 7 | X | X | X | X | X% |
| Color Contrast & Visual | 6 | X | X | X | X | X% |
| Images & Media | 5 | X | X | X | X | X% |
| Motion & Animations | 4 | X | X | X | X | X% |
| Touch Targets & Mobile | 5 | X | X | X | X | X% |
| Screen Reader Testing | 3 | X | X | X | X | X% |
| **TOTAL** | **44** | **X** | **X** | **X** | **X** | **X%** |

## WCAG 2.1 Compliance Summary

| Level | Total Criteria | Pass | Fail | N/A | Compliance |
|---|---|---|---|---|---|
| A (must) | X | X | X | X | X% |
| AA (should) | X | X | X | X | X% |
| AAA (may) | X | X | X | X | X% |

## Findings

| ID | Severity | WCAG | Category | Finding | File:Line | Recommendation |
|---|---|---|---|---|---|---|
| A11Y-001 | CRITICAL | 4.1.2 A | ARIA | [description] | `src/components/storefront/ProductCard.tsx:42` | [fix] |
| A11Y-002 | FAIL | 1.1.1 A | Images | [description] | `src/components/landing/HeroSection.tsx:88` | [fix] |
| A11Y-003 | WARN | 2.4.7 AA | Focus | [description] | `src/components/ui/button.tsx:15` | [fix] |
| ... | ... | ... | ... | ... | ... | ... |

## Critical Blockers (Must Fix Before Production)

1. [A11Y-001] — [description and fix]
2. ...

## High Priority (Fix Within Sprint)

1. [A11Y-0XX] — [description]
2. ...

## Warnings (Fix Before V2)

1. [A11Y-0XX] — [description]
2. ...

## Priority Actions

1. [Highest priority action with WCAG reference]
2. ...

## Screen Reader Testing Guide

Recommended manual tests to perform with VoiceOver (macOS), NVDA (Windows), or TalkDown (Android):

1. Navigate landing page with Tab key — verify all elements are reachable
2. Open product detail — verify product name, price, description are read
3. Add to cart — verify cart update is announced
4. Complete checkout — verify each form field is labeled
5. [additional tests based on audit findings]
```

## Severity Levels

- **CRITICAL**: Missing keyboard operability (WCAG 2.1.1), seizure-inducing flash (2.3.1), icon buttons without labels (4.1.2), focus traps. Blocks accessible use.
- **FAIL**: Missing form labels (1.3.1), insufficient contrast (1.4.3), missing alt text (1.1.1), disabled zoom (1.4.4), broken focus management. Must fix before launch.
- **WARN**: Missing AAA contrast (1.4.6), suboptimal touch targets, missing live regions (4.1.3), heading hierarchy issues. Fix for V2.
- **PASS**: Meets WCAG 2.1 AA standards and follows WAI-ARIA Authoring Practices.

## Notes

- Always verify findings against actual code (read the file, cite the line number). Never report speculative issues.
- Reference specific WCAG 2.1 success criteria (e.g., 1.4.3 Level AA) for every finding.
- shadcn/ui components (Radix UI primitives) provide strong a11y baseline — note where this baseline is properly leveraged vs where custom code breaks it.
- The codebase has good foundation: 30 files with ARIA, 21 with sr-only, 16 UI components with focus-visible. Focus audit on gaps, not re-confirming the baseline.
- For each CRITICAL or FAIL finding, include a concrete code-level recommendation with the specific ARIA attribute, role, or pattern to add.
- Include the WCAG criterion reference in every finding for traceability.
