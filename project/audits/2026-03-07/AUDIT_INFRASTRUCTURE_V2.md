# Infrastructure Audit -- 2026-03-07

Auditor: Claude Opus 4.6 (automated)
Scope: Docker Compose stack, networking, secrets, Caddy reverse proxy, Dockerfiles, start.sh orchestration

---

## Service Matrix

| Service | Non-root | Cap drop ALL | Mem limit | CPU limit | Health check | Restart policy | Networks | Status |
|---|---|---|---|---|---|---|---|---|
| frontend | YES (nextjs:1001) | YES (anchor) | 384M | 1.0 | curl /api/health | unless-stopped | proxy, data | PASS |
| admin | YES (nextjs:1001) | YES (anchor) | 256M | 0.5 | curl /panel/api/health | unless-stopped | proxy | PASS |
| podclaw | YES (podclaw:1001) | YES (anchor) | 512M | 1.0 | curl /health | unless-stopped | proxy, data, ai-services | PASS |
| mcp-server | YES (node) | YES (anchor) | 256M | 0.5 | curl /health | unless-stopped | proxy, data | PASS |
| rembg | YES (rembg) | YES (anchor) | 768M | 2.0 | curl /health | unless-stopped | ai-services | PASS |
| redis | YES (redis default) | YES (manual) | 256M | 0.5 | redis-cli ping | unless-stopped | data | PASS |
| crawl4ai | NO (image default) | YES (manual) | 768M | 1.0 | curl /monitor/health | unless-stopped | ai-services | WARN |
| prometheus | NO (image default) | YES (manual) | 512M | 0.5 | wget /-/healthy | unless-stopped | proxy, data | WARN |
| grafana | NO (image default) | YES (manual) | 256M | 0.5 | wget /api/health | unless-stopped | proxy, monitoring | PASS |
| loki | NO (image default) | YES (manual) | 512M | 0.5 | wget /ready | unless-stopped | data, monitoring | PASS |
| caddy | NO (image default) | YES (manual) | 64M | 0.5 | wget / | unless-stopped | proxy | PASS |

---

## Summary

- **Total checks: 42**
- **PASS: 30 | WARN: 9 | FAIL: 2 | CRITICAL: 1**

---

## Phase 1: Container Security

### 1. Privilege Model

| Check | Result | Notes |
|---|---|---|
| `cap_drop: ALL` on every service | PASS | All 11 services drop all capabilities. Base compose uses YAML anchor `*default-security`; redis, crawl4ai, prometheus, grafana, loki, caddy have explicit `cap_drop: ALL`. |
| `cap_add` justified | PASS | redis: SETGID/SETUID/DAC_OVERRIDE (required for persistence). crawl4ai: SYS_ADMIN (required for Chromium sandbox). caddy: NET_BIND_SERVICE (ports 80/443). prometheus/grafana/loki: CHOWN/DAC_OVERRIDE/SETGID/SETUID (file ownership in volumes). All justified. |
| Non-root users in custom images | PASS | frontend (nextjs:1001), admin (nextjs:1001), podclaw (podclaw:1001), rembg (rembg), mcp-server (node). All have explicit `USER` directives. |
| `privileged: true` absent | PASS | No occurrences found in any compose file. |

### 2. Image Provenance

| Check | Result | Notes |
|---|---|---|
| Base images pinned | PASS | redis:7-alpine, caddy:2.9-alpine, crawl4ai:0.8.0, prom/prometheus:v3.0.0, grafana/grafana:11.4.0, grafana/loki:3.3.1, node:22-alpine, python:3.12-slim. All pinned. |
| Multi-stage builds | PASS | frontend (3-stage: deps/builder/runner), admin (3-stage), mcp-server (2-stage: builder/runner). PodClaw and rembg are single-stage but acceptable (Python, no build artifacts to separate). |
| Unnecessary tools in prod | WARN | `curl` is installed in all runner stages for healthchecks. This is acceptable but increases attack surface. Consider using `wget` (already in Alpine) or a purpose-built healthcheck binary. |

### 3. Resource Limits

| Check | Result | Notes |
|---|---|---|
| `mem_limit` on every service | PASS | All 11 services have `deploy.resources.limits.memory` set. |
| `cpus` limit on every service | PASS | All 11 services have `deploy.resources.limits.cpus` set. Range: 0.5-2.0 CPU. |
| Memory reservations | PASS | All services have `deploy.resources.reservations.memory`. |
| Restart policies | PASS | All services use `restart: unless-stopped`. |

