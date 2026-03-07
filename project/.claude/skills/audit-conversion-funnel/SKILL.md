---
name: Audit Conversion Funnel
description: >
  E-commerce conversion funnel audit — from landing page to post-purchase. Use when asked to
  audit conversions, review the purchase flow, assess cart abandonment, check checkout UX,
  or analyze why users don't buy.
---

# Audit Conversion Funnel

Systematic audit of the full purchase journey: Landing → Product → Cart → Checkout → Payment → Post-Purchase.

## Prerequisites

- Read `frontend/src/app/[locale]/(landing)/page.tsx` for landing page
- Read `frontend/src/app/[locale]/(app)/shop/` for product listing and detail
- Read `frontend/src/app/[locale]/(app)/cart/` for cart
- Read `frontend/src/app/[locale]/(focused)/checkout/` for checkout flow
- Read `frontend/src/app/[locale]/(app)/orders/` for order tracking

## Workflow

### Phase 1: Landing → Product Discovery (Top of Funnel)

1. **Landing page effectiveness**:
   - Is there a clear value proposition above the fold?
   - Is the primary CTA visible without scrolling? What does it say?
   - Does the hero communicate what SKAPARA sells? (not just "AI Store")
   - Are there product previews/carousel on the landing page?
   - Time to first meaningful content — is it fast?

2. **Navigation to products**:
   - How many clicks from landing to first product? (should be ≤2)
   - Is "Shop" in the primary navigation?
   - Is there a search bar? Does it work? Is it prominent?
   - Are categories/filters available? (t-shirts, hoodies, hats, etc.)

3. **Product listing page**:
   - Does the grid show prices? Images? Color options?
   - Is there filtering by category, size, color, price?
   - Is there sorting? (price, newest, popular)
   - Is pagination or infinite scroll implemented?
   - Are products loading fast? (skeleton loaders?)

### Phase 2: Product → Cart (Intent)

4. **Product detail page**:
   - Are images high quality? Multiple angles? Zoom capability?
   - Is the price clearly visible and formatted correctly?
   - Is the size selector intuitive? Does it show available sizes?
   - Is the color selector showing actual product images per color?
   - Is there a size guide link? Does it open inline or navigate away?
   - Is the "Add to Cart" button prominent and always visible?
   - Is there product description with compelling copy?
   - Are materials and care instructions shown?
   - Is shipping info visible? (estimated delivery, cost)

5. **Add to cart experience**:
   - What happens after "Add to Cart"? (toast, drawer, redirect?)
   - Can user continue shopping easily after adding?
   - Is there a "Buy Now" option for impulse purchases?
   - Does the cart badge update immediately?

### Phase 3: Cart → Checkout (Decision)

6. **Cart page**:
   - Can user modify quantity? Remove items?
   - Are product images, names, sizes, colors shown?
   - Is the subtotal clearly visible?
   - Is shipping cost shown or estimated?
   - Is there a discount/promo code field?
   - Is the "Proceed to Checkout" CTA clear?
   - Are there trust signals? (secure checkout, return policy)

7. **Cart persistence**:
   - Does the cart survive page refresh?
   - Does it survive browser close and reopen?
   - Does it persist across devices for logged-in users?
   - Is there abandoned cart recovery? (email after X hours)

### Phase 4: Checkout → Payment (Commitment)

8. **Checkout flow**:
   - How many steps? (should be ≤3: shipping, payment, review)
   - Is there guest checkout? (critical — don't force registration)
   - Are form fields minimal? (only what's needed for shipping)
   - Is there address autocomplete?
   - Are input types correct? (email, tel, numeric for zip)
   - Is there a progress indicator?

9. **Payment options**:
   - Stripe checkout — is it embedded or redirect?
   - Are payment methods shown? (card, Apple Pay, Google Pay, Klarna?)
   - Is the order total clearly shown before payment?
   - Is there a security badge near the payment form?

10. **Shipping options**:
    - Are shipping costs shown before the final step?
    - Is there a free shipping threshold? Is it communicated?
    - Are estimated delivery dates shown?
    - Are international shipping rules clear? (EU only?)

### Phase 5: Post-Purchase (Retention)

11. **Order confirmation**:
    - Is there an order confirmation page?
    - Is a confirmation email sent? What does it contain?
    - Is the order number prominently displayed?

12. **Order tracking**:
    - Can users track their order status?
    - Are status updates pushed? (email, notification)
    - Is Printful tracking integration working?

13. **Returns & support**:
    - Is there a return policy page?
    - Can users initiate returns from their account?
    - Is there a contact method for order issues?

## Output Format

Generate `AUDIT_CONVERSION_FUNNEL_[DATE].md` at workspace root with:

```markdown
# Conversion Funnel Audit — [DATE]

## Funnel Summary
| Stage | Status | Friction Points | Drop-off Risk |
|---|---|---|---|

## Critical Gaps (will lose sales)
[List gaps that directly cause lost revenue]

## Quick Wins (easy fixes, high impact)
[List improvements with high ROI]

## Recommendations (by funnel stage)
[Prioritized by impact on conversion]
```
