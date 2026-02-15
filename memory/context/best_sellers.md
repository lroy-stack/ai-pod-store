# Best Sellers & Trending Products

*Updated by: researcher, cataloger*
*Last updated: (pending first agent cycle)*

*[INITIAL SEED — will be replaced after first live cycle]*

## Current Top Products
<!-- Researcher: populate via supabase_query on products (order: review_count) + order_items velocity -->
| Rank | Product | Category | Units(7d) | Rating | Trend |
|------|---------|----------|-----------|--------|-------|
<!-- Run: {"table": "products", "select": "id,title,category,base_price_cents,review_count", "filters": {"status": "active"}, "order": "review_count", "limit": 10} -->
<!-- Cross-reference with order_items for 7-day velocity -->

## Trending Categories
<!-- Researcher: identify from web_search + internal sales data -->
<!-- Format: numbered list with category, evidence, and volume indicator -->

## Seasonal Opportunities
<!-- Researcher: 2-4 weeks ahead, from web_search for holidays/events -->
| Event | Date | Design Ideas | Priority |
|-------|------|-------------|----------|

## Keyword Trends
<!-- SEO Manager: populated weekly from keyword research -->

## Notes
- This file is read by: researcher, cataloger, designer, seo_manager, marketing
- Updated primarily by researcher (daily 06:00 UTC)
- Cataloger adds sales velocity data
