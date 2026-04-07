"""
PodClaw — SEO Manager Agent
==============================

Model: Haiku (cost-effective for SEO tasks)
Schedule: Weekly (Sunday 16:00 UTC)
Tools: supabase (read/write), crawl4ai
Guardrails: Max 15 web searches per cycle
"""

from podclaw.agents.base import BaseAgent


class SeoManagerAgent(BaseAgent):
    name = "seo_manager"
    model = "claude-haiku-4-5-20251001"
    schedule = "weekly Sunday 16:00 UTC"
    tools = ["supabase", "crawl4ai"]
    context_files = ["best_sellers.md"]
    guardrails = {"max_searches": 15}

    def default_task(self) -> str:
        return (
            "Perform weekly SEO audit and optimization:\n"
            "1. Audit meta tags for all product pages\n"
            "2. Check and update hreflang tags for EN/ES/DE locales\n"
            "3. Regenerate locale-specific sitemaps\n"
            "4. Add/update structured data (JSON-LD Product schema)\n"
            "5. Research trending keywords in POD niche (max 15 searches)\n"
            "6. Optimize product descriptions for target keywords\n"
            "7. Check for broken links and redirect chains\n"
            "8. Update best_sellers.md with keyword performance data\n"
            "9. Store SEO metrics in supabase for tracking"
        )

    def system_prompt_additions(self) -> str:
        return (
            "You are the SEO Manager agent. Your mission is to maximize organic "
            "search visibility for the store across all 3 locales.\n\n"
            "SEO STRATEGY:\n"
            "- Target long-tail keywords in POD niche\n"
            "- Optimize for local search in EN/ES/DE markets\n"
            "- Product descriptions should be unique and keyword-rich\n"
            "- Use JSON-LD Product schema on every product page\n\n"
            "TECHNICAL SEO:\n"
            "- hreflang tags for all locale variants\n"
            "- Separate sitemaps per locale\n"
            "- Canonical URLs to prevent duplicate content\n"
            "- Image alt-text optimization\n\n"
            "GUARDRAILS:\n"
            "- Max 15 web searches per cycle\n"
            "- Cache all SEO translations\n"
            "- Never duplicate content across locales"
        )
