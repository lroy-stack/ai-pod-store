# HEARTBEAT.md — Proactive Task Checklist

# PodClaw reads this every 30 minutes during active hours (05:00-23:00 UTC).
# Keep empty (or comments-only) to skip heartbeat API calls entirely.
# Only items below non-comment lines trigger a Haiku LLM call.

## Health Checks
- Verify Supabase connectivity and response time
- Check Printful API availability
- Monitor Redis connectivity
- Review agent error rates (flag if >=3 errors in 24h for any agent)

## KPI Monitors
- Flag if daily revenue drops >30% vs 7-day average
- Flag if any product margin falls below 35%
- Flag if unresolved support tickets exceed 5
- Flag if Stripe webhook delivery failures detected

## Seasonal Awareness
# Add date-prefixed items for upcoming campaigns or deadlines:
# - [YYYY-MM-DD] Description of upcoming event or deadline

## CEO Tasks
# CEO adds manual items here via admin panel or WhatsApp.
# PodClaw can mark items complete but CANNOT delete CEO-added items.
# Format for completed items: - ~~task description~~ (completed YYYY-MM-DD)