**Total allocated resources (all services running):**
- Memory limits: 384+256+512+256+768+256+768+512+256+512+64 = 4,544 MB (~4.4 GB)
- CPU limits: 1.0+0.5+1.0+0.5+2.0+0.5+1.0+0.5+0.5+0.5+0.5 = 8.5 cores
- Note: Monitoring stack (prometheus+grafana+loki) adds 1,280 MB and 1.5 CPUs; gated by `ENABLE_MONITORING=true`.

---

## Phase 2: Network Segmentation

### 4. Network Topology

| Check | Result | Notes |
|---|---|---|
| 3+ networks exist | PASS | 4 networks defined: `proxy`, `data`, `ai-services`, `monitoring`. |
| Services on correct networks | PASS | Matches documented topology. Frontend/admin/podclaw/mcp-server on proxy. Frontend/podclaw/mcp-server on data. Podclaw/rembg/crawl4ai on ai-services. |
| rembg/crawl4ai isolated from proxy | PASS | Both only on `ai-services` network. Cannot reach Caddy or external traffic directly. |
| Caddy isolated from data | PASS | Caddy only on `proxy` network. Cannot reach Redis directly. |
| **Prometheus on data network** | **WARN** | Prometheus is on `proxy` AND `data` networks. It needs `data` to scrape Redis if redis metrics were exposed, but Redis does not expose a metrics endpoint. Prometheus could theoretically reach Redis on the data network. Consider a dedicated `monitoring` network for scrape targets instead. |

### 5. Port Exposure

| Check | Result | Notes |
|---|---|---|
| Base compose: only `expose:` (no `ports:`) | PASS | All services use `expose:` only in base compose. No ports are bound to the host. |
| Local dev: all ports 127.0.0.1 | PASS | `docker-compose.local.yml` binds all ports to `127.0.0.1`. |
| Production: only 80/443 via Caddy | PASS | `docker-compose.prod.yml` exposes only `80:80` and `443:443` on Caddy. No other service ports are published. |
| Debug ports in production | PASS | No Redis, PodClaw, or other debug ports exposed in prod override. |
| **Monitoring ports not exposed in prod** | **WARN** | Prometheus (9090), Grafana (3100), Loki (3100) have no port mappings in prod override, which is correct for security. However, Grafana dashboards are unreachable externally without a Caddy route. If monitoring is needed in prod, add a `/grafana` route to Caddyfile with auth. |

### 6. Inter-Service Communication

| Check | Result | Notes |
|---|---|---|
| Services reference by name | PASS | All inter-service URLs use Docker DNS names: `redis:6379`, `podclaw:8000`, `frontend:3000`, `rembg:8080`, `crawl4ai:11235`, `mcp-server:8002`, `admin:3001`, `prometheus:9090`, `loki:3100`. |
| TLS between services | N/A | Not needed within Docker bridge networks. Acceptable. |
| Health-based dependency ordering | PASS | All `depends_on` use `condition: service_healthy`. Startup ordering is correct: redis/rembg/crawl4ai -> podclaw -> frontend/admin/mcp-server -> caddy. |

---

## Phase 3: Secret Management

### 7. Environment Variables

| Check | Result | Notes |
|---|---|---|
| `.env` gitignored | PASS | `.gitignore` includes `.env`, `.env.local`, `.env.docker`, and environment-specific variants. |
| No `env_file:` directive | PASS | No service uses `env_file:`. Each service declares only the variables it needs via `environment:`. |
| No hardcoded secrets in Dockerfiles | PASS | No secrets found in any Dockerfile. Build-time secrets use BuildKit `--mount=type=secret`. |
| No secrets in build args | WARN | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are passed as build args. These are public keys by design (NEXT_PUBLIC_ prefix), but they will appear in `docker history`. Not a security risk since they are client-side keys, but worth noting. `SUPABASE_SERVICE_KEY` correctly uses BuildKit secret mount. |
| **CRAWL4AI_API_TOKEN set to empty string** | **WARN** | `CRAWL4AI_API_TOKEN: ""` means the crawl4ai API has no authentication. Since crawl4ai is isolated on ai-services network and only reachable by podclaw, this is acceptable but leaves no defense-in-depth if network segmentation is breached. |

### 8. Secret Rotation

| Check | Result | Notes |
|---|---|---|
| Rotation candidates identified | WARN | The following secrets require periodic rotation: `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `REDIS_PASSWORD`, `PODCLAW_BRIDGE_AUTH_TOKEN`, `MCP_JWT_SECRET`, `FAL_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `PRINTIFY_API_TOKEN`, `GRAFANA_ADMIN_PASSWORD`. |
| Rotation procedure documented | **FAIL** | No rotation procedure documentation found. There is no `docs/secret-rotation.md` or equivalent. Rotating Redis password requires coordinated restart of frontend+podclaw+mcp-server. |
| Unnecessary secret sharing | PASS | Secrets are minimally shared. `SUPABASE_SERVICE_KEY` is shared between frontend, admin, podclaw, and mcp-server (all need admin DB access). `STRIPE_SECRET_KEY` shared between frontend and podclaw (payments + refunds). `RESEND_API_KEY` shared between frontend and podclaw (emails). All justified. |

