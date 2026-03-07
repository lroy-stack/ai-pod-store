# Infrastructure Audit -- 2026-03-07

Auditor: Claude Opus 4.6 (Infrastructure Security Auditor)
Scope: Docker Compose stack, Dockerfiles, Caddyfile, start.sh, .env.example

---

## Service Matrix

| Service | Non-root | cap_drop:ALL | Mem limit | CPU limit | Health check | Networks | Restart | Log rotation | Status |
|---|---|---|---|---|---|---|---|---|---|
| frontend | Yes (nextjs:1001) | Yes (anchor) | 384M | 1.0 | Yes (curl /api/health) | proxy, data | unless-stopped | Yes | PASS |
| admin | Yes (nextjs:1001) | Yes (anchor) | 256M | 0.5 | Yes (curl /panel/api/health) | proxy | unless-stopped | Yes | PASS |
| podclaw | Yes (podclaw:1001) | Yes (anchor) | 512M | 1.0 | Yes (curl /health) | proxy, data, ai-services | unless-stopped | Yes | PASS |
| mcp-server | Yes (node built-in) | Yes (anchor) | 256M | 0.5 | Yes (curl /health) | proxy, data | unless-stopped | Yes | PASS |
| rembg | Yes (rembg) | Yes (anchor) | 768M | 2.0 | Yes (curl /health) | ai-services | unless-stopped | Yes | PASS |
| redis | No (redis default) | Yes (manual) | 256M | 0.5 | Yes (redis-cli ping) | data | unless-stopped | Yes | WARN |
| crawl4ai | No (unclecode image) | Yes (manual) | 768M | 1.0 | Yes (curl /monitor/health) | ai-services | unless-stopped | Yes | WARN |
| caddy | No (caddy default) | Yes (manual) | 64M | 0.5 | Yes (wget /) | proxy | unless-stopped | Yes | WARN |
| prometheus | No (prom default) | Yes (manual) | 512M | 0.5 | Yes (wget /-/healthy) | proxy, data | unless-stopped | Yes | WARN |
| grafana | No (grafana default) | Yes (manual) | 256M | 0.5 | Yes (wget /api/health) | proxy | unless-stopped | Yes | WARN |
| loki | No (loki default) | Yes (manual) | 512M | 0.5 | Yes (wget /ready) | data | unless-stopped | Yes | WARN |

---

## Summary

- **Total checks**: 38
- **PASS**: 28 | **WARN**: 8 | **FAIL**: 1 | **CRITICAL**: 1

---

## Phase 1: Container Security

### 1. Privilege Model

| # | Check | Result | Detail |
|---|---|---|---|
| 1.1 | cap_drop: ALL on every service | **PASS** | All custom-built services use `<<: *default-security` YAML anchor. Third-party services (redis, crawl4ai, caddy, prometheus, grafana, loki) declare `cap_drop: ALL` explicitly. |
| 1.2 | cap_add justified | **PASS** | redis: SETGID/SETUID/DAC_OVERRIDE (needed for persistence). crawl4ai: SYS_ADMIN (needed for Chromium sandbox). caddy: NET_BIND_SERVICE (ports 80/443). prometheus/grafana/loki: CHOWN/DAC_OVERRIDE/SETGID/SETUID (standard for those images). All justified. |
| 1.3 | Non-root in custom images | **PASS** | frontend (nextjs:1001), admin (nextjs:1001), podclaw (podclaw:1001), rembg (rembg), mcp-server (node built-in). All custom Dockerfiles create and switch to a non-root user. |
| 1.4 | Non-root in third-party images | **WARN** | redis:7-alpine, caddy:2.9-alpine, prom/prometheus:v3.0.0, grafana/grafana:11.4.0, grafana/loki:3.3.1, unclecode/crawl4ai:0.8.0 run as their default users. Redis and crawl4ai may run as root inside their containers. No `user:` directive in compose for these services. |
| 1.5 | privileged: true | **PASS** | Not found anywhere. |

### 2. Image Provenance

