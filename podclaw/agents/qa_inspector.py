"""
PodClaw — QA Inspector Agent
================================

Model: Haiku (cost-effective for verification tasks)
Schedule: Daily 07:45 UTC (after Designer)
Tools: supabase, gemini, printify (read-only verification)
Guardrails: Max 20 gemini_check_image, budget $0.15/session
"""

from podclaw.agents.base import BaseAgent


class QAInspectorAgent(BaseAgent):
    name = "qa_inspector"
    model = "claude-haiku-4-5-20251001"
    schedule = "daily 07:45 UTC"
    tools = ["supabase", "gemini", "printify"]
    context_files = ["design_library.md", "qa_report.md", "last_session_feedback.md", "product_scorecard.md"]
    guardrails = {"max_gemini_checks": 20, "budget_usd": 0.15}

    def default_task(self) -> str:
        return (
            "Verify quality and integrity of today's designs and products.\n"
            "You MUST call tools — do NOT answer from memory.\n\n"
            "1. Check all designs: image_url, bg_removed_url, quality_score >= 7\n"
            "2. Visual BG removal check: 5-10 designs via gemini_check_image\n"
            "3. Product integrity: provider_product_id, images, positive margins, EUR currency\n"
            "4. Variant check: all active products have >=1 row in product_variants\n"
            "5. Translation check: all active products have non-empty translations\n"
            "6. Sync check: Printify count vs Supabase count\n"
            "7. Catalog validation against PRICING-MODEL.md\n\n"
            "CONVERSION ANALYSIS (from product_scorecard.md):\n"
            "8. Read product_scorecard.md for performance data\n"
            "9. Flag products with HIGH views but LOW conversion for design review\n"
            "   (>100 views, <1% conversion = likely design/quality issue)\n"
            "10. Cross-reference flagged products with quality_score — low score + low conversion = priority fix\n\n"
            "Write full report to qa_report.md with date, counts, issues, and action items."
        )

    def system_prompt_additions(self) -> str:
        return (
            "You are the QA Inspector agent. Your mission is to verify quality and "
            "integrity of all designs and products in the catalog.\n\n"
            "VERIFICATION CHECKS:\n"
            "- Design integrity: image URLs, BG removal quality, quality scores\n"
            "- Product integrity: Printify sync, images, margins, currency\n"
            "- Variant completeness: every product needs >=1 variant\n"
            "- Translation completeness: en/es/de for all products\n"
            "- Catalog compliance: products must exist in EU catalog\n\n"
            "CONVERSION CORRELATION:\n"
            "- Read product_scorecard.md for Bayesian conversion estimates\n"
            "- Products with high views + low conversion may have design quality issues\n"
            "- Cross-reference with quality_score to identify priority fixes\n"
            "- Flag for designer/cataloger attention in qa_report.md\n\n"
            "GUARDRAILS:\n"
            "- Max 20 gemini_check_image calls per cycle\n"
            "- Read-only for products — only update designs.quality_score if re-verified\n"
            "- Budget: $0.15 max per run\n"
            "- All monetary values in EUR"
        )
