# Infrastructure Audit -- 2026-03-07

**Scope**: Docker Compose stack (11 services), networking, secrets, Caddy reverse proxy, Dockerfiles, monitoring, CI/CD, start.sh orchestration.

**Files audited**:
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/docker-compose.yml`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/docker-compose.local.yml`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/docker-compose.prod.yml`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/start.sh`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/Caddyfile`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/Dockerfile` (PodClaw)
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/rembg/Dockerfile`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/rembg/server.py`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/Dockerfile`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/admin/Dockerfile`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/Dockerfile`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/.env.example`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/.github/workflows/ci.yml`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/prometheus/prometheus.yml`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/grafana/provisioning/` (datasources, dashboards, alerting)

---

## Service Matrix

| Service | Non-root | cap_drop ALL | Mem limit | CPU limit | Health check | Restart policy | Networks | Log rotation |
|---|---|---|---|---|---|---|---|---|
| frontend | Yes (nextjs:1001) | Yes (anchor) | 384M | 1.0 | Yes (curl /api/health) | unless-stopped | proxy, data | Yes |
| admin | Yes (nextjs:1001) | Yes (anchor) | 256M | 0.5 | Yes (curl /panel/api/health) | unless-stopped | proxy | Yes |
| podclaw | Yes (podclaw:1001) | Yes (anchor) | 512M | 1.0 | Yes (curl /health) | unless-stopped | proxy, data, ai-services | Yes |
| mcp-server | Yes (node) | Yes (anchor) | 256M | 0.5 | Yes (curl /health) | unless-stopped | proxy, data | Yes |
| rembg | Yes (rembg) | Yes (anchor) | 768M | 2.0 | Yes (curl /health) | unless-stopped | ai-services | Yes |
| redis | Yes (default) | Yes (manual) | 256M | 0.5 | Yes (redis-cli ping) | unless-stopped | data | Yes |
| crawl4ai | No (image default) | Yes (manual) | 768M | 1.0 | Yes (curl /monitor/health) | unless-stopped | ai-services | Yes |
| caddy | Yes (default) | Yes (manual) | 64M | 0.5 | Yes (wget /) | unless-stopped | proxy | Yes |
| prometheus | Yes (default) | Yes (manual) | 512M | 0.5 | Yes (wget /-/healthy) | unless-stopped | proxy, data | Yes |
| grafana | Yes (default) | Yes (manual) | 256M | 0.5 | Yes (wget /api/health) | unless-stopped | proxy | Yes |
| loki | Yes (default) | Yes (manual) | 512M | 0.5 | Yes (wget /ready) | unless-stopped | data | Yes |

---

## Summary

- **Total checks**: 62
- **PASS**: 48 | **WARN**: 9 | **FAIL**: 4 | **CRITICAL**: 1

---

## 1. Docker Compose -- Service Definitions

### PASS
- All 11 services have `cap_drop: ALL` (via YAML anchor `*default-security` or manual).
- All services have memory limits (`deploy.resources.limits.memory`).
- All services have CPU limits (`deploy.resources.limits.cpus`).
- All services have memory reservations (`deploy.resources.reservations.memory`).
- All services have `restart: unless-stopped`.
- All services have health checks with interval, timeout, start_period, and retries.
- All services use `expose:` in base compose (no ports exposed by default).
- Log rotation configured globally via YAML anchor (`json-file`, 10m, 3 files).
- `depends_on` with `condition: service_healthy` used correctly for dependency ordering.
- No `env_file:` directive used anywhere -- each service declares only needed variables.
- No `privileged: true` found in any compose file.
- BuildKit secrets used for `supabase_service_key` (frontend, admin builds).
- Named volumes for persistent data (redis-data, podclaw-data, caddy-data, etc.).

### WARN

**[W01] Grafana and Loki both expose port 3100 -- P1**
- File: `docker-compose.yml`, lines 361 and 404
- Both `grafana` and `loki` declare `expose: ["3100"]`. While `expose` only makes ports accessible within Docker networks (not on the host), this is confusing and could cause issues if services are on the same network needing to reach each other by port.
- Grafana default port is 3000 (not 3100). The comment at line 13 says "Grafana -- Visualization and dashboards (port 3100)" which appears to be misconfigured.
- **Fix**: Change Grafana to use its default port 3000 with `GF_SERVER_HTTP_PORT=3000`, or use a non-conflicting port like 3200. Update the expose and healthcheck accordingly.

**[W02] Grafana default admin password fallback -- P2**
- File: `docker-compose.yml`, line 364
- `GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}` falls back to "admin" if the env var is unset.
- While `start.sh` validates this password (lines 186-193), the compose file itself allows the insecure default.
- The `start.sh` validation only checks when `GRAFANA_ADMIN_PASSWORD` is non-empty, meaning if it is completely absent, validation is skipped but the fallback to "admin" still activates.
- **Fix**: Remove the `:-admin` default. Make the service fail if the password is not set: `${GRAFANA_ADMIN_PASSWORD:?GRAFANA_ADMIN_PASSWORD required}`.

**[W03] Crawl4AI API token set to empty string -- P2**
- File: `docker-compose.yml`, line 258
- `CRAWL4AI_API_TOKEN: ""` explicitly disables authentication on the crawl4ai service. While it is isolated to the `ai-services` network, any service on that network (podclaw) can use it without auth.
- **Fix**: Set a random token and pass it to podclaw as well if auth is desired, or document the intentional no-auth decision.

**[W04] Prometheus on proxy network -- P3**
- File: `docker-compose.yml`, line 346
- Prometheus is on both `proxy` and `data` networks. It needs `data` to scrape services, but being on `proxy` means Caddy could theoretically proxy to it. Currently Caddy has no route for Prometheus, so this is low risk.
- **Fix**: Remove Prometheus from the `proxy` network unless Grafana needs to reach it via proxy. Since Grafana is on `proxy` and Prometheus is on `data`, they cannot currently communicate. Add a shared `monitoring` network instead.

### FAIL

**[F01] Grafana cannot reach Prometheus or Loki -- P0**
- File: `docker-compose.yml`
- Grafana is on network: `[proxy]` (line 389)
- Prometheus is on networks: `[proxy, data]` (line 346)
- Loki is on network: `[data]` (line 420)
- Grafana provisioned datasources reference `http://prometheus:9090` and `http://loki:3100`
- Grafana and Loki share NO common network, so Grafana **cannot reach Loki at all**.
- Grafana and Prometheus share `proxy`, so that connection works.
- **Fix**: Create a `monitoring` network and place grafana, prometheus, and loki on it. Remove prometheus from `proxy` network.

