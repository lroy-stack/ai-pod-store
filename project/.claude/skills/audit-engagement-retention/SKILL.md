---
name: Audit Engagement Retention
description: >
  E-commerce engagement and retention audit — wishlists, account value, email capture,
  notifications, loyalty, personalization, and AI chat utility. Use when asked to audit
  engagement, review retention, assess repeat purchase potential, or improve customer loyalty.
---

# Audit Engagement Retention

Systematic audit of features that drive repeat visits and purchases.

## Prerequisites

- Read `frontend/src/app/[locale]/(app)/wishlist/` for wishlist functionality
- Read `frontend/src/app/[locale]/(app)/profile/` for user account
- Read `frontend/src/app/[locale]/(app)/orders/` for order history
- Read `frontend/src/components/storefront/` for engagement components
- Check for email/notification related code in `frontend/src/app/api/`

## Workflow

### Phase 1: Account Value Proposition

1. **Registration incentive**:
   - Why should a user create an account? Is it communicated?
   - Is there a welcome discount for first-time buyers?
   - Is registration friction-free? (social login, minimal fields)

2. **Account dashboard**:
   - What does the user see after login?
   - Order history — complete and useful?
   - Saved addresses — for faster checkout?
   - Profile customization — avatar, name, preferences?

3. **Wishlist functionality**:
   - Can users add products to wishlist?
   - Is wishlist accessible from product cards and detail pages?
   - Does wishlist persist across sessions?
   - Is there "notify on price drop" or "back in stock"?
   - Can wishlists be shared? (social, gift registry)

### Phase 2: Communication Channels

4. **Email marketing**:
   - Is there newsletter signup? Where? (footer, popup, checkout)
   - Is there a welcome email sequence?
   - Are there abandoned cart recovery emails?
   - Are order status update emails sent?
   - Is there a back-in-stock notification system?
   - Is Resend configured and working?

5. **Push notifications**:
   - Are web push notifications implemented?
   - What events trigger notifications?
   - Can users manage notification preferences?

6. **Transactional emails**:
   - Order confirmation email — exists, well-designed?
   - Shipping confirmation — with tracking link?
   - Delivery confirmation — with review prompt?
   - Return/refund confirmation?

### Phase 3: Personalization

7. **Product recommendations**:
   - Is there a recommendation engine?
   - "Recently viewed" products?
   - "Based on your purchases" suggestions?
   - "Customers also bought" on product pages?
   - Are recommendations powered by pgvector embeddings?

8. **AI chat utility**:
   - Does the AI chat help find products?
   - Can it answer product questions? (size, material, shipping)
   - Does it recommend products based on preferences?
   - Can it assist with order issues?
   - Is the chat prominently accessible?

9. **Content personalization**:
   - Is the landing page personalized for returning users?
   - Are category pages sorted by relevance to user?
   - Is there geo-based personalization? (language, currency)

### Phase 4: Loyalty & Repeat Purchase

10. **Loyalty program**:
    - Is there a points/rewards system?
    - Is there a referral program?
    - Is there a VIP tier system?
    - Are there birthday/anniversary rewards?

11. **Re-engagement**:
    - Are inactive users contacted? (win-back emails)
    - Is there seasonal/holiday marketing?
    - Are there limited editions or drops? (creates urgency to return)

12. **Community building**:
    - Is there social media integration?
    - Is there user-generated content? (customer photos)
    - Is there a brand community or forum?

## Output Format

Generate `AUDIT_ENGAGEMENT_[DATE].md` at workspace root with:

```markdown
# Engagement & Retention Audit — [DATE]

## Engagement Feature Matrix
| Feature | Exists | Working | Quality (1-5) | Impact |
|---|---|---|---|---|

## Critical Gaps
[Missing features that directly impact repeat purchases]

## Quick Wins
[Easy implementations with high retention impact]

## Recommendations
[Prioritized by customer lifetime value impact]
```
