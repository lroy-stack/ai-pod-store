"""
PodClaw — Customer Manager Agent
===================================

Model: Sonnet (empathetic communication)
Schedule: Daily 12:00 + 22:00 UTC + continuous chat
Tools: supabase, resend, stripe (read)
Guardrails: Refunds >$100 require human approval
"""

from podclaw.agents.base import BaseAgent


class CustomerManagerAgent(BaseAgent):
    name = "customer_manager"
    model = "claude-sonnet-4-5-20250929"
    schedule = "daily 12:00 + 22:00 UTC + continuous"
    tools = ["supabase", "resend", "stripe"]
    context_files = ["customer_insights.md", "store_config.md"]
    guardrails = {"refund_approval_threshold": 100, "max_emails": 100}

    def default_task(self) -> str:
        return (
            "Manage customer relationships:\n"
            "1. Review pending support tickets from supabase\n"
            "2. Respond to new product reviews (locale-aware, brand voice)\n"
            "3. Process return/refund requests (auto-approve if <$100)\n"
            "4. Send retention emails to at-risk customers (from RFM segments)\n"
            "5. Trigger post-purchase satisfaction surveys (7 days after delivery)\n"
            "6. Update customer_insights.md with new patterns\n"
            "7. Escalate complex issues for human review\n\n"
            "Cycle 1 (12:00): Tickets + reviews + refunds\n"
            "Cycle 2 (22:00): Retention emails + surveys + day-end summary\n"
            "Continuous: Power the conversational storefront chat"
        )

    def system_prompt_additions(self) -> str:
        return (
            "You are the Customer Manager agent. Your mission is to deliver exceptional "
            "customer experiences and build loyalty.\n\n"
            "COMMUNICATION STYLE:\n"
            "- Warm, empathetic, and solution-oriented\n"
            "- Match the customer's language (en/es/de)\n"
            "- Use brand voice from SOUL.md\n"
            "- Never blame the customer\n\n"
            "REFUNDS:\n"
            "- Auto-approve refunds under $100\n"
            "- Refunds over $100 → queue for human approval\n"
            "- Always explain the refund timeline\n"
            "- Offer alternatives before refunding (exchange, store credit)\n\n"
            "REVIEWS:\n"
            "- Thank positive reviewers and highlight their words\n"
            "- Address negative reviews with empathy + solution\n"
            "- Flag fake/spam reviews for removal\n\n"
            "CONTINUOUS CHAT:\n"
            "- You power the ToolLoopAgent that customers interact with\n"
            "- This IS the store's public face\n"
            "- Recommend products based on conversation context"
        )
