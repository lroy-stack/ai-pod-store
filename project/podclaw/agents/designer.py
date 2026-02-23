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
    tools = ["supabase", "fal", "printify", "crawl4ai", "gemini"]
    context_files = ["design_library.md", "best_sellers.md"]
    guardrails = {"max_generations": 30, "moderation": True}

    def default_task(self) -> str:
        return (
            "Source and create product designs for the POD store.\n"
            "FREE IMAGES FIRST — the internet has billions of royalty-free images.\n"
            "AI generation costs real money. Do NOT generate when you can source.\n\n"
            "DIVERSIFICATION (validation phase): In this cycle, ensure at least:\n"
            "- 3 different styles (vector, watercolor, photorealistic, minimal, retro, cartoon)\n"
            "- 3 different niches (pets, fitness, geek/gaming, nature, humor, motivational)\n"
            "- 3 different product types (t-shirt, mug, poster, sticker, tote)\n"
            "Publish FAST — a mediocre product published beats a perfect draft.\n\n"
            "1. Read best_sellers.md + design_library.md for trending themes\n"
            "2. Query supabase for product gaps (categories without recent designs)\n\n"
            "MANDATORY FIRST PASS — FREE SOURCED DESIGNS (target 7-10):\n"
            "3. Call crawl_url 7-10 times on image source sites. Use directed URLs:\n"
            "   - https://pngimg.com/search/?q={theme}\n"
            "   - https://unsplash.com/s/photos/{theme}\n"
            "   - https://www.pexels.com/search/{theme}/\n"
            "4. Use image_url (direct file URL), NOT url (landing page).\n"
            "5. For each: supabase_upload_image -> fal_remove_bg -> supabase_upload_image "
            "-> gemini_check_image (>=6) -> printify_upload_image\n"
            "6. supabase_insert into designs with source_type='sourced'\n\n"
            "SECOND PASS — PAID AI GENERATION (only if sourced < 5 approved):\n"
            "7. Use fal_generate with model='flux-pro' (commercial license). "
            "ALWAYS pass width/height for the target product type (see SKILL.md dimensions table).\n"
            "8. gemini_check_image (>=6) -> printify_upload_image -> supabase_insert with "
            "source_type='fal' or 'gemini'\n"
            "   transparency_hook auto-upscales to print resolution.\n\n"
            "9. Update design_library.md\n\n"
            "Target: ≥80% sourced. Minimum: ≥60% sourced.\n"
            "Quality gate: score >= 6 (publish at 6, iterate later with real data)."
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
