"""
PodClaw — Cataloger Agent
============================

Model: Sonnet (product management requires reasoning)
Schedule: Daily 10:00 + 14:00 + 18:00 UTC
Tools: printify (full CRUD), supabase, gemini
Guardrails: Max 50 creates/cycle, ±20% price changes
"""

from podclaw.agents.base import BaseAgent


class CatalogerAgent(BaseAgent):
    name = "cataloger"
    model = "claude-sonnet-4-5-20250929"
    schedule = "daily 10:00 + 14:00 + 18:00 UTC"
    tools = ["supabase", "printify", "gemini"]
    context_files = ["best_sellers.md", "pricing_history.md", "product_scorecard.md"]
    guardrails = {"max_creates": 50, "max_price_change_pct": 20}

    def default_task(self) -> str:
        return (
            "Manage the product catalog:\n"
            "1. Use printify_get_blueprints to discover available product types\n"
            "2. Use printify_get_providers to find providers for selected blueprints\n"
            "3. Use printify_get_variants to get available sizes/colors\n"
            "4. Check designs table for approved designs without products\n"
            "5. For each approved design:\n"
            "   a. printify_upload_image with the design URL\n"
            "   b. printify_create with blueprint, provider, variants, and uploaded image\n"
            "   c. printify_publish to make the product visible\n"
            "   d. Save provider_product_id to products table via supabase\n"
            "6. Generate descriptions in 3 locales (en/es/de) using gemini\n"
            "7. Generate embeddings for new products (RAG search)\n"
            "8. Update pricing_history.md with any changes\n\n"
            "Cycle 1 (10:00): New products from approved designs\n"
            "Cycle 2 (14:00): Sync + pricing adjustments\n"
            "Cycle 3 (18:00): Trending items + peak preparation\n\n"
            "PERFORMANCE-INFORMED PRICING:\n"
            "9. Read product_scorecard.md for conversion rate data\n"
            "10. New products in high-performing niches: use similar pricing to top performers\n"
            "11. Products flagged as zombies: consider price adjustments within ±20% limit"
        )

    def system_prompt_additions(self) -> str:
        return (
            "You are the Cataloger agent. Your mission is to maintain a fresh, "
            "well-priced, and fully translated product catalog.\n\n"
            "PRODUCT CREATION:\n"
            "- Every product needs title, description, price in 3 locales\n"
            "- Descriptions should be SEO-friendly and engaging\n"
            "- Use Printify blueprints for product types\n"
            "- Generate product embeddings for semantic search\n\n"
            "PRICING:\n"
            "- Base pricing from Printify costs + margin target\n"
            "- Dynamic adjustments based on demand forecasts\n"
            "- Never change price more than ±20% in one cycle\n"
            "- Log every price change to pricing_history.md\n\n"
            "GUARDRAILS:\n"
            "- Max 50 product creates per cycle\n"
            "- All descriptions must be in en, es, de\n"
            "- Verify Printify sync before publishing\n\n"
            "PERFORMANCE FEEDBACK:\n"
            "- product_scorecard.md has top/bottom performing products\n"
            "- Use conversion data to inform pricing of new products\n"
            "- Match pricing of new products to similar top performers"
        )
