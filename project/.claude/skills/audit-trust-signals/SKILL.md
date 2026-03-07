---
name: Audit Trust Signals
description: >
  E-commerce trust and credibility audit — return policy, shipping info, security badges,
  brand story, contact options, legal compliance. Use when asked to audit trust, review
  credibility, assess why users don't trust the store, or check legal compliance.
---

# Audit Trust Signals

Systematic audit of everything that builds (or erodes) customer trust.

## Prerequisites

- Navigate the storefront as a first-time visitor would
- Read footer, header, and static pages
- Check for legal pages (terms, privacy, returns, shipping)
- Read `frontend/src/app/[locale]/(landing)/page.tsx` for landing trust signals

## Workflow

### Phase 1: First Impression Trust

1. **Professional appearance**:
   - Does the site look professional or "under construction"?
   - Is the branding consistent? (logo, colors, typography)
   - Are there broken images, placeholder text, or lorem ipsum?
   - Is the favicon set? Is the site title correct?

2. **Brand identity**:
   - Is there an "About" page? What does it communicate?
   - Is the brand story compelling? (EU-made, sustainable, AI-designed?)
   - Is there a team/founder page?
   - Does the domain name match the brand?

3. **Contact accessibility**:
   - Is there a visible contact method? (email, chat, form)
   - Is the response time expectation set?
   - Is there a physical address? (required in EU for e-commerce)
   - Is there a phone number? (increases trust significantly)

### Phase 2: Purchase Confidence

4. **Return policy**:
   - Is it easy to find? (footer, product page, checkout)
   - Is it clear and fair? (30 days? Full refund? Who pays return shipping?)
   - Is it compliant with EU 14-day withdrawal right?
   - Is the process explained step by step?

5. **Shipping information**:
   - Is shipping cost visible before checkout?
   - Are delivery estimates shown? (3-5 business days, 7-14 days?)
   - Is there a free shipping threshold? Is it promoted?
   - Are shipping zones clear? (EU only? Worldwide?)
   - Is Printful's production time communicated? (2-7 days + shipping)

6. **Payment security**:
   - Are payment method logos shown? (Visa, Mastercard, etc.)
   - Is "Secure checkout" or SSL badge visible?
   - Is Stripe's trusted branding used?
   - Is there a money-back guarantee?

7. **Product guarantees**:
   - Is print quality guaranteed?
   - Is there a satisfaction guarantee?
   - Are materials/sizing accurate to description?

### Phase 3: Legal & Regulatory

8. **GDPR compliance**:
   - Privacy policy — exists, accessible, comprehensive?
   - Cookie consent banner — exists, blocks non-essential cookies?
   - Right to deletion — can users delete their account?
   - Data export — can users export their data?
   - Consent management — tracked for marketing emails?

9. **GPSR compliance** (EU Product Safety Regulation):
   - Is manufacturer info on every product?
   - Are materials listed?
   - Is safety information present?
   - Is the responsible EU person listed?

10. **E-commerce legal requirements** (EU):
    - Terms and conditions page?
    - Imprint/Impressum? (required in DE)
    - VAT information? (prices include VAT)
    - 14-day withdrawal right clearly stated?
    - Dispute resolution link? (EU ODR platform)

### Phase 4: Social Proof at Scale

11. **External trust signals**:
    - Are there any external reviews? (Trustpilot, Google Reviews)
    - Is there social media presence linked?
    - Are there customer testimonials?
    - Is there press/media coverage?

12. **Community signals**:
    - Social media follower counts?
    - User-generated content?
    - Community/forum?
    - Instagram feed on site?

## Output Format

Generate `AUDIT_TRUST_SIGNALS_[DATE].md` at workspace root with:

```markdown
# Trust Signals Audit — [DATE]

## Trust Score Matrix
| Category | Score (1-5) | Status | Impact on Conversion |
|---|---|---|---|

## Missing Trust Signals (Critical)
[Elements whose absence actively hurts sales]

## Legal Compliance Gaps
[Regulatory requirements not met]

## Recommendations
[Prioritized by conversion impact]
```
