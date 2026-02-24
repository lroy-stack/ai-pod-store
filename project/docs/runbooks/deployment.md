# Deployment Runbook

> **Last Updated:** 2026-02-24
> **Owner:** DevOps Team
> **Status:** Production

## Overview

This runbook covers the deployment process for the POD-AI platform, a Print-on-Demand ecommerce platform with AI-powered store management.

## Architecture

The platform consists of 8 Docker services orchestrated via `docker-compose.yml`:

1. **frontend** — Next.js 16 storefront (port 3000)
2. **admin** — Next.js 16 admin panel (port 3001, basePath `/panel`)
3. **podclaw** — Python FastAPI Bridge API (port 8000)
4. **mcp-server** — TypeScript MCP OAuth server (port 8002)
5. **rembg** — Background removal service (port 8090)
6. **redis** — Cache layer (port 6379)
7. **crawl4ai** — Web scraping service
8. **caddy** — Reverse proxy with automatic HTTPS

## Prerequisites

### Required Environment Variables

#### Frontend (.env.local)
```bash
# Supabase (cloud-hosted PostgreSQL)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Printify
PRINTIFY_API_TOKEN=<jwt_token>
PRINTIFY_SHOP_ID=<shop_id>
PRINTIFY_WEBHOOK_SECRET=<webhook_secret>

# AI Services
GEMINI_API_KEY=<google_ai_key>
FAL_KEY=<fal_ai_key>

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@podai.com

# Redis (optional, graceful fallback)
REDIS_URL=redis://redis:6379

# Security
CRON_SECRET=<random_string_32_chars>

# Feature Flags
NEXT_PUBLIC_ENABLE_VOICE_INPUT=true
NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD=true
NEXT_PUBLIC_ENABLE_PWA=true

# Domain
NEXT_PUBLIC_BASE_URL=https://podai.com
```

#### Admin (.env.local)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>

# Admin Auth (iron-session, NOT Supabase Auth)
ADMIN_SESSION_SECRET=<random_string_64_chars>

# Bridge API
NEXT_PUBLIC_BRIDGE_API_URL=http://podclaw:8000
PODCLAW_BRIDGE_AUTH_TOKEN=<bearer_token>

# Redis
REDIS_URL=redis://redis:6379
```

#### PodClaw (.env)
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Bridge Auth
PODCLAW_BRIDGE_AUTH_TOKEN=<same_as_admin>

# Redis
REDIS_URL=redis://redis:6379

# Printify
PRINTIFY_API_TOKEN=<jwt_token>
PRINTIFY_SHOP_ID=<shop_id>

# AI Services
GEMINI_API_KEY=<google_ai_key>
FAL_KEY=<fal_ai_key>

# Stripe
STRIPE_SECRET_KEY=sk_live_...

# Email
RESEND_API_KEY=re_...
```

#### MCP Server (.env)
```bash
# OAuth
OAUTH_CLIENT_ID=<client_id>
OAUTH_CLIENT_SECRET=<client_secret>
OAUTH_REDIRECT_URI=https://podai.com/oauth/callback

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>

# Stripe
STRIPE_SECRET_KEY=sk_live_...

# Redis
REDIS_URL=redis://redis:6379
```

### External Services

1. **Supabase Cloud** — PostgreSQL 16 + pgvector + Realtime
   - URL: https://your-project.supabase.co
   - 98 migrations applied
   - RLS enabled on all tables
   - Connection pooler (pgBouncer) configured

2. **Stripe** — Payment processing
   - Webhook endpoint: `https://podai.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `payment_intent.*`, `charge.refunded`

3. **Printify** — POD fulfillment
   - Webhook endpoint: `https://podai.com/api/webhooks/printify`
   - HMAC signature verification required

4. **Resend** — Transactional email
   - Domain: podai.com
   - DKIM/SPF configured

5. **fal.ai** — Design generation (Flux models)
6. **Google Gemini** — Text embeddings (768-dim)

## Deployment Steps

### 1. Pre-Deployment Checklist

