# Secret Rotation Procedures

This document describes step-by-step rotation procedures for each secret used in the POD AI platform. Rotate secrets immediately if you suspect compromise, or on a quarterly schedule.

---

## 1. REDIS_PASSWORD

**Used by**: frontend, podclaw, mcp-server (session cache, rate limiting, queues)

**Steps**:
1. Generate new password: `openssl rand -hex 32`
2. Update `.env`: `REDIS_PASSWORD=<new_value>`
3. Rebuild Docker images: `docker compose build`
4. Restart Redis container: `docker compose restart redis`
5. Restart all dependent services: `docker compose restart frontend podclaw mcp-server`
6. Verify Redis connection in `/api/health` endpoint

---

## 2. PODCLAW_BRIDGE_AUTH_TOKEN

**Used by**: admin panel (client) → PodClaw bridge API (server)

**Steps**:
1. Generate new token: `openssl rand -hex 32`
2. Update `.env`: `PODCLAW_BRIDGE_AUTH_TOKEN=<new_value>`
3. Restart admin and podclaw services: `docker compose restart admin podclaw`
4. Verify: `curl -H "Authorization: Bearer <new_token>" http://localhost:8000/health`

---

## 3. MCP_JWT_SECRET

**Used by**: mcp-server (OAuth 2.1 token signing and validation)

**Steps**:
1. Generate new secret: `openssl rand -hex 32`
2. Update `.env`: `MCP_JWT_SECRET=<new_value>`
3. ⚠ **All existing MCP OAuth tokens will be invalidated** — warn connected clients
4. Restart mcp-server: `docker compose restart mcp-server`
5. Re-authorize all MCP client integrations

---

## 4. CRON_SECRET

**Used by**: frontend cron endpoints (`/api/cron/*`) — validated via Bearer token in Authorization header

**Steps**:
1. Generate new secret: `openssl rand -hex 32`
2. Update `.env`: `CRON_SECRET=<new_value>`
3. Update all cron job definitions (external schedulers, Supabase cron if any) with new token
4. Restart frontend: `docker compose restart frontend`
5. Verify cron endpoint: `curl -H "Authorization: Bearer <new_secret>" http://localhost:3000/api/cron/test`

---

## 5. REVALIDATION_SECRET

**Used by**: admin panel → frontend `/api/revalidate/theme` endpoint (ISR cache invalidation)

**Steps**:
1. Generate new secret: `openssl rand -hex 32`
2. Update `.env`: `REVALIDATION_SECRET=<new_value>`
3. Restart admin and frontend: `docker compose restart admin frontend`
4. Verify theme activation works in admin panel → Settings → Themes

---

## 6. SUPABASE_SERVICE_KEY

**Used by**: frontend (server-side queries), admin (DB access), podclaw (data operations)

> ⚠ This is a Supabase-managed key. Rotation must happen through the Supabase dashboard.

**Steps**:
1. Log in to [Supabase Dashboard](https://app.supabase.com) → Project → Settings → API
2. Click **Generate new service role key** (or use API key rotation)
3. Copy new key
4. Update `.env`: `SUPABASE_SERVICE_KEY=<new_value>`
5. Also update `SUPABASE_ANON_KEY` if rotated
6. Rebuild frontend and admin (key is used at build time for some routes):
   ```bash
   docker compose build frontend admin
   docker compose up -d frontend admin podclaw mcp-server
   ```
7. Verify database connectivity via `/api/health`

---

## 7. STRIPE_SECRET_KEY

**Used by**: frontend (checkout, webhooks), podclaw (refunds)

> ⚠ Stripe keys are managed via the Stripe Dashboard. Rolling keys does NOT invalidate existing webhooks but does invalidate ongoing API calls immediately.

**Steps**:
1. Log in to [Stripe Dashboard](https://dashboard.stripe.com) → Developers → API Keys
2. Create new **Restricted Key** (or rotate Standard Key)
3. Update `.env`: `STRIPE_SECRET_KEY=<new_key>`
4. Update `STRIPE_WEBHOOK_SECRET` if webhook signing secret is also rotated:
   - Dashboard → Developers → Webhooks → Select endpoint → Roll signing secret
5. Restart frontend: `docker compose restart frontend`
6. Verify payments: place a test order end-to-end

---

## 8. SESSION_SECRET (admin iron-session)

**Used by**: admin panel (encrypted cookie sessions)

> ⚠ Rotating this key **invalidates ALL active admin sessions**. All admin users will be logged out.

**Steps**:
1. Generate new secret: `openssl rand -hex 32`
2. Update `.env` and `admin/.env.local`: `SESSION_SECRET=<new_value>`
3. Restart admin: `docker compose restart admin`
4. Notify all admin users they will need to log in again

---

## 9. GRAFANA_ADMIN_PASSWORD

**Used by**: Grafana monitoring dashboard

**Steps**:
1. Generate new password: `openssl rand -hex 24`
2. Update `.env`: `GRAFANA_ADMIN_PASSWORD=<new_password>`
3. Update password in Grafana UI: Admin → Profile → Change Password (if service is running)
   OR restart container (will apply new password from env):
   ```bash
   docker compose restart grafana
   ```
4. Verify login at http://localhost:3003 (or your monitoring URL)

---

## Rotation Schedule

| Secret | Recommended Rotation | Last Rotated |
|--------|---------------------|--------------|
| REDIS_PASSWORD | Quarterly | — |
| PODCLAW_BRIDGE_AUTH_TOKEN | Quarterly | — |
| MCP_JWT_SECRET | Quarterly | — |
| CRON_SECRET | Quarterly | — |
| REVALIDATION_SECRET | Quarterly | — |
| SUPABASE_SERVICE_KEY | Annually or on compromise | — |
| STRIPE_SECRET_KEY | On compromise or team changes | — |
| SESSION_SECRET | On compromise or team changes | — |
| GRAFANA_ADMIN_PASSWORD | Quarterly | — |

---

## Emergency Rotation

If you suspect a secret is compromised:

1. Rotate the secret immediately following the steps above
2. Check Supabase logs for unauthorized DB access
3. Check Stripe Dashboard for unauthorized charges
4. Review `audit_log` table in Supabase for suspicious admin actions
5. Notify team members