---

## 2. Dockerfiles -- Build Quality

### PASS
- **Frontend** (`frontend/Dockerfile`): 3-stage build (deps -> builder -> runner). Non-root user (nextjs:1001). BuildKit secret mount for `SUPABASE_SERVICE_KEY`. Standalone Next.js output. curl installed for healthcheck. Telemetry disabled.
- **Admin** (`admin/Dockerfile`): Same 3-stage pattern as frontend. Non-root user. BuildKit secret mount. `additional_contexts` for shared translations.
- **PodClaw** (`deploy/Dockerfile`): Single-stage but lean (`python:3.12-slim`). Non-root user (podclaw:1001). curl for healthcheck. No secrets in layers.
- **rembg** (`deploy/rembg/Dockerfile`): Non-root user. Model pre-downloaded at build time (deterministic). Proper cache directories.
- **MCP Server** (`mcp-server/Dockerfile`): 2-stage build. `npm prune --omit=dev` to remove devDeps. Uses built-in `node` user.
- All base images use specific versions (node:22-alpine, python:3.12-slim, caddy:2.9-alpine, redis:7-alpine).

### WARN

**[W05] PodClaw Dockerfile is NOT multi-stage -- P2**
- File: `deploy/Dockerfile`
- Single FROM stage. Build tools (`pip`) and requirements.txt processing happen in the same layer as the runtime. The final image contains pip cache artifacts and unnecessary build metadata.
- **Fix**: Use a 2-stage build: stage 1 installs dependencies, stage 2 copies only the installed packages and application code.

**[W06] Frontend/Admin Dockerfiles include curl in production image -- P3**
- Files: `frontend/Dockerfile` line 87, `admin/Dockerfile` line 69
- curl is installed in the runner stage solely for healthchecks. This adds attack surface.
- **Fix**: Use a dedicated healthcheck binary (e.g., `wget` from Alpine base, or a compiled Go binary) or use Node.js-based healthchecks. Low priority since Alpine is already minimal.