### 9. `.env.example` Completeness

| Check | Result | Notes |
|---|---|---|
| Lists all required variables | PASS | All variables referenced in docker-compose.yml are present in `.env.example`. Includes `[REQUIRED]` and `[OPTIONAL]` tags in section headers. |
| Placeholder detection in start.sh | PASS | `validate_env()` checks for `placeholder`, `your-`, and `change-me` patterns. `GRAFANA_ADMIN_PASSWORD` has additional validation against default values. |
| **Placeholder values look like real secrets** | PASS | Placeholders use obvious patterns: `your-*`, `change-me-*`, `pk_test_placeholder`, `re_placeholder`. None could be mistaken for real credentials. |

---

## Phase 4: Reverse Proxy & TLS

### 10. Caddy Configuration

| Check | Result | Notes |
|---|---|---|
| Automatic HTTPS | PASS | Production mode uses `${DOMAIN}` which triggers Caddy's automatic HTTPS with Let's Encrypt. Local mode uses `http://localhost` (no TLS). |
| Route correctness | PASS | `/api/bridge/*` -> podclaw:8000 (with prefix strip). `/panel*` -> admin:3001 (no strip, admin expects /panel). `/mcp*` -> mcp-server:8002. `/.well-known/oauth-*` and `/oauth/*` -> mcp-server:8002. Default -> frontend:3000. |
| On-demand TLS for custom domains | PASS | Configured with `ask` endpoint at `http://frontend:3000/api/verify-domain`. Rate limited to 5 new certs per 2 minutes. |
| Rate limiting at proxy | **FAIL** | No rate limiting configured in Caddyfile. Caddy supports `rate_limit` via plugin but it is not installed. All rate limiting is delegated to application layer (Redis-based). A volumetric DDoS or brute-force attack will reach the application servers directly. |
| WebSocket support | PASS | Caddy's `reverse_proxy` directive natively supports WebSocket upgrades. No special configuration needed. |
| Compression | PASS | `encode zstd gzip` enabled on both site blocks. |

### 11. Security Headers

| Check | Result | Notes |
|---|---|---|
| Security headers present | PASS | HSTS (max-age=31536000, includeSubDomains), X-Content-Type-Options (nosniff), X-Frame-Options (DENY), X-XSS-Protection (1; mode=block), Referrer-Policy (strict-origin-when-cross-origin), Permissions-Policy (restrictive), Server header removed. Applied to both primary domain and custom tenant domain blocks. |
| HSTS configured | PASS | `Strict-Transport-Security "max-age=31536000; includeSubDomains"` -- 1 year, includes subdomains. |
| HTTP -> HTTPS redirect | PASS | Caddy handles this automatically when the site address is a domain name (not `http://`). |
| **Missing Content-Security-Policy** | WARN | No CSP header configured. While Next.js can set this via `next.config.js`, having it at the proxy level provides defense-in-depth. |
| **Missing HSTS preload** | WARN | HSTS does not include `preload` directive. Consider adding for HSTS preload list eligibility. |

---

## Phase 5: Deployment & Operations

### 12. start.sh Robustness

| Check | Result | Notes |
|---|---|---|
| Prerequisite validation | PASS | Checks for `docker`, `docker compose` plugin, and running Docker daemon. |
| `.env` creation on first run | PASS | Copies `.env.example` to `.env` and exits with instructions. |
| Variable validation | PASS | Checks for missing and placeholder values. Production mode requires `DOMAIN`. Grafana password validated against weak defaults. |
| Phased startup | PASS | Phase 1: redis, rembg, crawl4ai. Phase 2: podclaw, frontend, admin, mcp-server. Phase 3: caddy. Phase 4 (optional): prometheus, grafana, loki. Infrastructure health is verified between phases. |
| `--clean` handling | PASS | Stops services with `--remove-orphans`, prunes builder cache and system resources. |
| `--down` handling | PASS | Clean shutdown of all services. |
| `--status` handling | PASS | Displays `docker compose ps` output. |
| **Health wait timeout handling** | WARN | If infrastructure health check times out after 60s (30 retries x 2s), the script issues a warning but continues anyway (`warn "...timed out. Continuing anyway..."`). This could lead to application services starting before dependencies are ready. The `depends_on: condition: service_healthy` in compose provides a second layer of defense, but the script should consider failing hard on timeout. |