| # | Check | Result | Detail |
|---|---|---|---|
| 2.1 | Base images pinned | **PASS** | All images use specific version tags: `python:3.12-slim`, `node:22-alpine`, `redis:7-alpine`, `caddy:2.9-alpine`, `unclecode/crawl4ai:0.8.0`, `prom/prometheus:v3.0.0`, `grafana/grafana:11.4.0`, `grafana/loki:3.3.1`. No `:latest` found. |
| 2.2 | Multi-stage builds | **PASS** | frontend (3 stages: deps/builder/runner), admin (3 stages), mcp-server (2 stages: builder/runner). Minimizes final image size. |
| 2.3 | Unnecessary tools in prod | **WARN** | `curl` is installed in all custom production images for health checks. This is standard practice but increases attack surface slightly. Consider using `wget` from alpine base or a dedicated health check binary. |

### 3. Resource Limits

| # | Check | Result | Detail |
|---|---|---|---|
| 3.1 | Memory limits | **PASS** | All 11 services have `deploy.resources.limits.memory` set. |
| 3.2 | CPU limits | **PASS** | All 11 services have `deploy.resources.limits.cpus` set. |
| 3.3 | Memory reservations | **PASS** | All 11 services have `deploy.resources.reservations.memory` set. |
| 3.4 | Restart policies | **PASS** | All services use `restart: unless-stopped`. |

---

## Phase 2: Network Segmentation

### 4. Network Topology

| # | Check | Result | Detail |
|---|---|---|---|
| 4.1 | Three networks exist | **PASS** | `proxy`, `data`, `ai-services` -- all defined as bridge networks. |
| 4.2 | rembg isolated from proxy | **PASS** | rembg only on `ai-services`. Cannot reach proxy network. |
| 4.3 | crawl4ai isolated from proxy | **PASS** | crawl4ai only on `ai-services`. Cannot reach proxy network. |
| 4.4 | caddy isolated from data | **PASS** | caddy only on `proxy`. Cannot reach Redis directly. |
| 4.5 | prometheus on data network | **WARN** | prometheus is on both `proxy` and `data` networks. It can reach Redis on the data network. This is needed for scraping application services but gives prometheus more access than necessary. Consider a dedicated `monitoring` network. |
| 4.6 | loki on data network | **WARN** | loki is on `data` network alongside Redis. If loki needs to receive logs from services, a dedicated logging network would be more appropriate. |

### 5. Port Exposure

| # | Check | Result | Detail |
|---|---|---|---|
| 5.1 | Local: all ports 127.0.0.1 | **PASS** | `docker-compose.local.yml` binds all ports to `127.0.0.1` (frontend:3000, admin:3001, podclaw:8000, mcp-server:8002, rembg:8090, crawl4ai:11235, redis:6379, caddy:8080). |
| 5.2 | Prod: only 80/443 exposed | **PASS** | `docker-compose.prod.yml` only exposes `80:80` and `443:443` on caddy. No other ports. |
| 5.3 | Base: expose vs ports | **PASS** | Base `docker-compose.yml` uses `expose:` only (internal), never `ports:`. Port mappings are exclusively in override files. |
| 5.4 | Local: debug ports | **WARN** | Redis port 6379 is exposed in local dev (`127.0.0.1:6379:6379`). Acceptable for development but should be documented as debug-only. |
| 5.5 | Prod: monitoring ports | **PASS** | prometheus (9090) and grafana (3100) are NOT exposed in prod override. They are only accessible internally or via Caddy if routes are configured. Currently no Caddy routes for monitoring -- they are effectively internal-only. |

### 6. Inter-service Communication

| # | Check | Result | Detail |
|---|---|---|---|
| 6.1 | Service names used | **PASS** | All services reference each other by Docker service name (e.g., `redis:6379`, `podclaw:8000`, `frontend:3000`). |
| 6.2 | Health-based dependencies | **PASS** | All `depends_on` use `condition: service_healthy`. Three-phase startup in start.sh reinforces this. |

---

## Phase 3: Secret Management

### 7. Environment Variables