**[W07] MCP Server copies full node_modules from builder stage -- P3**
- File: `mcp-server/Dockerfile`, line 13
- `COPY --from=builder /app/node_modules` copies ALL deps including devDeps, then `npm prune --omit=dev` removes them. This works but the intermediate layer is bloated.
- **Fix**: Run `npm ci --omit=dev` in a separate stage for production deps only.

---

## 3. Network Segmentation

### PASS
- 3 networks defined: `proxy`, `data`, `ai-services` (all bridge driver).
- `rembg` and `crawl4ai` are isolated to `ai-services` only -- cannot reach proxy or data networks.
- Caddy is on `proxy` only -- cannot access Redis or data network directly.
- Redis is on `data` only -- not accessible from proxy network.
- Frontend, podclaw, mcp-server bridge proxy and data (correct -- need both Caddy routing and Redis access).
- Admin is proxy-only (correct -- no direct Redis or data access needed).

### FAIL (see F01 above)
- Grafana/Loki/Prometheus network isolation is broken for the monitoring stack.

---

## 4. Port Exposure

### PASS
- Base compose uses only `expose:` (internal) -- no `ports:` mapping.
- Local override (`docker-compose.local.yml`): All ports bound to `127.0.0.1` (3000, 3001, 8000, 8002, 8090, 11235, 6379, 8080).
- Production override (`docker-compose.prod.yml`): Only ports 80 and 443 exposed (Caddy).
- No debug ports (Redis 6379, PodClaw 8000) exposed in production.

### WARN

**[W08] Local override exposes Redis port 6379 -- P3**
- File: `docker-compose.local.yml`, line 55
- Redis is bound to `127.0.0.1:6379`. While localhost-only, any local process can connect. This is acceptable for dev but worth noting.
- No action needed -- documented behavior for local development.

---

## 5. Secrets Management

### PASS
- `.env` is gitignored (`.gitignore` lines 24-29 cover `.env`, `.env.local`, `.env.docker`, etc.).
- Each service receives only the environment variables it needs (no `env_file:` usage).
- No secrets hardcoded in any Dockerfile or compose file.
- BuildKit secrets used for build-time `SUPABASE_SERVICE_KEY` (never baked into image layers).
- `.env.example` has clear `[REQUIRED]` and `[OPTIONAL]` tags with service ownership annotations.
- Placeholder detection in `start.sh` (rejects "placeholder", "your-", "change-me" values).
- Generation instructions provided for security-critical values (e.g., `openssl rand -hex 32`).

### WARN

**[W09] No secret rotation documentation -- P2**
- There is no documented procedure for rotating secrets (API tokens, Redis password, JWT secrets).
- **Fix**: Add a `docs/secret-rotation.md` with step-by-step procedures for each secret type, including zero-downtime rotation for Redis password and JWT secrets.

### FAIL

**[F02] NEXT_PUBLIC_SUPABASE_ANON_KEY baked into Docker image at build time -- P1**
- File: `docker-compose.yml` line 51, `frontend/Dockerfile` lines 44-51
- `NEXT_PUBLIC_*` variables are passed as build args and inlined by webpack into the JS bundle. This means the Supabase anon key is permanently embedded in the Docker image.
- While anon keys are designed to be public (RLS enforces security), if the key is rotated, new images must be rebuilt and redeployed.
- The current architecture is standard for Next.js SSG/SSR with public keys, but be aware that image layers will contain these values.
- **Fix**: Document that NEXT_PUBLIC vars require rebuild on change. Consider runtime injection via `__NEXT_DATA__` for easier rotation.

---

## 6. Caddy / Reverse Proxy