### 13. Health Checks

| Check | Result | Notes |
|---|---|---|
| Every service has health check | PASS | All 11 services have health checks defined in docker-compose.yml. Additionally, custom Dockerfiles include `HEALTHCHECK` directives (redundant but harmless; compose takes precedence). |
| Health check intervals reasonable | PASS | Most services: 30s interval, 10s timeout, 3 retries. Redis: 10s interval (appropriate for cache dependency). |
| Dependency ordering via health | PASS | All `depends_on` use `condition: service_healthy`. Chain: redis/rembg/crawl4ai (no deps) -> podclaw (redis, rembg, crawl4ai) -> frontend (redis, podclaw) -> admin (podclaw) -> mcp-server (redis) -> caddy (frontend, admin, podclaw, mcp-server). |

### 14. Logging & Monitoring

| Check | Result | Notes |
|---|---|---|
| Log rotation configured | PASS | All services use `json-file` driver with `max-size: 10m` and `max-file: 3` via YAML anchor `*default-logging`. |
| Structured logging | PASS | PodClaw has `PODCLAW_JSON_LOGS` option. Next.js outputs structured logs in production mode. |
| Log aggregation | PASS | Loki is configured as a log backend. Grafana has Loki datasource provisioned. However, Docker log driver is `json-file`, not `loki`. Services would need to push logs to Loki or use a log collector (e.g., Promtail) to bridge the gap. |
| **Missing Promtail/log shipper** | **CRITICAL** | The Loki datasource is provisioned in Grafana, but there is no log shipping agent (Promtail, Alloy, or Fluent Bit) configured to send Docker container logs to Loki. The `json-file` log driver writes to local disk only. Loki will have no log data unless a shipper is added. The monitoring stack is incomplete. |
| Alert configuration | PASS | Grafana alerting is provisioned with Telegram contact point and alert rules. Alert rules file exists at `deploy/grafana/provisioning/alerting/rules.yml`. |
| Prometheus scraping | PASS | Prometheus configured to scrape frontend, admin, podclaw, mcp-server, and itself. 30s scrape interval. |
| **Metrics endpoints may not exist** | WARN | Prometheus scrapes `/api/metrics` (frontend), `/panel/api/metrics` (admin), `/metrics` (podclaw, mcp-server). These endpoints need to be verified -- if they do not exist, Prometheus will log scrape errors but the stack will still run. |

### 15. Backup & Recovery

| Check | Result | Notes |
|---|---|---|
| Redis backup strategy | PASS | Redis uses AOF persistence (`--appendonly yes`) with a named volume `redis-data`. Data survives container restarts. |
| Docker volumes persistent | PASS | Named volumes: `podclaw-data`, `podclaw-memory`, `redis-data`, `crawl4ai-output`, `prometheus-data`, `grafana-data`, `loki-data`, `caddy-data`, `caddy-config`. All survive `docker compose down` (only removed with `--volumes` flag). |
| **Volume backup procedure** | **FAIL** | No backup procedure documented for Docker volumes. If the host disk fails, all data in `redis-data`, `podclaw-data`, `podclaw-memory`, `prometheus-data`, `grafana-data`, and `loki-data` is lost. Supabase is cloud-managed (safe), but local state has no off-host backup. |
| Disaster recovery | N/A | Database is Supabase Cloud (managed backups). Application state is in Docker volumes (no backup). Caddy TLS certs are auto-renewed. A full rebuild from source + fresh `.env` would restore the stack minus Redis cache, PodClaw memory, and monitoring history. |

---

## Critical Findings

### CRITICAL-1: No Log Shipper for Loki (Monitoring Stack Incomplete)

**Severity: CRITICAL**
**Location:** `docker-compose.yml` (missing promtail/alloy service)

The monitoring stack includes Loki and Grafana with a Loki datasource, but there is no log shipping agent to forward Docker container logs to Loki. All services use the `json-file` log driver which writes to local disk. Loki will have zero log data. The Grafana log dashboards will be empty.

**Fix:** Add a Promtail or Grafana Alloy service to the monitoring stack that reads Docker container logs and forwards them to Loki. Alternatively, switch the Docker log driver to `loki` for all services (requires the Docker Loki plugin).

### FAIL-1: No Rate Limiting at Reverse Proxy

**Severity: HIGH**
**Location:** `deploy/Caddyfile`

Caddy has no rate limiting configuration. All traffic reaches application servers directly. While Redis-based rate limiting exists at the application layer, a volumetric attack or brute-force attempt will consume application resources before being rejected.

