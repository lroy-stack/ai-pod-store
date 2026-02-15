# Customer Insights

*Updated by: customer_manager, researcher*
*Last updated: (pending first agent cycle)*

*[INITIAL SEED — will be replaced after first live cycle]*

## Customer Segments (RFM)
<!-- Researcher: populate via supabase_query on customer_segments -->
<!-- Run: {"table": "customer_segments", "select": "segment_name,customer_count,avg_order_value", "limit": 10} -->
| Segment | Count | Avg Order Value | Trend |
|---------|-------|----------------|-------|
| Champions | (query) | (query) | |
| Loyal Customers | (query) | (query) | |
| At-Risk | (query) | (query) | |
| New Customers | (query) | (query) | |
| Prospects | (query) | (query) | |

## Common Support Issues
<!-- Customer Manager: aggregate from return_requests and product_reviews -->
<!-- Run: {"table": "return_requests", "select": "reason,status", "order": "created_at", "limit": 50} -->

## Review Sentiment
<!-- Customer Manager: aggregate from product_reviews ratings -->
<!-- Run: {"table": "product_reviews", "select": "rating,comment", "order": "created_at", "limit": 50} -->

## Purchase Patterns
<!-- Researcher: derive from order_items analysis -->
- Peak hours: (from analytics)
- Avg items per order: (from analytics)
- Repeat purchase rate: (from analytics)
- Top cross-sell: (from analytics)

## Locale Distribution
<!-- Researcher: from user profiles or order data -->
- EN: %
- DE: %
- ES: %

## Notes
- This file is read by: researcher, customer_manager, marketing, newsletter
- Updated by customer_manager (daily) and researcher (daily)
