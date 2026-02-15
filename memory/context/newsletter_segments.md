# Newsletter Segments

*Updated by: newsletter*
*Last updated: (pending first agent cycle)*

*[INITIAL SEED — will be replaced after first live cycle]*

## Subscriber Overview
<!-- Newsletter: populate from newsletter_subscribers table -->
<!-- Run: {"table": "newsletter_subscribers", "select": "id,segment,locale", "limit": 500} -->
- Total subscribers: (query)
- Active (opened in 30d): (query)
- Locale split: EN % | DE % | ES %

## Subscriber Segments
<!-- Based on RFM data from customer_segments table -->

### Champions (High value, frequent buyers)
- Count: (query from customer_segments)
- Strategy: Exclusive previews, loyalty rewards, early access
- Email frequency: 2x/week
- Best subject line: (from A/B test results)

### Loyal Customers (Regular buyers)
- Count: (query)
- Strategy: New arrivals, personalized recommendations
- Email frequency: 1x/week
- Best subject line: (from A/B test results)

### At-Risk (Haven't purchased recently)
- Count: (query)
- Strategy: Re-engagement, special offers, "we miss you"
- Email frequency: 1x/week
- Best subject line: (from A/B test results)

### New Customers (Recent first purchase)
- Count: (query)
- Strategy: Welcome series (3 emails over 7 days), store highlights
- Email frequency: Drip sequence
- Best subject line: (from A/B test results)

### Prospects (Signed up, no purchase)
- Count: (query)
- Strategy: Value content, featured products, first-purchase incentive
- Email frequency: 1x/week
- Best subject line: (from A/B test results)

## A/B Test Results
<!-- Newsletter: log after each campaign, winner auto-selects after 4h -->
<!-- Run: {"table": "newsletter_campaigns", "select": "id,subject,segment,open_rate,click_rate", "order": "created_at", "limit": 10} -->

## Drip Sequences
- Welcome Series: 3 emails (Day 1, Day 3, Day 7)
- Post-Purchase: 2 emails (Day 7 satisfaction, Day 14 review request)
- Win-Back: 3 emails (Week 1, Week 3, Week 6)

## Unsubscribe Rate
<!-- Target: < 0.5% per campaign -->
<!-- Track per-campaign rate from resend_get_bounce_stats -->

## Notes
- This file is read by: newsletter
- CAN-SPAM: every email includes unsubscribe + physical address
- A/B test winner auto-selects after 4 hours