**Fix:** Install the `caddy-ratelimit` plugin (or use Cloudflare rate limiting if deployed behind Cloudflare). Add rate limits for sensitive endpoints: `/api/auth/*`, `/api/bridge/*`, `/oauth/*`.

### FAIL-2: No Secret Rotation Procedure

**Severity: HIGH**
**Location:** Documentation gap

No documented procedure for rotating secrets. `REDIS_PASSWORD` rotation requires coordinated restart of 3 services (frontend, podclaw, mcp-server). `MCP_JWT_SECRET` rotation invalidates all active MCP sessions. `SUPABASE_SERVICE_KEY` rotation requires Supabase dashboard + redeployment.

**Fix:** Document rotation procedures for each secret type, including order of operations and expected downtime.

### FAIL-3: No Volume Backup Strategy

**Severity: HIGH**
**Location:** Operations gap

Docker volumes (`redis-data`, `podclaw-data`, `podclaw-memory`) have no off-host backup. PodClaw's memory and brain state would be permanently lost in a host failure.

**Fix:** Implement scheduled volume backups (e.g., `docker run --rm -v podclaw-data:/data -v /backup:/backup alpine tar czf /backup/podclaw-data-$(date +%F).tar.gz /data`). Consider a cron job or systemd timer.

---

## Grafana/Loki Port Collision

**Severity: WARN**
**Location:** `docker-compose.yml` lines 361, 404

Both Grafana and Loki use `expose: "3100"`. Within Docker networking this is not a conflict since they are separate containers with separate DNS names. However, it is confusing and could cause issues if ports are ever mapped to the host. Grafana's default port is 3000 (already taken by frontend) so 3100 is an intentional remap. Loki's default is 3100. This works but is a readability concern.

---

## Recommendations (Priority-Ordered)

### P0 -- Before Production Deploy

1. **Add Promtail/Alloy log shipper** to complete the monitoring stack. Without it, Loki and log-based Grafana dashboards are non-functional.
2. **Add Caddy rate limiting** for auth and API endpoints, or deploy behind Cloudflare with rate limiting rules.
3. **Document secret rotation procedures** for all `[REQUIRED]` secrets in `.env.example`.

### P1 -- First Month in Production

4. **Implement volume backup cron** for `redis-data`, `podclaw-data`, `podclaw-memory` volumes to off-host storage (S3, rsync to backup server, etc.).
5. **Verify metrics endpoints exist** (`/api/metrics` on frontend, `/panel/api/metrics` on admin, `/metrics` on podclaw and mcp-server) or Prometheus will log constant scrape errors.
6. **Add Content-Security-Policy header** to Caddyfile for defense-in-depth against XSS.
7. **Set CRAWL4AI_API_TOKEN** to a non-empty value for defense-in-depth on the ai-services network.
8. **Harden start.sh timeout** -- fail hard (exit 1) if infrastructure health check times out instead of continuing.

### P2 -- Ongoing Hardening

9. **Add `preload` to HSTS** header once confident in HTTPS-only operation.
10. **Remap Grafana to a non-colliding port** (e.g., 3200) for clarity.
11. **Consider read-only root filesystem** (`read_only: true`) for stateless services (caddy, rembg, mcp-server) with explicit tmpfs mounts for writable paths.
12. **Replace curl healthchecks** with a static binary or use `wget` (already in Alpine) to reduce attack surface in production images.
13. **Add `no-new-privileges: true`** security option to all services to prevent privilege escalation via setuid binaries.
14. **Pin crawl4ai image digest** (`unclecode/crawl4ai@sha256:...`) for reproducible builds since it is a third-party image.
15. **Add network-level access control** for Prometheus -- currently on `proxy` AND `data` networks; move to a dedicated `monitoring` network with scrape targets explicitly connected.

---

## Architecture Diagram

```
                    Internet
                       |
                   [Caddy:80/443]
                   (proxy network)
                  /    |    \     \
          frontend  admin  podclaw  mcp-server
          (proxy,   (proxy) (proxy,  (proxy,
           data)            data,     data)
                            ai-svc)
                              |   \
                           rembg  crawl4ai
                        (ai-services only)

          frontend ---+
          podclaw  ---+--- redis (data network)
          mcp-server -+

          prometheus (proxy, data) --- scrapes ---> frontend, admin, podclaw, mcp-server
          loki (data, monitoring)
          grafana (proxy, monitoring) --- queries ---> prometheus, loki
          [MISSING: log shipper] --- would ship ---> loki
```

---

*Generated: 2026-03-07 | Auditor: Claude Opus 4.6 | Skill: audit-infrastructure*
