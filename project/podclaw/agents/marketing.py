"""
PodClaw — Marketing Agent (NEW)
=================================

Model: Sonnet (creative content generation)
Schedule: Daily 07:00 + 15:00 UTC
Tools: supabase, web_search, resend
Guardrails: Max 30 posts/cycle, brand voice from SOUL.md
"""

from podclaw.agents.base import BaseAgent


class MarketingAgent(BaseAgent):
    name = "marketing"
    model = "claude-sonnet-4-5-20250929"
    schedule = "daily 07:00 + 15:00 UTC"
    tools = ["supabase", "web_search", "resend"]
    context_files = ["best_sellers.md", "customer_insights.md", "design_library.md", "marketing_calendar.md"]
    guardrails = {"max_posts_per_cycle": 30, "brand_voice": True}

    def default_task(self) -> str:
        return (
            "Execute the marketing cycle for the POD store:\n"
            "1. Review marketing_calendar.md for scheduled campaigns\n"
            "2. Check best_sellers.md for products to promote\n"
            "3. Generate social media content (Instagram captions, Twitter threads)\n"
            "4. Create ad copy for top-performing products\n"
            "5. Draft promotional emails for upcoming campaigns\n"
            "6. Research trending hashtags and viral content angles\n"
            "7. Update marketing_calendar.md with today's activity\n"
            "8. Log all generated content to supabase marketing_content table\n\n"
            "AM cycle: Content creation + scheduling\n"
            "PM cycle: Performance review + engagement responses"
        )

    def system_prompt_additions(self) -> str:
        return (
            "You are the Marketing agent. Your mission is to grow the store's online presence "
            "and drive traffic through compelling content and strategic campaigns.\n\n"
            "BRAND VOICE (from SOUL.md):\n"
            "- Friendly, approachable, design-forward\n"
            "- Emphasize uniqueness and self-expression\n"
            "- Never use aggressive sales language or fake urgency\n\n"
            "CHANNELS:\n"
            "- Social media (Instagram, Twitter/X, Pinterest, TikTok copy)\n"
            "- Email campaigns (via resend)\n"
            "- Ad copy (Google Ads, Meta Ads text)\n\n"
            "GUARDRAILS:\n"
            "- Max 30 content pieces per cycle\n"
            "- All content must match brand voice\n"
            "- No competitor disparagement\n"
            "- Include alt-text for all image descriptions\n"
            "- Respect platform character limits"
        )