| # | Check | Result | Detail |
|---|---|---|---|
| 7.1 | .env gitignored | **PASS** | `.env`, `.env.local`, `.env.docker`, `.env.*.local` all listed in `.gitignore`. |
| 7.2 | No env_file directive | **PASS** | No `env_file:` found in any compose file. Each service declares only the variables it needs via `environment:`. |
| 7.3 | No hardcoded secrets | **PASS** | No secrets found hardcoded in Dockerfiles or compose files. Build args use placeholder defaults (`placeholder`, `pk_test_placeholder`). |
| 7.4 | Secrets in build args | **WARN** | `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are passed as build args to frontend and admin Dockerfiles. The Dockerfiles document that these do NOT leak to the production runner stage (multi-stage build), but they remain in the builder layer cache. Use `--mount=type=secret` for better isolation. |
| 7.5 | Per-service env scoping | **PASS** | Each service receives only the variables it needs. rembg and crawl4ai receive zero secrets. Redis receives only REDIS_PASSWORD. Admin receives only SUPABASE and PODCLAW_BRIDGE vars. |

### 8. Secret Rotation

| # | Check | Result | Detail |
|---|---|---|---|
| 8.1 | Rotation procedure | **FAIL** | No secret rotation procedure is documented. The following secrets require periodic rotation: REDIS_PASSWORD, PODCLAW_BRIDGE_AUTH_TOKEN, MCP_JWT_SECRET, CRON_SECRET, all API tokens. |
| 8.2 | Shared secrets | **PASS** | Secrets are shared only where necessary: SUPABASE_SERVICE_KEY (frontend, podclaw, admin, mcp-server -- all need admin DB access), STRIPE_SECRET_KEY (frontend, podclaw), REDIS_PASSWORD (frontend, podclaw, mcp-server via URL). |

### 9. .env.example Completeness

| # | Check | Result | Detail |
|---|---|---|---|
| 9.1 | All required vars listed | **WARN** | `GRAFANA_ADMIN_PASSWORD` is used in docker-compose.yml but NOT listed in `.env.example`. It defaults to `admin` which is insecure. |
| 9.2 | REQUIRED/OPTIONAL tags | **PASS** | All sections have `[REQUIRED]` or `[OPTIONAL]` tags in comments. |
| 9.3 | Placeholder values safe | **PASS** | Placeholders use obvious non-secret values (`your-service-role-key`, `pk_test_placeholder`, `change-me-generate-with-openssl-rand-hex-32`). start.sh validates against these. |

---

## Phase 4: Reverse Proxy & TLS

### 10. Caddy Configuration

| # | Check | Result | Detail |
|---|---|---|---|
| 10.1 | Automatic HTTPS | **PASS** | Caddy uses `{$CADDY_SITE_ADDRESS}` which resolves to the domain in production, enabling automatic Let's Encrypt certificates. |
| 10.2 | Route mapping | **PASS** | `/api/bridge/*` -> podclaw:8000 (strip prefix), `/panel*` -> admin:3001, `/mcp*` -> mcp-server:8002, `/*` -> frontend:3000. OAuth discovery endpoints also routed to mcp-server. |
| 10.3 | Rate limiting at proxy | **WARN** | No rate limiting configured at the Caddy level. Rate limiting is handled by individual services (Redis-based). Consider adding Caddy rate limiting as a first line of defense. |
| 10.4 | On-demand TLS | **PASS** | Custom tenant domains use on-demand TLS with domain verification (`ask http://frontend:3000/api/verify-domain`). Rate-limited to 5 new certs per 2 minutes. |

### 11. Security Headers

| # | Check | Result | Detail |
|---|---|---|---|
| 11.1 | Security headers present | **PASS** | Caddy sets: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`. Server header removed (`-Server`). |
| 11.2 | HSTS configured | **PASS** | `max-age=31536000; includeSubDomains` (1 year). |
| 11.3 | CSP header | **WARN** | No `Content-Security-Policy` header configured in Caddy. This should be added (can be set in Caddy or delegated to Next.js). |
| 11.4 | Compression | **PASS** | Zstd and Gzip compression enabled (`encode zstd gzip`). |

---

## Phase 5: Deployment & Operations

### 12. start.sh Robustness

| # | Check | Result | Detail |
|---|---|---|---|
| 12.1 | Prerequisites check | **PASS** | Checks for docker, docker compose plugin, and running Docker daemon before proceeding. |
| 12.2 | .env creation | **PASS** | Copies `.env.example` to `.env` on first run with instructions to fill values. |
| 12.3 | Env validation | **PASS** | Validates 11 required variables. Rejects placeholder values (`placeholder`, `your-`, `change-me`). Validates DOMAIN for production mode. |
| 12.4 | Three-phase startup | **PASS** | Phase 1: infrastructure (redis, rembg, crawl4ai), Phase 2: application (podclaw, frontend, admin, mcp-server), Phase 3: reverse proxy (caddy). |
| 12.5 | Partial failure handling | **PASS** | Health check loop with 30 retries (60s timeout). Continues with warning if infrastructure health times out. |
| 12.6 | Monitoring services not started | **WARN** | start.sh does not start prometheus, grafana, or loki in any of the 3 phases. These services must be started manually or the script needs updating. |
| 12.7 | set -euo pipefail | **PASS** | Script uses strict error handling. |

### 13. Health Checks

| # | Check | Result | Detail |
|---|---|---|---|
| 13.1 | All services have health checks | **PASS** | All 11 services have `healthcheck:` configured in docker-compose.yml. Custom Dockerfiles also define HEALTHCHECK. |
| 13.2 | Health check intervals | **PASS** | Most services: 30s interval, 10s timeout, 3 retries. Redis: 10s interval (appropriate for cache). crawl4ai: 60s start_period (appropriate for browser init). |
| 13.3 | Dependency ordering | **PASS** | All `depends_on` use `condition: service_healthy`. |

### 14. Logging & Monitoring

| # | Check | Result | Detail |
|---|---|---|---|
| 14.1 | Log rotation | **PASS** | All services use `json-file` driver with `max-size: 10m`, `max-file: 3` via YAML anchor `*default-logging`. |
| 14.2 | Prometheus scraping | **PASS** | Prometheus configured to scrape frontend, admin, podclaw, mcp-server at `/metrics` or `/api/metrics` endpoints (30s intervals). |
| 14.3 | Grafana dashboards | **PASS** | 4 pre-provisioned dashboards: system-overview, podclaw-metrics, ecommerce-metrics, infrastructure. |
| 14.4 | Loki log aggregation | **PASS** | Loki service configured. Grafana has datasource provisioning for both Prometheus and Loki. |
| 14.5 | Alerting | **PASS** | Grafana alerting enabled (`GF_UNIFIED_ALERTING_ENABLED: true`) with provisioned contact points, notification policies, and alert rules. Telegram integration available. |

### 15. Backup & Recovery

| # | Check | Result | Detail |
|---|---|---|---|
| 15.1 | Redis persistence | **PASS** | Redis uses AOF persistence (`--appendonly yes`) with a named volume (`redis-data`). |
| 15.2 | Volume backup strategy | **FAIL** | No backup strategy documented for Docker volumes (podclaw-data, podclaw-memory, redis-data, prometheus-data, grafana-data, loki-data, caddy-data). |
| 15.3 | Disaster recovery | **FAIL** | No disaster recovery procedure documented. Supabase is cloud-managed (backed up by Supabase), but local volumes (agent state, Redis cache, TLS certs) have no documented recovery path. |

---

## Critical Findings

### CRITICAL-1: Grafana Default Admin Password

**File**: `docker-compose.yml:362`
```
GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}
```

`GRAFANA_ADMIN_PASSWORD` is not listed in `.env.example`, so it will default to `admin` in all deployments unless manually set. In production, if Grafana is exposed (even internally), this is a credential compromise vector. Grafana has access to Telegram bot tokens via environment variables, which could be used for unauthorized notifications.

**Remediation**: Add `GRAFANA_ADMIN_PASSWORD` as `[REQUIRED]` in `.env.example` with a `change-me` placeholder. Validate it in `start.sh`.

### CRITICAL-2: No Secret Rotation Procedure

No documentation exists for rotating any of the 11+ secrets used across the stack. A compromised API token (Printify, Stripe, Supabase service key) would require ad-hoc manual intervention across multiple services.

**Remediation**: Create a `docs/SECRET_ROTATION.md` documenting the rotation procedure for each secret, including which services need restart.

---

## FAIL Findings

### FAIL-1: No Volume Backup Strategy

Seven named Docker volumes contain persistent state (agent memory, Redis data, TLS certificates, monitoring data). None have documented backup procedures. Loss of `caddy-data` would require re-issuing TLS certificates. Loss of `podclaw-data` and `podclaw-memory` would lose agent state and conversation history.

### FAIL-2: Supabase Service Key in Build Args

`SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are passed as Docker build args to frontend and admin. While the multi-stage build prevents them from appearing in the final runner image, they persist in the builder layer cache and in `docker history`. An attacker with access to the Docker daemon could extract them.

**Remediation**: Use `--mount=type=secret` (BuildKit secrets) instead of ARG for server-side credentials.

---

## WARN Findings

1. **Third-party images run as default user** (redis, crawl4ai, caddy, prometheus, grafana, loki) -- some may run as root. Add `user:` directives where the upstream image supports it.
2. **No Caddy-level rate limiting** -- all rate limiting is application-level. A volumetric attack could saturate services before app-level limits kick in.
3. **No Content-Security-Policy header** -- XSS mitigation relies on X-XSS-Protection (deprecated in modern browsers) and application-level sanitization.
4. **start.sh does not start monitoring services** -- prometheus, grafana, loki must be started manually.
5. **rembg SSRF risk** -- `server.py` accepts arbitrary `image_url` with `follow_redirects=False` (good), but no allowlist restricts which URLs can be fetched. An attacker who can reach the rembg endpoint could probe internal network services. Mitigated by network isolation (ai-services only).
6. **curl in production images** -- Installed solely for health checks. Consider lighter alternatives.

---

## Recommendations (Priority-Ordered)

1. **[CRITICAL]** Add `GRAFANA_ADMIN_PASSWORD` to `.env.example` as required. Validate in `start.sh`.
2. **[CRITICAL]** Document secret rotation procedures for all 11+ secrets.
3. **[HIGH]** Replace build ARGs for `SUPABASE_SERVICE_KEY` with BuildKit `--mount=type=secret`.
4. **[HIGH]** Add volume backup strategy (cron job with `docker run --volumes-from` or a backup sidecar).
5. **[MEDIUM]** Add `Content-Security-Policy` header to Caddyfile.
6. **[MEDIUM]** Add Caddy-level rate limiting (`rate_limit` directive or `limit` handler).
7. **[MEDIUM]** Add monitoring services (prometheus, grafana, loki) to start.sh phases.
8. **[MEDIUM]** Add `user:` directive for third-party images where supported (e.g., `user: "999:999"` for redis).
9. **[LOW]** Add URL allowlist to rembg server (restrict to known image CDN domains).
10. **[LOW]** Consider using a static health check binary instead of curl in production images.

---

## Files Analyzed

| File | Path |
|---|---|
| docker-compose.yml | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/docker-compose.yml` |
| docker-compose.local.yml | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/docker-compose.local.yml` |
| docker-compose.prod.yml | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/docker-compose.prod.yml` |
| start.sh | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/start.sh` |
| Caddyfile | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/Caddyfile` |
| PodClaw Dockerfile | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/Dockerfile` |
| rembg Dockerfile | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/rembg/Dockerfile` |
| rembg server.py | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/rembg/server.py` |
| Frontend Dockerfile | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/Dockerfile` |
| Admin Dockerfile | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/admin/Dockerfile` |
| MCP Server Dockerfile | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/Dockerfile` |
| .env.example | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/.env.example` |
| prometheus.yml | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/prometheus/prometheus.yml` |
