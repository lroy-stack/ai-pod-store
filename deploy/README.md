# POD AI — Deployment Guide

Complete self-hosted Print-on-Demand platform with AI agent system. This stack runs on a single VPS with Docker Compose.

---

## Hardware Requirements

### Minimum VPS Specification

**Required:**
- **4GB RAM** (minimum)
- **2GB Swap** (strongly recommended)
- **20GB SSD** storage
- **2 vCPUs** (minimum)

**Recommended for Production:**
- **8GB RAM** + **4GB Swap**
- **40GB SSD** storage
- **4 vCPUs**

### Why 4GB RAM + 2GB Swap?

The Docker Compose stack runs 8 services with a total memory budget of **~3GB** (see table below). This leaves:
- **~1GB** for OS overhead (kernel, networking, SSH, monitoring)
- **2GB swap** for burst traffic and container restarts

**Without swap**, the OOM killer will terminate services under load. **2GB swap is mandatory for a 4GB VPS**.

---

## Docker Service Memory Allocation

All services have explicit `mem_limit` under `deploy.resources.limits.memory` in `docker-compose.yml`:

| Service | Memory Limit | Reservation | Purpose |
|---------|--------------|-------------|---------|
| **frontend** | 384M | 256M | Next.js 16 storefront (port 3000) |
| **admin** | 256M | 128M | Next.js 16 admin panel (port 3001) |
| **podclaw** | 512M | 256M | Python agent system + FastAPI bridge (port 8000) |
| **rembg** | 512M | 384M | Background removal sidecar with u2net (port 8080) |
| **redis** | 256M | 128M | Session cache, rate limiting, queues (port 6379) |
| **crawl4ai** | 768M | 384M | Web crawler with Playwright + Chromium (port 11235) |
| **mcp-server** | 256M | 128M | MCP server for AI assistant tools (port 8002) |
| **caddy** | 64M | 32M | Reverse proxy with automatic HTTPS (ports 80, 443) |
| **TOTAL** | **3,008M** | **1,676M** | **~3GB total budget** |

**Reservations** guarantee minimum memory (soft limit). **Limits** are hard caps enforced by Docker.

### Memory Budget Breakdown

On a **4GB VPS**:
```
Total RAM:        4,096 MB (4GB)
OS overhead:      ~1,024 MB (~1GB)  — kernel, networking, SSH, docker daemon
Docker services:  ~3,008 MB (~3GB)  — all 8 containers
Swap usage:       0–2,048 MB        — for bursts and restarts
```

**Safe operation requires 2GB swap.**

---

## Service Architecture

### Services Overview

```
Internet
   ↓
Caddy (reverse proxy, HTTPS termination)
   ├─→ frontend:3000    (Next.js storefront)
   ├─→ admin:3001       (Next.js admin panel)
   ├─→ podclaw:8000     (Agent system + FastAPI bridge)
   └─→ mcp-server:8002  (MCP tools for ChatGPT/Claude)

Internal network (no external exposure):
   ├─→ redis:6379       (session cache, rate limits)
   ├─→ rembg:8080       (background removal service)
   └─→ crawl4ai:11235   (web crawler with JavaScript rendering)

External (cloud-managed):
   └─→ Supabase         (PostgreSQL + Auth + Storage)
```

### Service Dependencies

All services depend on:
- **Redis** (required for sessions, caching, rate limiting)
- **Supabase Cloud** (PostgreSQL database + Auth)

Service health checks ensure correct startup order:
1. Redis starts first (no dependencies)
2. rembg and podclaw start (depend on Redis)
3. frontend, admin, mcp-server start (depend on Redis + podclaw)
4. Caddy starts last (depends on all upstream services)

---

## Docker Compose Files

This deployment uses a **layered override** system:

| File | Purpose | Usage |
|------|---------|-------|
| `docker-compose.yml` | Base configuration (production defaults) | Always included |
| `docker-compose.local.yml` | Local dev overrides (exposed ports, hot reload) | Dev only |
| `docker-compose.prod.yml` | Production hardening (stricter limits, logging) | Production only |

### Commands

**Local development** (Docker Desktop):
```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml up -d
docker compose logs -f
```

**Production** (VPS):
```bash
# First time: configure swap (see below)
# Then deploy:
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml up -d
docker compose logs -f --tail=100
```

**Individual service restart**:
```bash
docker compose restart frontend
docker compose logs frontend -f
```

**Stop all services**:
```bash
docker compose down
```

**Stop and remove volumes** (⚠️ deletes all data):
```bash
docker compose down -v
```

---

## Configuring Swap on a VPS

If your VPS doesn't have swap, create a **2GB swap file**:

```bash
# Check current swap
free -h

# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent (add to /etc/fstab)
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
free -h
# Should show 2GB swap
```

