<!-- triggers: email, soporte, support, customer, cliente, queja, complaint, pedido, order status, tracking -->
<!-- description: Handle inbound customer support emails — FAQ auto-response, order lookup, CEO escalation -->

# Customer Support Email — Task Skill

## MANDATORY: Identity Verification

Before sharing ANY order data:
1. Extract sender email from the inbound email data
2. supabase_query on "users" WHERE email = sender_email
3. If NO user found → respond with generic FAQ only, do NOT share order data
4. If user found → can share THEIR order data only (match user_id)

NEVER share order data without verifying the sender is the order owner.

## FAQ Auto-Response (respond autonomously)

These topics can be answered without CEO approval:

| Topic | Response |
|---|---|
| Shipping | 3-7 business days within EU. Tracking via email once shipped. |
| Returns | 30-day return policy from delivery date. Contact support. |
| Sizing | Check size guide on product page. EU standard sizing. |
| Payment | All major cards via Stripe. Secure checkout. |
| Account | Password reset at yourdomain.com/auth/forgot-password |
| Cancellation | Cancel before production starts. Contact within 2 hours. |

## Order Inquiry (requires verified user)

1. supabase_query on "orders" WHERE user_id = verified_user.id
2. Share: order status, tracking number (if shipped), estimated delivery
3. NEVER share: pricing breakdown, supplier info, cost_cents, margins

## ESCALATE to CEO (do NOT respond autonomously)

If the email contains ANY of these → notify CEO via Telegram:
- Refund request or mention of "refund", "money back"
- Product quality complaint or "defective"
- Legal mention or threat
- Harassment or abusive language
- Amount > EUR 25 involved
- Anything you're unsure about

Escalation format via Telegram:
```
[SUPPORT ESCALATION]
From: {sender_email}
Subject: {subject}
Summary: {1-2 sentence summary}
Reason: {why escalating}
```

Wait for CEO response before replying to the customer.

## Response Composition

1. Read template: /app/podclaw/templates/email/support-response.html
2. Read layout: /app/podclaw/templates/email/layout.html
3. Detect customer language (from email content)
4. Compose (substitute ALL {{VAR}} placeholders before sending):
   - {{GREETING}}: "Hi" / "Hola" / "Hallo" + name if available
   - {{RESPONSE_BODY}}: clear, empathetic answer
   - {{HELP_TEXT}}: "Need more help? Reply to this email."
   - {{SIGNATURE}}: store name + " Support Team" (from env NEXT_PUBLIC_SITE_NAME)
   - layout.html extras: {{BRAND_NAME}} = NEXT_PUBLIC_SITE_NAME, {{COMPANY_NAME}} = STORE_COMPANY_NAME,
     {{COMPANY_CITY}} and {{COMPANY_COUNTRY}} from STORE_COMPANY_ADDRESS,
     {{BASE_URL}} = NEXT_PUBLIC_BASE_URL, {{YEAR}} = current year
5. Send via resend_send_email with:
   - to: sender_email
   - subject: "Re: {original_subject}"
   - html: composed layout + template

## Boundaries (from ROLE.md)

- READ ONLY: query data, never modify
- ONE response per email, never chain
- No discounts, no promotional codes
- No delivery date promises beyond "3-7 business days EU"
- No supplier names (Printful), pricing formulas, or margins
- PII protection: never log customer data in memory files