- [ ] All environment variables configured in `.env.local` files
- [ ] Database migrations applied: `cd project && supabase db push`
- [ ] Secrets rotated if needed (admin session secret, cron secret, bridge auth token)
- [ ] External webhooks configured (Stripe, Printify)
- [ ] DNS A/AAAA records point to deployment server
- [ ] SSL certificates valid (Caddy auto-renews Let's Encrypt)

### 2. Database Migration

```bash
cd /path/to/project
supabase db push --include-all
```

**Important:**
- ONE SQL statement per migration file (CLI uses prepared statements)
- Always use `IF NOT EXISTS` / `IF EXISTS` guards
- Never delete applied migration files
- Failed migrations: delete file, create new one

### 3. Build and Start Services

```bash
# From project root
./start.sh
```

This script performs 3-phase startup:
1. **Infrastructure** — redis, caddy
2. **AI Services** — rembg, crawl4ai
3. **Application** — frontend, admin, podclaw, mcp-server

Services are orchestrated across 3 Docker networks:
- `proxy` — Caddy <-> frontend/admin
- `data` — All services <-> redis
- `ai-services` — frontend/podclaw <-> rembg/crawl4ai

### 4. Verify Deployment

```bash
# Health checks
curl https://podai.com/api/health
curl https://podai.com/panel/api/health
curl http://localhost:8000/status  # PodClaw Bridge

# Database connection
curl https://podai.com/api/health | jq '.supabase.status'

# Redis connection
curl https://podai.com/api/health | jq '.redis.status'

# Frontend pages
curl -I https://podai.com/en/
curl -I https://podai.com/en/shop
curl -I https://podai.com/panel/login

# Admin API (requires auth)
curl -H "Cookie: admin-session=..." https://podai.com/panel/api/products
```

### 5. Post-Deployment Tasks

1. **Verify cron jobs** — Check PodClaw scheduler status:
   ```bash
   curl http://localhost:8000/schedule
   ```

2. **Test webhooks** — Send test events from Stripe/Printify dashboards

3. **Check logs** — Monitor for errors:
   ```bash
   docker compose logs -f frontend
   docker compose logs -f admin
   docker compose logs -f podclaw
   ```

4. **Performance baseline** — Capture initial metrics:
   ```bash
   curl https://podai.com/api/health | jq '.supabase.latency'
   ```

## Rollback Procedure

### Quick Rollback (Docker)

```bash
# Stop current deployment
docker compose down

# Restore previous image tags
git checkout <previous-commit>

# Restart
./start.sh
```

### Database Rollback

**⚠️ WARNING:** Supabase Cloud does NOT support automatic rollback. Manual intervention required.

1. Identify failed migration timestamp
2. Create compensating migration to undo changes
3. Apply with `supabase db push`

**Never use `supabase db reset` in production** — it drops all data.

## Monitoring

### Key Metrics

1. **Frontend Response Time** — Target: <500ms p95
2. **Database Latency** — Target: <100ms (Supabase Cloud)
3. **Redis Hit Rate** — Target: >80%
4. **PodClaw Agent Costs** — Budget limits in `podclaw/config.py`
5. **Error Rate** — Target: <1% of requests

### Log Aggregation

All services use structured logging (JSON):
- Frontend/Admin: `console.log()` → JSON format
- PodClaw: `structlog` → JSON format
- MCP: `winston` → JSON format

Recommended: Ship logs to observability platform (Datadog, Honeycomb, etc.)

### Alerts

Configure alerts for:
- Database connection failures (Supabase status != 'connected')
- High error rate (>5% 5xx responses)
- Webhook failures (Stripe, Printify signature verification)
- PodClaw cost overruns (daily budget exceeded)
- Redis disconnection (degraded mode but functional)

## Troubleshooting

### Frontend won't start

1. Check Supabase connection: `curl $SUPABASE_URL/rest/v1/`
2. Verify env vars: `docker compose exec frontend env | grep SUPABASE`
3. Check build logs: `docker compose logs frontend`

### Admin authentication fails

1. Admin uses **custom bcrypt auth**, NOT Supabase Auth
2. Check `users` table has role='admin' user
3. Verify iron-session secret is 32+ chars
4. Test login: `curl -X POST https://podai.com/panel/api/auth/login -d '{"email":"admin@podstore.local","password":"..."}'`

### Database migration fails

1. Check applied migrations: `supabase db remote list`
2. View migration history table: `SELECT * FROM supabase_migrations.schema_migrations`
3. If migration stuck: DELETE unapplied .sql file, create new one
4. Use `--include-all` flag if remote has migrations not in local

### PodClaw agents not running

1. Check Bridge API: `curl http://localhost:8000/status`
2. Verify Redis connection: `curl http://localhost:8000/status | jq '.redis'`
3. Check agent budgets: `curl http://localhost:8000/costs`
4. View agent logs: `docker compose logs podclaw | grep agent_name`

### Webhook failures

**Stripe:**
- Verify signature: Stripe dashboard → Developers → Webhooks → View attempts
- Check endpoint: `https://podai.com/api/webhooks/stripe`
- Test mode vs Live mode mismatch

**Printify:**
- HMAC signature must match
- Check secret: `PRINTIFY_WEBHOOK_SECRET` in frontend .env
- Endpoint: `https://podai.com/api/webhooks/printify`

## Performance Optimization

### Database

1. **Connection pooling** — Supabase pgBouncer (transaction mode)
2. **Indexes** — 11 compound indexes for frequent queries
3. **Partitioning** — `agent_events`, `messages`, `audit_log` (monthly partitions)
4. **Vector search** — HNSW index on `documents.embedding`

### Caching

1. **Redis strategy** — Products (1h), Categories (24h), User sessions (7d)
2. **Graceful fallback** — App works without Redis (slower)
3. **Cache invalidation** — On product update, clear product + category cache

### CDN

1. **Static assets** — `/_next/static/*` cached 1 year
2. **Images** — Next.js Image Optimization (on-demand)
3. **API routes** — NOT cached (dynamic)

### Frontend

1. **Code splitting** — Dynamic imports for chat panel, admin routes
2. **Prefetching** — Next.js Link prefetch on hover
3. **Memoization** — React.memo on expensive components (ChatMessage, ProductCard)

## Security

### Authentication

- **Frontend:** Supabase Auth (JWT, httpOnly cookies)
- **Admin:** iron-session (signed cookies, bcrypt passwords)
- **Bridge API:** Bearer token (`PODCLAW_BRIDGE_AUTH_TOKEN`)

### Authorization

- **RLS policies** — All 98 tables have Row Level Security
- **Admin routes** — `withAuth()` middleware on all `/panel/api/*`
- **Webhooks** — HMAC/signature verification (Stripe, Printify)

### Secrets Management

**Never commit:**
- `.env.local` files
- API keys, tokens
- Session secrets
- Webhook secrets

**Rotate quarterly:**
- Admin session secret
- Cron secret
- Bridge auth token

## Contact

- **On-call:** DevOps team (PagerDuty)
- **Database issues:** Supabase Support (support@supabase.io)
- **Payment issues:** Stripe Support
- **Fulfillment issues:** Printify Support

---

## Changelog

- **2026-02-24** — Initial deployment runbook created
