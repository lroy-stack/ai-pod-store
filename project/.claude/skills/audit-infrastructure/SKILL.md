---
name: Audit Infrastructure
description: >
  Comprehensive audit of Docker Compose, networking, secrets, Caddy reverse proxy, deploy
  scripts, and container security. Use when asked to audit infrastructure, review Docker
  setup, or assess deployment readiness.
---

# Audit Infrastructure

Systematic audit of the self-hosted Docker stack: 8 services, 3 networks, Caddy reverse proxy.

## Prerequisites

- Read `docker-compose.yml`, `docker-compose.local.yml`, `docker-compose.prod.yml`
- Read `start.sh` for orchestration logic
- Read `deploy/Caddyfile` for reverse proxy config
- Read `deploy/Dockerfile` (PodClaw), `deploy/rembg/` (background removal sidecar)
- Read `.env.example` for variable inventory

## Workflow

### Phase 1: Container Security

1. **Privilege model**:
   - Does every service have `cap_drop: ALL`?
   - Which services have `cap_add` and are they justified?
   - Are all custom images running as non-root users?
   - Check for `privileged: true` → CRITICAL if found

2. **Image provenance**:
   - Are base images pinned to specific versions (not `latest`)?
   - Are multi-stage builds used to minimize image size?
   - Are there unnecessary tools in production images? (curl, wget, bash)

3. **Resource limits**:
   - Is `mem_limit` set on every service?
   - Is `cpus` limit set?
   - Are restart policies configured? (`restart: unless-stopped`)
   - Check for unbounded resource usage

### Phase 2: Network Segmentation

4. **Network topology**:
   - Verify 3 networks exist: `proxy`, `data`, `ai-services`
   - Verify services are on correct networks (see CLAUDE.md table)
   - Can `rembg` or `crawl4ai` access the `proxy` network? → FAIL if yes
   - Can `caddy` access the `data` network? → FAIL if yes

5. **Port exposure**:
   - In local dev: are all ports bound to `127.0.0.1`?
   - In production: only ports 80/443 exposed via Caddy?
   - Are any debug ports exposed? (Redis 6379, PodClaw 8000 directly)
   - Check for `ports:` vs `expose:` usage

6. **Inter-service communication**:
   - Do services reference each other by service name (not IP)?
   - Is there TLS between services? (usually not needed in Docker network)
   - Are health checks configured for dependency ordering?

### Phase 3: Secret Management

7. **Environment variables**:
   - Is `.env` gitignored?
   - Does each service receive ONLY the vars it needs? (not `env_file:`)
   - Are there any secrets hardcoded in Dockerfiles or compose files?
   - Check for secrets in build args

8. **Secret rotation**:
   - Which secrets need rotation? (API tokens, DB passwords, session keys)
   - Is there a rotation procedure documented?
   - Are secrets shared between services unnecessarily?

9. **`.env.example` completeness**:
   - Does it list ALL required variables?
   - Are `[REQUIRED]` and `[OPTIONAL]` tags present?
   - Are there placeholder values that look like real secrets?

### Phase 4: Reverse Proxy & TLS

10. **Caddy configuration**:
    - Is automatic HTTPS enabled for production?
    - Are routes correctly proxied? (/ → frontend, /panel → admin, /api → podclaw)
    - Is there rate limiting at the proxy level?
    - Are WebSocket connections supported? (for AI streaming)

11. **Security headers**:
    - Does Caddy add security headers? (or is it delegated to Next.js?)
    - Is HSTS configured?
    - Are there redirect rules (HTTP → HTTPS)?

### Phase 5: Deployment & Operations

12. **start.sh robustness**:
    - Does it validate prerequisites before starting?
    - Does it handle partial failures gracefully?
    - Are the 3 startup phases correct? (infra → app → proxy)
    - Does `--clean` properly stop everything?

13. **Health checks**:
    - Does every service have a health check?
    - Are health check intervals reasonable? (not too frequent)
    - Do dependent services wait for health checks? (`depends_on: condition: service_healthy`)

14. **Logging & monitoring**:
    - Is log rotation configured? (json-file driver, 10MB x 3)
    - Are logs structured (JSON)?
    - Is there log aggregation configured?
    - Are there alerts for service failures?

15. **Backup & recovery**:
    - Is there a backup strategy for Redis data?
    - Are Docker volumes persistent and backed up?
    - Is there a disaster recovery procedure?

## Output Format

Generate `AUDIT_INFRASTRUCTURE_[DATE].md` at workspace root with:

```markdown
# Infrastructure Audit — [DATE]

## Service Matrix
| Service | Non-root | Cap drop | Mem limit | Health check | Networks | Status |
|---|---|---|---|---|---|---|

## Summary
- Total checks: X
- PASS: X | WARN: X | FAIL: X | CRITICAL: X

## Critical Findings
[Privilege escalation, exposed secrets, network leaks]

## Recommendations
[Priority-ordered]
```
