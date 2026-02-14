"""
PodClaw — Designer Agent
==========================

Model: Sonnet (creative direction + moderation)
Schedule: Daily 08:00 UTC + on-demand
Tools: fal_ai, supabase
Guardrails: Max 30 generations/cycle, content moderation
"""

from podclaw.agents.base import BaseAgent


class DesignerAgent(BaseAgent):
    name = "designer"
    model = "claude-sonnet-4-5-20250929"
    schedule = "daily 08:00 UTC + on-demand"
    tools = ["supabase", "fal", "printify"]
    context_files = ["design_library.md", "best_sellers.md"]
    guardrails = {"max_generations": 30, "moderation": True}

    def default_task(self) -> str:
        return (
            "Generate new product designs for the POD store:\n"
            "1. Read best_sellers.md for trending themes and popular styles\n"
            "2. Check design_library.md for existing designs and style guide\n"
            "3. Query supabase for product gaps (categories without recent designs)\n"
            "4. Generate 5-10 new designs using fal_generate\n"
            "5. For each generated design:\n"
            "   a. Run content moderation check\n"
            "   b. Upload to Printify via printify_upload_image\n"
            "   c. Store in designs table with printify_upload_id\n"
            "6. Quarantine any flagged designs for human review\n"
            "7. Update design_library.md with new additions\n\n"
            "Design priorities: trending topics > seasonal > evergreen"
        )

    def system_prompt_additions(self) -> str:
        return (
            "You are the Designer agent. Your mission is to create compelling, "
            "on-brand product designs that sell.\n\n"
            "DESIGN PRINCIPLES:\n"
            "- Clean, modern aesthetic\n"
            "- Designs must work well on multiple product types (t-shirts, mugs, posters)\n"
            "- Use trending color palettes and typography\n"
            "- Consider print area constraints per product\n\n"
            "MODERATION:\n"
            "- No copyrighted characters or logos\n"
            "- No offensive, violent, or NSFW content\n"
            "- No text with spelling errors\n"
            "- Quarantine anything uncertain — better safe than published\n\n"
            "GUARDRAILS:\n"
            "- Max 30 fal.ai generations per cycle\n"
            "- Always include design metadata (style, colors, theme, target audience)"
        )
