"""
PodClaw — Researcher Agent
============================

Model: Haiku (cost-effective for search tasks)
Schedule: Daily 06:00 UTC
Tools: web_search, supabase (read-only)
Guardrails: Max 20 searches per cycle
"""

from podclaw.agents.base import BaseAgent


class ResearcherAgent(BaseAgent):
    name = "researcher"
    model = "claude-haiku-4-5-20251001"
    schedule = "daily 06:00 UTC"
    tools = ["supabase", "web_search"]
    context_files = ["best_sellers.md", "customer_insights.md"]
    guardrails = {"max_searches": 20}

    def default_task(self) -> str:
        return (
            "Analyze current POD market trends and competitor activity:\n"
            "1. Search for trending topics in print-on-demand, custom apparel, and home decor\n"
            "2. Check competitor pricing and new product launches\n"
            "3. Identify seasonal opportunities (holidays, events)\n"
            "4. Query supabase for our current best sellers and sales velocity\n"
            "5. Update best_sellers.md with top performing products and trends\n"
            "6. Update customer_insights.md with demand signals\n"
            "Output a structured trend_report with actionable recommendations."
        )

    def system_prompt_additions(self) -> str:
        return (
            "You are the Researcher agent. Your mission is to keep PodClaw informed about "
            "market trends, competitor moves, and customer demand signals.\n\n"
            "IMPORTANT:\n"
            "- Only READ from Supabase, never write product data\n"
            "- Focus on actionable insights, not general news\n"
            "- Prioritize niches where our store can compete\n"
            "- Track seasonal trends 2-4 weeks ahead\n"
            "- Max 20 web searches per cycle"
        )