**Why 2GB?** Matches RAM budget. Allows graceful degradation under load instead of OOM kills.

---

## Memory Tuning

### Increasing Memory for a Service

Edit `docker-compose.yml` or create a custom override file:

```yaml
# docker-compose.custom.yml
services:
  frontend:
    deploy:
      resources:
        limits:
          memory: 512M  # Increase from 384M
```

Then deploy with:
```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.custom.yml up -d
```

### Redis Memory Policy

Redis is configured with:
- `maxmemory 256mb` — hard cap (matches mem_limit)
- `maxmemory-policy allkeys-lru` — evicts least-recently-used keys when full

To adjust Redis memory, edit `docker-compose.yml` line 169 **and** line 176 (mem_limit).

### Crawl4AI Memory Notes

Crawl4AI uses **768M** (highest mem_limit) because:
- Playwright + Chromium browser instance (~512M)
- JavaScript rendering memory (~256M)
- Set `MAX_CONCURRENT_TASKS=1` to prevent memory spikes

If you need more concurrent crawls, increase to **1GB**:
```yaml
crawl4ai:
  environment:
    MAX_CONCURRENT_TASKS: "2"
  deploy:
    resources:
      limits:
        memory: 1024M
```

---

## Monitoring Memory Usage

**View real-time stats**:
```bash
docker stats
```

**Check memory for a specific service**:
```bash
docker stats frontend --no-stream
```

**Check system memory and swap**:
```bash
free -h
```

**Top processes by memory** (host):
```bash
top -o %MEM
```

---

## Health Checks

All services have health checks with:
- **interval**: 30s (check every 30 seconds)
- **timeout**: 10s (fail if response takes > 10s)
- **start_period**: 15–60s (grace period on startup)
- **retries**: 3 (unhealthy after 3 consecutive failures)

**View health status**:
```bash
docker compose ps
```

**Check specific service health**:
```bash
curl http://localhost:3000/api/health  # frontend
curl http://localhost:3001/panel/api/health  # admin
curl http://localhost:8000/health  # podclaw
curl http://localhost:8002/health  # mcp-server
```

---

## Troubleshooting

### Service Keeps Restarting (OOM Killed)

**Symptom**: Docker logs show `exit code 137`

**Cause**: Out of memory (mem_limit exceeded)

**Solution**:
1. Check memory usage: `docker stats`
2. Increase mem_limit for the service (see "Memory Tuning")
3. Add swap if not configured (see "Configuring Swap")

### Redis Connection Refused

**Symptom**: `Error: connect ECONNREFUSED redis:6379`

**Cause**: Redis not healthy yet

**Solution**:
```bash
docker compose logs redis
docker compose restart redis
```

### Caddy Won't Start (503 Bad Gateway)

**Symptom**: Caddy health check fails

**Cause**: Upstream service (frontend, admin, etc.) not healthy

**Solution**:
```bash
# Check which service is unhealthy
docker compose ps

# View logs for unhealthy service
docker compose logs [service-name]
```

### Services Start But System Freezes Under Load

**Symptom**: SSH becomes unresponsive, high `%wa` (iowait) in `top`

**Cause**: No swap configured, memory pressure causing disk thrashing

**Solution**: Add 2GB swap (see "Configuring Swap on a VPS")

---

## Production Hardening Checklist

Before deploying to production:

- [ ] Configure **2GB swap** on VPS
- [ ] Set `REDIS_PASSWORD` in environment
- [ ] Set `DOMAIN` for HTTPS (Caddy auto-issues Let's Encrypt cert)
- [ ] Configure all API keys in `frontend/.env.local` and `admin/.env.local`
- [ ] Verify all health checks pass: `docker compose ps`
- [ ] Configure firewall (allow 80, 443; block 3000, 3001, 8000, 8002, 6379)
- [ ] Set up log rotation (Docker JSON logs can fill disk)
- [ ] Monitor memory usage: `docker stats`

---

## Updating the Stack

**Pull latest images**:
```bash
git pull
docker compose -f deploy/docker-compose.yml pull
```

**Rebuild and restart**:
```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

**View recent logs**:
```bash
docker compose logs -f --tail=100
```

---

## Further Documentation

- **Caddyfile**: `deploy/Caddyfile` — reverse proxy config
- **PodClaw Agent**: `podclaw/README.md` — agent system docs
- **MCP Server**: `mcp-server/CLAUDE.md` — MCP tools reference
- **Crawl4AI**: `crawl4ai/README.md` — web crawler setup
- **Cloudflare Setup**: `deploy/CLOUDFLARE-SETUP.md` — WAF + Turnstile config

---

## License

MIT License — See LICENSE file in project root.
