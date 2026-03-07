---
name: Audit Mobile UX
description: >
  E-commerce mobile UX audit — responsive design, touch targets, mobile checkout, scroll
  performance, navigation, and thumb zones. Use when asked to audit mobile experience,
  review responsive design, assess mobile conversion, or check mobile usability.
---

# Audit Mobile UX

Systematic audit of the mobile shopping experience (70%+ of e-commerce traffic).

## Prerequisites

- Read `frontend/src/components/storefront/StorefrontHeader.tsx` for mobile nav
- Read `frontend/src/components/storefront/StorefrontSidebar.tsx` for mobile sidebar
- Read `frontend/src/components/storefront/StorefrontLayout.tsx` for responsive layout
- Check all pages for mobile-first responsive patterns (base → md: → lg:)

## Workflow

### Phase 1: Navigation & Discovery (Mobile)

1. **Mobile header**:
   - Is there a hamburger menu? Is it a Sheet/Drawer (not page navigation)?
   - Is the logo clickable and goes home?
   - Is the cart icon visible with badge count?
   - Is search accessible from the header?
   - Is the header sticky or does it scroll away?

2. **Mobile navigation**:
   - Is the menu organized logically?
   - Can users browse categories from the menu?
   - Is the menu dismissible (tap outside, swipe, X button)?
   - Are menu items large enough for touch (≥44px height)?

3. **Product grid on mobile**:
   - Is it 1 or 2 columns? (2 columns optimal for discovery)
   - Are product cards showing enough info? (image, name, price)
   - Is "Add to Cart" accessible from the grid or detail only?
   - Can users filter/sort from mobile? How? (bottom sheet, sidebar)

### Phase 2: Touch Interaction

4. **Touch targets**:
   - Are ALL interactive elements ≥44x44px? (Apple HIG minimum)
   - Are buttons properly spaced? (no accidental taps)
   - Are links distinguishable from text?
   - Check: size selectors, color swatches, quantity controls, form inputs

5. **Thumb zones**:
   - Are primary CTAs in the bottom 40% of screen? (natural thumb reach)
   - Is the "Add to Cart" button at the bottom of the product page?
   - Is the main navigation bottom-aligned or top-only?
   - Is there a sticky bottom bar for key actions?

6. **Gestures**:
   - Is there swipe support for product images?
   - Can the sidebar be swiped to close?
   - Is pull-to-refresh implemented where appropriate?
   - Are there any gesture conflicts with browser defaults?

### Phase 3: Mobile Forms & Checkout

7. **Form usability**:
   - Are form fields using correct `inputMode`? (email, tel, numeric)
   - Is there autofill support? (autocomplete attributes)
   - Are labels always visible? (not just placeholder-only)
   - Is the keyboard type appropriate for each field?
   - Are error messages shown inline near the field?

8. **Mobile checkout**:
   - How many scrolls to complete checkout?
   - Is the order summary collapsible? (don't waste screen space)
   - Is the payment form mobile-optimized?
   - Is Apple Pay / Google Pay available? (one-tap checkout)
   - Is the final "Place Order" button always visible?

### Phase 4: Performance on Mobile

9. **Loading experience**:
   - Is there a loading skeleton for product grid?
   - Are images lazy-loaded?
   - Is above-the-fold content prioritized?
   - Does the page feel fast on simulated 3G? (4s+ = bad)

10. **Scroll performance**:
    - Is the product grid smooth while scrolling? (no jank)
    - Are heavy components virtualized? (long lists)
    - Is there scroll-linked animation lag?

11. **Offline / poor connection**:
    - What happens with no internet? (error page, cached content?)
    - Is there a service worker for offline support?
    - Are images served with responsive `srcSet`?

### Phase 5: Mobile-Specific UX Patterns

12. **Bottom navigation bar**:
    - Is there one? (Home, Shop, Cart, Profile — standard e-commerce pattern)
    - If not, is the main navigation easily accessible?

13. **Product detail mobile layout**:
    - Image → Price → Options → Add to Cart → Description (optimal order)
    - Is the image taking up appropriate screen real estate?
    - Is the description collapsible? (accordion for long content)
    - Are related products shown below?

14. **Cart & mini-cart**:
    - Is there a slide-out mini-cart (Sheet)?
    - Or does adding to cart require navigating to cart page?
    - Can users edit cart without leaving current page?

## Output Format

Generate `AUDIT_MOBILE_UX_[DATE].md` at workspace root with:

```markdown
# Mobile UX Audit — [DATE]

## Mobile Experience Scorecard
| Area | Score (1-5) | Status | Critical Issues |
|---|---|---|---|

## Touch Target Violations
[List elements below 44px with file:line references]

## Critical UX Gaps
[Issues that directly cause mobile abandonment]

## Quick Wins
[Easy fixes for immediate mobile improvement]

## Recommendations
[Prioritized by mobile conversion impact]
```
