# Secret Rotation Procedures

## Overview

All secrets must be rotated periodically (recommended: every 90 days) or immediately if compromised.

## Secrets Inventory

| Secret | Services Affected | Rotation Procedure | Expected Downtime |
|---|---|---|---|
| SUPABASE_SERVICE_KEY | frontend, admin, podclaw, mcp-server | Regenerate in Supabase Dashboard → Settings → API. Update .env. Restart all 4 services. | ~30s (rolling restart) |
| STRIPE_SECRET_KEY | frontend, podclaw | Rotate in Stripe Dashboard → Developers → API keys. Stripe supports key rolling (old key remains valid for 24h). Update .env. Restart frontend + podclaw. | 0 (if using key rolling) |
| STRIPE_WEBHOOK_SECRET | frontend | Re-create webhook endpoint in Stripe Dashboard. Update .env. Restart frontend. | ~10s |
| REDIS_PASSWORD | frontend, podclaw, mcp-server | Update .env. Restart redis first, then frontend, podclaw, mcp-server in sequence. | ~30s |
| MCP_JWT_SECRET | mcp-server, frontend | Update .env. Restart mcp-server then frontend. All active MCP sessions will be invalidated. | ~15s + session re-auth |
| PODCLAW_BRIDGE_AUTH_TOKEN | podclaw | Update .env. Restart podclaw. All services calling bridge must update their token. | ~10s |
| GRAFANA_ADMIN_PASSWORD | grafana | Update .env. Restart grafana. Existing sessions remain valid until expiry. | 0 |
| FAL_KEY | podclaw | Regenerate at fal.ai dashboard. Update .env. Restart podclaw. | ~10s |
| GEMINI_API_KEY | frontend | Regenerate at Google AI Studio. Update .env. Restart frontend. | ~10s |
| RESEND_API_KEY | frontend, podclaw | Regenerate at Resend dashboard. Update .env. Restart affected services. | ~15s |
| PRINTFUL_API_TOKEN | frontend, podclaw | Regenerate at Printful dashboard. Update .env. Restart affected services. | ~15s |

## Rotation Steps (General)

1. Generate new secret value
2. Update `.env` on the production host
3. Run `./start.sh` to restart affected services (phased startup ensures correct ordering)
4. Verify service health: `./start.sh --status`
5. Test critical paths (login, checkout, chat) after rotation

## Emergency Rotation

If a secret is compromised:
1. Immediately rotate the compromised secret
2. Review access logs for unauthorized usage
3. Rotate any adjacent secrets that share access patterns
4. Document the incident
