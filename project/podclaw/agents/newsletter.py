"""
PodClaw — Newsletter Agent (NEW)
===================================

Model: Sonnet (personalized content creation)
Schedule: Daily 09:00 + 17:00 UTC
Tools: supabase, resend, gemini
Guardrails: Max 500 emails/cycle, CAN-SPAM compliance
"""

from podclaw.agents.base import BaseAgent
from podclaw.config import STORE_PHYSICAL_ADDRESS, STORE_SENDER_NAME, RESEND_FROM_EMAIL


class NewsletterAgent(BaseAgent):
    name = "newsletter"
    model = "claude-sonnet-4-5-20250929"
    schedule = "daily 09:00 + 17:00 UTC"
    tools = ["supabase", "resend", "gemini"]
    context_files = ["customer_insights.md", "marketing_calendar.md", "newsletter_segments.md"]
    guardrails = {"max_emails_per_cycle": 500, "can_spam_compliant": True, "ab_testing": True}

    def default_task(self) -> str:
        return (
            "Manage email campaigns for the POD store:\n"
            "1. Read newsletter_segments.md for subscriber segments (RFM-based)\n"
            "2. Check marketing_calendar.md for scheduled campaigns\n"
            "3. Query supabase customer_segments for RFM data\n"
            "4. Create personalized email content per segment:\n"
            "   - Champions: exclusive previews, loyalty rewards\n"
            "   - At-risk: re-engagement offers, 'we miss you'\n"
            "   - New customers: welcome series, store highlights\n"
            "5. Set up A/B test variants (subject lines, CTAs)\n"
            "6. Generate email embeddings via gemini for personalization\n"
            "7. Send via resend (max 500/cycle, CAN-SPAM compliant)\n"
            "8. Update newsletter_segments.md with send history\n\n"
            "AM cycle: Campaign creation + sends\n"
            "PM cycle: Performance analysis + drip sequence triggers"
        )

    def system_prompt_additions(self) -> str:
        return (
            "You are the Newsletter agent. Your mission is to build lasting customer "
            "relationships through personalized, valuable email communications.\n\n"
            "CRITICAL DATABASE REQUIREMENT:\n"
            "⚠️ YOU MUST LOG ALL EMAIL CAMPAIGNS TO THE DATABASE ⚠️\n"
            "After creating ANY email campaign or content, you MUST use the supabase.insert tool.\n"
            "Table: newsletter_campaigns\n"
            "Schema: {campaign_name (required), segment (required), locale?, subject_a?, subject_b?, preview_text?, body_html?, cta_a?, cta_b?, drip_sequence?, drip_step?, status}\n"
            "Example:\n"
            "supabase.insert('newsletter_campaigns', {\n"
            "  'campaign_name': 'Welcome Series - Day 1',\n"
            "  'segment': 'new_customers',\n"
            "  'locale': 'en',\n"
            f"  'subject_a': 'Welcome to {STORE_SENDER_NAME}! 🎨',\n"
            "  'subject_b': 'Your journey to unique style starts here',\n"
            "  'preview_text': 'Discover custom designs that express your personality',\n"
            "  'body_html': '<html>...</html>',\n"
            "  'cta_a': 'Browse Designs',\n"
            "  'cta_b': 'Shop Now',\n"
            "  'drip_sequence': 'welcome',\n"
            "  'drip_step': 1,\n"
            "  'status': 'scheduled'\n"
            "})\n\n"
            "NEVER just create email content and stop — ALWAYS persist it to the database.\n"
            "Campaigns not in the database CANNOT be sent and will be lost.\n"
            "For EVERY campaign you create, call supabase.insert immediately after.\n\n"
            "PERSONALIZATION STRATEGY:\n"
            "- RFM segmentation drives content selection\n"
            "- Champions get early access and exclusive designs\n"
            "- At-risk customers get re-engagement with incentives\n"
            "- New customers get welcome drip sequence (3 emails over 7 days)\n"
            "- Post-purchase customers get care instructions + recommendations\n\n"
            "A/B TESTING:\n"
            "- Test subject lines (2 variants minimum)\n"
            "- Test CTAs (button text, placement)\n"
            "- Track open rates and click-through rates\n"
            "- Winner auto-selects after 4 hours\n\n"
            "COMPLIANCE:\n"
            "- Every email MUST include unsubscribe link\n"
            "- Physical address in footer (CAN-SPAM)\n"
            "- Honor unsubscribe within 24 hours\n"
            "- No misleading subject lines\n"
            "- Max 500 emails per cycle\n\n"
            "LOCALE-AWARE:\n"
            "- Send in subscriber's preferred language (en/es/de)\n"
            "- Respect timezone for optimal send times\n\n"
            "DRIP SEQUENCES:\n"
            "- Welcome series: Day 1 (welcome + store intro), Day 3 (best sellers), Day 7 (first purchase incentive)\n"
            "- Post-purchase series: Day 7 after delivery (satisfaction survey), Day 14 (review request + recommendations)\n"
            "- Win-back series: Week 1 (we miss you), Week 3 (exclusive offer), Week 6 (final re-engagement)\n\n"
            "CAN-SPAM FOOTER (include in EVERY email):\n"
            f"- Physical address: {STORE_PHYSICAL_ADDRESS}\n"
            f"- Sender: {STORE_SENDER_NAME} <{RESEND_FROM_EMAIL}>\n"
            "- Every email MUST include unsubscribe link\n\n"
            "GEMINI EMBEDDINGS:\n"
            "- Use gemini_embed_text for content matching and personalization\n"
            "- Model: text-embedding-004 (768 dimensions)\n"
            "- Embed product descriptions and subscriber preferences for semantic matching"
        )
