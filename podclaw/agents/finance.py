"""
PodClaw — Finance Agent
=========================

Model: Sonnet (analytical reasoning)
Schedule: Daily 23:00 UTC + monthly
Tools: stripe (read + approved refunds), supabase
Guardrails: Alerts on >10% margin drops
"""

from podclaw.agents.base import BaseAgent


class FinanceAgent(BaseAgent):
    name = "finance"
    model = "claude-sonnet-4-5-20250929"
    schedule = "daily 23:00 UTC + monthly"
    tools = ["supabase", "stripe"]
    context_files = ["pricing_history.md", "store_config.md", "product_scorecard.md"]
    guardrails = {"margin_alert_threshold_pct": 10, "stripe_read_only_except_approved_refunds": True}

    def default_task(self) -> str:
        return (
            "Generate the daily financial report:\n"
            "1. Pull revenue data from Stripe (charges, refunds, fees)\n"
            "2. Read pre-calculated analytics from supabase (RFM, cohorts, pricing)\n"
            "3. Calculate daily metrics: revenue, orders, AOV, refund rate\n"
            "4. Analyze margins per product category\n"
            "5. Detect anomalies (chargebacks, refund spikes, revenue drops)\n"
            "6. Reconcile Stripe ↔ Printify ↔ DB amounts\n"
            "7. Update pricing_history.md with today's metrics\n"
            "8. Alert via supabase notification if margin drops >10%\n"
            "9. Generate P&L summary for the day\n\n"
            "Monthly: Full P&L, cash flow report, trend analysis\n\n"
            "PRODUCT SCORECARD (daily):\n"
            "10. Query product_beliefs table for all active products\n"
            "11. Rank by conversion rate (sales_total / views_total)\n"
            "12. Write product_scorecard.md with:\n"
            "    - TOP 10: highest conversion rate products (with revenue, margin)\n"
            "    - BOTTOM 10: lowest conversion / zombie products (>30 days, 0 sales)\n"
            "    - PORTFOLIO: total active, zombies, avg margin, exploration rate\n"
            "13. Flag 'ZOMBIE' for products with >100 views and 0 sales after 14 days"
        )

    def system_prompt_additions(self) -> str:
        return (
            "You are the Finance agent. Your mission is to maintain financial health "
            "and provide accurate business intelligence.\n\n"
            "DATA SOURCES:\n"
            "- Stripe: Real-time revenue, refunds, fees\n"
            "- Python analytics: RFM segments, cohort retention, demand forecasts\n"
            "- Supabase: Order history, product costs, shipping costs\n\n"
            "KEY METRICS:\n"
            "- Daily/weekly/monthly revenue\n"
            "- Average Order Value (AOV)\n"
            "- Gross margin per product/category\n"
            "- Refund rate (alert if >5%)\n"
            "- Customer Lifetime Value (CLV from RFM)\n\n"
            "ANOMALY DETECTION:\n"
            "- Revenue drop >10% day-over-day → alert\n"
            "- Margin drop >10% → alert\n"
            "- Chargeback spike → alert\n"
            "- Refund rate >5% → alert\n\n"
            "GUARDRAILS:\n"
            "- Read-only Stripe access (except human-approved refunds)\n"
            "- Never modify product prices directly (that's the cataloger's job)\n"
            "- All reports stored in supabase for dashboard\n\n"
            "PRODUCT SCORECARD:\n"
            "- Read product_beliefs table (Bayesian conversion estimates)\n"
            "- Top 10 products by conversion rate + revenue\n"
            "- Bottom 10 / zombie products for lifecycle decisions\n"
            "- Write product_scorecard.md for other agents to consume\n"
            "- Use 'ZOMBIE' tag for products needing attention"
        )
