"""
PodClaw — Brand Manager Agent
================================

Model: Sonnet (branding decisions require reasoning)
Schedule: Weekly Monday 08:00 UTC
Tools: printify (product updates, image uploads), supabase (brand config, products)
Guardrails: Max 50 product updates/cycle
"""

from podclaw.agents.base import BaseAgent


class BrandManagerAgent(BaseAgent):
    name = "brand_manager"
    model = "claude-sonnet-4-5-20250929"
    schedule = "weekly Monday 08:00 UTC"
    tools = ["supabase", "printify"]
    context_files = ["brand_config.md", "store_config.md", "product_scorecard.md"]
    guardrails = {"max_product_updates": 50}

    def default_task(self) -> str:
        return (
            "Audit and enforce brand consistency across the product catalog:\n"
            "1. Read brand_config table for active branding settings\n"
            "2. List all published products via printify_list_products\n"
            "3. For each apparel product (t-shirts, hoodies, etc.):\n"
            "   a. Check if neck label is configured in print_areas\n"
            "   b. If missing and brand has neck_label_image_id, update product\n"
            "4. Verify packaging insert settings are enabled in store config\n"
            "5. Check gift message templates are active\n"
            "6. Report: products_audited, labels_applied, issues_found\n"
            "7. Update brand_config.md with audit results\n\n"
            "QUALITY-SALES CORRELATION:\n"
            "8. Read product_scorecard.md for conversion data\n"
            "9. Cross-reference: products with low conversion + missing neck labels → priority fix\n"
            "10. Flag products where brand inconsistency may be hurting sales"
        )

    def system_prompt_additions(self) -> str:
        return (
            "You are the Brand Manager agent. Your mission is to maintain "
            "consistent brand identity across all products and customer touchpoints.\n\n"
            "NECK LABELS:\n"
            "- Apparel products (t-shirts, hoodies, tank tops) should have a custom neck label\n"
            "- Neck label uses position: 'neck' in Printify print_areas\n"
            "- Cost: +$0.44/unit — already factored into pricing model\n"
            "- Only apply to blueprints that support the 'neck' placeholder position\n\n"
            "PACKAGING:\n"
            "- Packaging inserts add brand story and care instructions\n"
            "- Cost: +$0.15/unit for standard insert\n"
            "- Gift messages are free and configured per-order at checkout\n\n"
            "BRAND STANDARDS:\n"
            "- Read brand_config.md for current color palette and typography\n"
            "- All branding elements must be consistent across products\n"
            "- Log every branding change for audit trail\n\n"
            "GUARDRAILS:\n"
            "- Max 50 product updates per cycle\n"
            "- Never remove existing print areas (front/back designs)\n"
            "- Only add or update neck label placeholder"
        )
