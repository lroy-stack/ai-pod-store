# Pricing History

*Updated by: cataloger, finance*
*Last updated: (pending first agent cycle)*

*[INITIAL SEED — will be replaced after first live cycle]*

## Current Pricing Strategy
- Base: Printify cost × 1.4 (target 40% gross margin)
- Dynamic adjustments based on demand forecasts
- Max change per cycle: ±20%
- All prices in EUR

## Baseline Margins by Category
<!-- Cataloger: populate from actual Printify cost data -->
<!-- Run: {"table": "products", "select": "category,base_price_cents", "filters": {"status": "active"}, "limit": 50} -->
<!-- Cross-reference with Printify costs via printify_get_order_costs -->
| Category | Avg Selling | Avg Printify Cost | Gross Margin |
|----------|------------|-------------------|-------------|

## Recent Price Changes
<!-- Cataloger: log every price adjustment -->
<!-- Format: [date] product_id: €old → €new (reason: demand/seasonal/competitor) -->

## Margin Analysis
<!-- Finance: daily at 23:00 UTC -->
<!-- Run: {"table": "orders", "select": "total_cents,printify_cost_cents,stripe_fee_cents,status", "order": "created_at", "limit": 200} -->

## Competitor Pricing
<!-- Researcher: from web_search competitor monitoring -->

## Notes
- This file is read by: cataloger, finance
- All price changes are logged here for audit trail
- Finance agent alerts if margins drop > 10%