### PASS
- Automatic HTTPS via Let's Encrypt in production (Caddy default behavior).
- HSTS header configured: `Strict-Transport-Security "max-age=31536000; includeSubDomains"`.
- Security headers comprehensive: `X-Content-Type-Options`, `X-Frame-Options DENY`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`.
- Server header stripped (`-Server`).
- Compression enabled (zstd + gzip).
- Correct routing: `/api/bridge/*` -> podclaw (with prefix strip), `/panel*` -> admin, `/mcp*` -> mcp-server, catch-all -> frontend.
- OAuth discovery endpoints proxied (`.well-known/oauth-*`, `/oauth/*`).
- On-demand TLS for custom tenant domains with verification endpoint and rate limiting (5 certs per 2min).
- `CADDY_SITE_ADDRESS` uses `${DOMAIN:?}` in prod (fails fast if not set).
- Local dev uses `http://localhost` (no HTTPS).

### WARN

**No rate limiting at proxy level -- P2**
- The Caddyfile has no rate limiting for general traffic (only for TLS cert issuance). All rate limiting is delegated to the application layer (Redis-based in mcp-server, frontend).
- **Fix**: Add Caddy rate limiting plugin or use `rate_limit` directive for `/api/*` endpoints to provide defense-in-depth.

---

## 7. start.sh -- Orchestration

### PASS
- `set -euo pipefail` for strict error handling.
- Pre-flight checks: docker binary, compose plugin, daemon running.
- First-run `.env` creation from template with user guidance.
- Environment validation: checks required vars, rejects placeholders, validates DOMAIN for prod, validates Grafana password.
- Phased startup: infrastructure (redis, rembg, crawl4ai) -> application (podclaw, frontend, admin, mcp-server) -> proxy (caddy).
- Optional Phase 4: monitoring stack gated by `ENABLE_MONITORING=true`.
- Health check wait loop with 30-retry timeout (60s total).
- `--clean` action with orphan removal and docker prune.
- `--status` action for quick health overview.
- Terminal color detection for output formatting.

### FAIL

**[F03] start.sh health check wait uses python3 (may not be available) -- P2**
- File: `start.sh`, lines 237-244
- The health check wait loop pipes `docker compose ps --format json` through `python3`. On minimal VPS installations or Alpine-based hosts, python3 may not be installed.
- **Fix**: Replace python3 parsing with `jq` or pure bash/grep. Example: `docker compose ps --format json | jq -r '.Health' | grep -v healthy | wc -l` or use `docker inspect --format`.

---

## 8. Monitoring Stack (Prometheus, Grafana, Loki)

### PASS
- Prometheus: v3.0.0 pinned image, 15-day TSDB retention, self-monitoring enabled.
- Grafana: v11.4.0 pinned image, sign-up disabled, anonymous access disabled, unified alerting enabled.
- Loki: v3.3.1 pinned image, dedicated volume for log storage.
- Provisioned datasources: Prometheus (default) + Loki auto-configured.
- 4 pre-built dashboards: system-overview, podclaw-metrics, ecommerce-metrics, infrastructure.
- Alert rules: service-down (5min), high-memory (90%, 3min), PodClaw budget (90%), error rate (5%).
- Contact points: Telegram (critical/warning) + email fallback (info).
- Notification policies with grouping, wait times, and repeat intervals.
- Monitoring stack is optional (gated by `ENABLE_MONITORING` env var).

### Issues (see F01 above)
- Grafana cannot reach Loki due to network misconfiguration.
- Several Prometheus queries reference metrics that may not be exposed yet (marked as "placeholder" in rules.yml).

---

## 9. Redis

### PASS
- Password authentication required (`--requirepass`).
- Dangerous commands disabled: `FLUSHALL`, `FLUSHDB`, `DEBUG`, `CONFIG` all renamed to empty string.
- AOF persistence enabled (`--appendonly yes`).
- Memory limit set (`--maxmemory 256mb` + `allkeys-lru` eviction).
- Persistent volume (`redis-data:/data`).
- Isolated to `data` network only.
- Capabilities: only `SETGID`, `SETUID`, `DAC_OVERRIDE` (required by redis-server).
- Health check uses `redis-cli -a` with password.

### Notes
- Redis password is stored in `REDIS_PASSWORD` env var, passed to redis-server command line. This means the password is visible in `docker inspect` and process listing. Standard for Docker Redis deployments.
- No TLS for Redis connections (acceptable within Docker network).

---

## 10. Backup Strategy

### FAIL

**[F04] No backup strategy documented or implemented -- P1**
- No backup scripts, cron jobs, or documentation for:
  - Redis AOF/RDB snapshots
  - PodClaw data/memory volumes
  - Caddy TLS certificate volume
  - Grafana dashboards/settings volume
  - Prometheus TSDB data
- Supabase is cloud-managed (backup handled by Supabase), but no documentation confirms this.
- No disaster recovery procedure documented.
- **Fix**: Create `deploy/backup.sh` with volume backup to S3/B2. Add cron schedule. Document recovery procedures in `docs/disaster-recovery.md`.

---

## 11. CI/CD

### PASS
- GitHub Actions CI pipeline at `.github/workflows/ci.yml`.
- 4-stage pipeline: Lint/TypeCheck -> Unit Tests -> Integration Tests -> Docker Build.
- Concurrency control with `cancel-in-progress: true`.
- Multi-version matrix testing: Node 20/22, Python 3.11/3.12.
- Playwright E2E tests with artifact upload.
- Coverage reporting for MCP server.
- Docker build smoke test validates all images build successfully.
- Mock environment variables used throughout (no real secrets in CI).
- Triggers on push to main and PRs to main.

### Notes
- No CD (Continuous Deployment) pipeline exists. Deployment is manual via `start.sh`.
- No container registry push step (images are built but not pushed).
- No Dependabot or Renovate configuration for dependency updates.

---

## 12. Environment Parity (Dev vs Production)

### PASS
- Clean separation: base compose (shared) + local override + prod override.
- Local: all ports 127.0.0.1, HTTP only, bridge auth disabled, telemetry disabled.
- Production: only 80/443 exposed, HTTPS, bridge auth enabled, CORS restricted to domain.
- `DOMAIN` validation in both `start.sh` and compose (`:?` expansion).

### Notes
- The local override disables PodClaw bridge auth (`PODCLAW_BRIDGE_AUTH_ENABLED: "false"`). This is intentional for dev but means local testing does not exercise the auth path.

---

## 13. Security Hardening

### PASS
- `cap_drop: ALL` on every service.
- `cap_add` justified on all services that use it:
  - redis: SETGID, SETUID, DAC_OVERRIDE (needed for redis-server user switching)
  - crawl4ai: SYS_ADMIN (needed for Chrome sandbox/namespaces)
  - caddy: NET_BIND_SERVICE (needed to bind ports 80/443)
  - prometheus/grafana/loki: CHOWN, DAC_OVERRIDE, SETGID, SETUID (needed for data directory ownership)
- No `privileged: true` found anywhere.
- No `env_file:` usage -- explicit variable passing only.
- Log rotation on all services (10MB x 3 files).
- Non-root users in all custom images.

### Missing
- No `read_only: true` filesystem on any service. This would prevent writing to the container filesystem (only volumes would be writable).
- No `tmpfs` mounts for `/tmp` or other writable directories.
- No `security_opt: no-new-privileges:true` on any service.
- No `pids_limit` to prevent fork bombs.

---

## Critical Findings

### CRITICAL (1)

| ID | Issue | File | Lines | Impact |
|---|---|---|---|---|
| F01 | Grafana cannot reach Loki (no shared network) | docker-compose.yml | 389, 420 | Monitoring stack partially broken -- log aggregation dashboard will fail |

### HIGH (3)

| ID | Severity | Issue | File |
|---|---|---|---|
| F02 | P1 | NEXT_PUBLIC keys baked into image layers (rotation requires rebuild) | docker-compose.yml:51, frontend/Dockerfile:44-51 |
| F04 | P1 | No backup strategy for Docker volumes | N/A |
| W01 | P1 | Grafana and Loki both use port 3100 (conflict/misconfiguration) | docker-compose.yml:361,404 |

### MEDIUM (5)

| ID | Severity | Issue | File |
|---|---|---|---|
| W02 | P2 | Grafana admin password fallback to "admin" | docker-compose.yml:364 |
| W03 | P2 | Crawl4AI API token empty (no auth) | docker-compose.yml:258 |
| W05 | P2 | PodClaw Dockerfile not multi-stage | deploy/Dockerfile |
| W09 | P2 | No secret rotation documentation | N/A |
| F03 | P2 | start.sh health check depends on python3 | start.sh:237-244 |
| -- | P2 | No rate limiting at Caddy proxy level | deploy/Caddyfile |

### LOW (3)

| ID | Severity | Issue | File |
|---|---|---|---|
| W04 | P3 | Prometheus on proxy network unnecessarily | docker-compose.yml:346 |
| W06 | P3 | curl in production images for healthchecks | frontend/Dockerfile:87, admin/Dockerfile:69 |
| W07 | P3 | MCP Server copies full node_modules then prunes | mcp-server/Dockerfile:13 |

---

## Recommendations (Priority-Ordered)

### P0 -- Fix Immediately

1. **Fix monitoring network topology**: Create a `monitoring` network. Place grafana, prometheus, and loki on it. Remove prometheus from `proxy`. Fix Grafana's exposed port from 3100 to 3000 (or 3200 to avoid conflict with frontend).

```yaml
# Add to networks section:
monitoring:
  driver: bridge

# Update services:
grafana:
  networks: [proxy, monitoring]
  expose: ["3000"]

prometheus:
  networks: [monitoring, data]

loki:
  networks: [monitoring]
```

### P1 -- Fix Before Production

2. **Implement backup strategy**: Create `deploy/backup.sh` that exports Docker volumes to tarball. Schedule via cron. Minimum: redis-data, podclaw-data, podclaw-memory, caddy-data.

3. **Document NEXT_PUBLIC rebuild requirement**: Add to deployment docs that changing any `NEXT_PUBLIC_*` variable requires a full image rebuild.

### P2 -- Fix Soon

4. **Remove Grafana password fallback**: Change to `${GRAFANA_ADMIN_PASSWORD:?Required}`.

5. **Fix start.sh python3 dependency**: Replace with `jq` or bash-only parsing.

6. **Make PodClaw Dockerfile multi-stage**: Separate build and runtime stages.

7. **Add rate limiting to Caddyfile**: Use `rate_limit` for API endpoints.

8. **Document secret rotation procedures**.

### P3 -- Improve When Convenient

9. Add `read_only: true` to stateless services (caddy, rembg) with tmpfs for writable dirs.
10. Add `security_opt: ["no-new-privileges:true"]` to all services.
11. Add `pids_limit` to all services (e.g., 100 for most, 200 for crawl4ai).
12. Replace curl healthchecks with lighter alternatives.
13. Add Dependabot/Renovate for automated dependency updates.
14. Add CD pipeline for automated deployment after CI passes.

---

## Architecture Diagram

```
                    Internet
                       |
                   [80/443]
                    Caddy ---- proxy network ---- frontend (3000)
                      |                            admin (3001)
                      |                            podclaw (8000)
                      |                            mcp-server (8002)
                      |                            grafana (3100*)
                      |                            prometheus (9090)
                      |
                  data network ---- frontend
                      |              podclaw
                      |              mcp-server
                      |              prometheus
                      |              loki (3100*)
                      |              redis (6379)
                      |
               ai-services network ---- podclaw
                                         rembg (8080)
                                         crawl4ai (11235)

  * Port conflict: grafana and loki both use 3100
  * Grafana and Loki have no shared network (BROKEN)
```

---

## Appendix: .env.example Variable Inventory

| Variable | Required | Used By | Rotation Impact |
|---|---|---|---|
| SUPABASE_URL | Yes | frontend, podclaw, mcp-server | Restart all |
| SUPABASE_SERVICE_KEY | Yes | frontend, admin, podclaw, mcp-server | Restart + rebuild (BuildKit secret) |
| SUPABASE_ANON_KEY | Yes | frontend, mcp-server | Restart |
| NEXT_PUBLIC_SUPABASE_URL | Yes (build) | frontend, admin | **Rebuild required** |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes (build) | frontend | **Rebuild required** |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Yes (build) | frontend | **Rebuild required** |
| NEXT_PUBLIC_BASE_URL | Yes (build) | frontend | **Rebuild required** |
| STRIPE_SECRET_KEY | Yes | frontend, podclaw | Restart |
| STRIPE_WEBHOOK_SECRET | Optional | frontend | Restart frontend |
| PRINTIFY_API_TOKEN | Yes | podclaw | Restart podclaw |
| PRINTIFY_SHOP_ID | Yes | podclaw | Restart podclaw |
| FAL_KEY | Yes | podclaw | Restart podclaw |
| GEMINI_API_KEY | Yes | podclaw | Restart podclaw |
| RESEND_API_KEY | Yes | frontend, podclaw | Restart both |
| REDIS_PASSWORD | Yes | frontend, podclaw, mcp-server, redis | Restart all data-network services |
| PODCLAW_BRIDGE_AUTH_TOKEN | Yes | admin, podclaw | Restart both |
| MCP_JWT_SECRET | Yes | mcp-server | Restart + invalidates all active sessions |
| GRAFANA_ADMIN_PASSWORD | Yes | grafana | Restart grafana |
| DOMAIN | Prod only | caddy, frontend, podclaw | Rebuild frontend + restart |
| CRON_SECRET | Yes | frontend | Restart frontend |
| REVALIDATION_SECRET | Yes | admin, frontend | Restart both |
| ENABLE_MONITORING | Optional | start.sh | Re-run start.sh |

---

*Audit performed 2026-03-07. Next audit recommended before production deployment.*
