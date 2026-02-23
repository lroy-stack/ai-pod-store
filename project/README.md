# POD AI Store

**Autonomous AI-powered print-on-demand platform with conversational storefront.**

![Node](https://img.shields.io/badge/node-22-339933?logo=node.js&logoColor=white)
![Python](https://img.shields.io/badge/python-3.12-3776AB?logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)
![License](https://img.shields.io/badge/license-proprietary-red)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Manual Installation](#manual-installation)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [PodClaw Agents](#podclaw-agents)
- [Deployment](#deployment)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Conversational Storefront** — The chat IS the store. Three-panel UI with AI-driven product search, design generation, and checkout via 22 tool-augmented interactions.
- **10 Autonomous Agents (PodClaw)** — Claude-powered agents manage research, design, cataloging, marketing, newsletters, customer support, SEO, finance, quality assurance, and brand compliance on configurable schedules.
- **AI Design Generation** — On-demand custom designs via fal.ai (FLUX.1) with automatic background removal (rembg sidecar).
- **Multi-Language** — Full i18n support for English, Spanish, and German with locale-aware routing, emails, and voice input.
- **Full Ecommerce** — Cart, wishlists, Stripe checkout with tax calculation, Printify fulfillment, order tracking, and return management.
- **RAG Semantic Search** — Google Gemini embeddings (768-dim) stored in pgvector for intelligent product discovery.
- **Self-Hostable** — Single `docker compose up` deploys the entire platform with Caddy reverse proxy and automatic HTTPS.
- **Admin Dashboard** — Real-time agent monitoring, order management, customer analytics, and schedule control.

---

## Architecture

```
                        ┌──────────────────────┐
                        │    Caddy (80/443)     │
                        │  Reverse Proxy + TLS  │
                        └──────┬───────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼──────┐  ┌─────▼──────┐  ┌──────▼──────────┐
     │  Frontend      │  │  Admin     │  │  PodClaw Bridge  │
     │  Next.js 16    │  │  Next.js   │  │  FastAPI         │
     │  Port 3000     │  │  Port 3001 │  │  Port 8000       │
     └────────┬───────┘  └─────┬──────┘  └──────┬───────────┘
              │                │                 │
              └────────┬───────┘          ┌──────▼───────────┐
                       │                  │  10 Claude Agents │
              ┌────────▼────────┐         │  (APScheduler)    │
              │  Supabase Cloud │         └──────┬───────────┘
              │  PostgreSQL 16  │                 │
              │  + pgvector     │         ┌──────┴───────────┐
              │  + Auth + RLS   │         │  Services         │
              └─────────────────┘         │  rembg    (7000) │
                                          │  Redis    (6379) │
                                          └──────────────────┘
                                                 │
                                    ┌────────────┴────────────┐
                                    │  External APIs           │
                                    │  Stripe  Printify        │
                                    │  fal.ai  Gemini  Resend  │
                                    │  Telegram  WhatsApp      │
                                    └──────────────────────────┘
```

---

## Quick Start

> Requires: [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

```bash
# 1. Clone the repository
git clone <repository-url>
cd project

# 2. Start (first run creates .env from template)
./start.sh
# Edit .env with your real API keys, then run again:
./start.sh
```

The `start.sh` script handles everything: validates prerequisites, creates `.env` from `.env.example` on first run, checks required variables, builds images, and starts services in the correct order.

Once running:

| Service | Direct URL | Via Caddy |
|---------|------------|-----------|
| Storefront | http://localhost:3000 | http://localhost:8080 |
| Admin Panel | http://localhost:3001/panel | http://localhost:8080/panel |
| PodClaw API | http://localhost:8000/health | http://localhost:8080/api/bridge/health |
| MCP Server | http://localhost:8002/health | http://localhost:8080/mcp |

```bash
# View logs
docker compose logs -f

# Show service status
./start.sh --status

# Stop all services
./start.sh --down

# Build images only (no start)
./start.sh --build

# Clean up Docker resources
./start.sh --clean
```

---

## Manual Installation

### Prerequisites

- Node.js 22+ (LTS)
- Python 3.12+
- Git
- Supabase account ([supabase.com](https://supabase.com))

### 1. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local — see Configuration section
npm run dev
# Runs on http://localhost:3000
```

### 2. Admin Panel

```bash
cd admin
npm install
cp .env.example .env.local
# Edit .env.local
npm run dev
# Runs on http://localhost:3001
```

### 3. PodClaw Agent

```bash
cd podclaw
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env

# Verify setup
python3 -m podclaw.main --workspace ../ --dry-run

# Start
python3 -m podclaw.main --workspace ../
# Bridge API on http://localhost:8000
```

### 4. Database

Supabase runs as a **remote cloud instance** — no local database needed.

```bash
# Link to your Supabase project
supabase link --project-ref <your-project-ref>

# Push all migrations (56 tables)
supabase db push
```

---

## Configuration

All services read from a **single `.env` file** at the project root. **Never commit real credentials.**

```bash
cp .env.example .env
# Edit .env with your real values
```

See [`.env.example`](.env.example) for the complete variable list with `[REQUIRED]`/`[OPTIONAL]` tags and service ownership annotations.

### Required Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | frontend, podclaw, mcp-server | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | frontend, podclaw, mcp-server | Supabase service role key |
| `SUPABASE_ANON_KEY` | frontend, mcp-server | Supabase anon key |
| `STRIPE_SECRET_KEY` | frontend, podclaw | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | frontend | Stripe webhook signing secret |
| `PRINTIFY_API_TOKEN` | podclaw | Printify API token |
| ~~ANTHROPIC_API_KEY~~ | — | Not needed: PodClaw uses Claude SDK OAuth (Max Plan) |
| `GEMINI_API_KEY` | podclaw | Google Gemini API key |
| `FAL_KEY` | podclaw | fal.ai API key (design generation) |
| `RESEND_API_KEY` | frontend, podclaw | Resend email API key |
| `REDIS_PASSWORD` | frontend, podclaw, mcp-server, redis | Redis authentication |
| `PODCLAW_BRIDGE_AUTH_TOKEN` | admin, podclaw | Bridge API auth token |

### Build-time Variables (NEXT_PUBLIC_)

These are baked into JS bundles at `docker compose build` time:

| Variable | Used by | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | frontend, admin | Public Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | frontend, admin | Public anon key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | frontend | Stripe publishable key |
| `NEXT_PUBLIC_BASE_URL` | frontend | Site base URL |

### Optional Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | podclaw | Telegram bot for admin notifications |
| `WHATSAPP_ACCESS_TOKEN` | podclaw | WhatsApp Business API token |
| `TURNSTILE_SECRET_KEY` | frontend | Cloudflare Turnstile CAPTCHA |
| `DOMAIN` | caddy | Production domain (enables auto-HTTPS) |

---

## Project Structure

```
project/
├── frontend/        Next.js 16 storefront — React 19, Tailwind v4, AI SDK 6
├── admin/           Next.js 16 admin dashboard — TanStack Query/Table, Recharts
├── podclaw/         Python autonomous agent system — Claude Agent SDK, FastAPI
│   ├── agents/      Agent definitions and configuration
│   ├── bridge/      FastAPI HTTP API (port 8000)
│   ├── connectors/  MCP connectors (Printify, Supabase, Stripe, etc.)
│   ├── hooks/       PreToolUse/PostToolUse hooks (security, rate limits, costs)
│   ├── skills/      Per-agent skill prompts and templates
│   └── scripts/     Reconciliation and maintenance scripts
├── deploy/          Dockerfiles, Caddyfile, rembg sidecar
├── supabase/        PostgreSQL migrations (56 tables)
├── docker-compose.yml        Base compose (8 services)
├── docker-compose.local.yml  Local dev override (127.0.0.1 ports)
├── docker-compose.prod.yml   Production override (80/443, auth)
├── .env.example              Environment variable template
└── start.sh                  Docker orchestration script
```

---

## PodClaw Agents

PodClaw orchestrates 10 autonomous agents with configurable schedules, budgets, and tool permissions.

| Agent | Model | Schedule (UTC) | Role |
|-------|-------|----------------|------|
| researcher | Haiku | 06:00 | Market trends, competitor analysis, niche discovery |
| designer | Sonnet | 07:00 | AI design generation, mockup creation |
| cataloger | Sonnet | 08:00, 14:00, 18:00 | Product CRUD, Printify sync, pricing |
| marketing | Sonnet | 09:00, 15:00 | Social media, ad copy, campaign management |
| newsletter | Sonnet | 10:00, 17:00 | Email campaigns via Resend |
| customer_manager | Sonnet | 12:00, 22:00 | Reviews, retention, support, refunds |
| seo_manager | Haiku | Sunday 16:00 | Meta tags, sitemaps, search optimization |
| finance | Sonnet | 23:00 | Revenue reports, anomaly detection |
| qa_inspector | Haiku | After cataloger | Image quality checks, listing validation |
| brand_manager | Sonnet | After cataloger | Brand consistency, neck labels, style audit |

**Safety controls:** Per-session budget limits, daily spending caps (total EUR 30.15/day), rate-limited tool calls, fail-closed security hook, and circuit breaker (3+ errors in 24h blocks dispatch). See [`podclaw/SECURITY.md`](podclaw/SECURITY.md) for the full threat model.

---

## Deployment

### Docker Stack Overview

The stack runs 8 services on 3 isolated networks:

```
proxy network:       caddy <-> frontend, admin, podclaw, mcp-server
data network:        frontend, podclaw, mcp-server <-> redis
ai-services network: podclaw <-> rembg, crawl4ai
```

| Service | Port | Description |
|---------|------|-------------|
| frontend | 3000 | Next.js 16 storefront |
| admin | 3001 | Admin panel (proxied at `/panel`) |
| podclaw | 8000 | Agent system + FastAPI bridge |
| mcp-server | 8002 | MCP server for AI assistants |
| rembg | 8080 | Background removal (internal only) |
| redis | 6379 | Session cache, rate limiting (internal only) |
| crawl4ai | 11235 | Web crawler with JS rendering (internal only) |
| caddy | 80/443 | Reverse proxy with auto-HTTPS |

### Production

```bash
# Set DOMAIN in .env, then:
./start.sh --prod
```

Caddy automatically obtains TLS certificates from Let's Encrypt. Routes:
- `/` -> frontend
- `/panel` -> admin
- `/api/bridge/*` -> podclaw (auth required)
- `/mcp` -> mcp-server

### Local Development (Docker)

```bash
./start.sh --local    # or just ./start.sh
```

All debug ports bound to `127.0.0.1`. PodClaw bridge auth disabled for easier testing.

### Manual (without start.sh)

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d   # production
```

### Health Checks

```bash
curl http://localhost:3000/api/health          # Frontend
curl http://localhost:3001/panel/api/health     # Admin
curl http://localhost:8000/health               # PodClaw
curl http://localhost:8002/health               # MCP Server
```

### Security Hardening

- `cap_drop: ALL` on every container (selective `cap_add` only where needed)
- Non-root users in all custom images
- Each service receives only the environment variables it needs
- rembg and crawl4ai have zero secrets (isolated network)
- Redis destructive commands disabled (`FLUSHALL`, `FLUSHDB`, `DEBUG`, `CONFIG`)
- Log rotation: 10MB x 3 files per service
- Local dev: all ports bound to `127.0.0.1`

---

## Development

### Frontend

```bash
cd frontend
npm run dev          # Dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check
```

### Admin

```bash
cd admin
npm run dev          # Dev server
npm run build        # Production build
```

### PodClaw

```bash
cd podclaw
source venv/bin/activate
python3 -m podclaw.main --workspace ../ --dry-run   # Verify config
python3 -m podclaw.main --workspace ../              # Start orchestrator
```

### Database Migrations

```bash
supabase migration new <name>     # Create new migration
supabase db push                  # Push to remote
supabase migration list           # Check status
```

### Tests

```bash
cd frontend
npm test                          # Unit tests
npx playwright test               # E2E tests
```

---

## Troubleshooting

### Port already in use

```bash
lsof -i :3000    # Check which process holds the port
kill -9 <PID>    # Free the port
```

### Environment variables not loaded

For Docker: ensure `.env` exists at the project root with all required variables. Run `./start.sh` to auto-create from `.env.example`. For local dev without Docker: use `frontend/.env.local` and `admin/.env.local`.

### Supabase connection errors

```bash
# Verify your project ref and keys
supabase projects list
supabase migration list    # Should show 64 migrations
```

### PodClaw agents not starting

```bash
# Check Bridge API health
curl http://localhost:8000/health

# Check agent status
curl -H "Authorization: Bearer $PODCLAW_BRIDGE_AUTH_TOKEN" \
  http://localhost:8000/agents

# Review logs
docker compose logs podclaw
```

### rembg sidecar not responding

The background removal service must be running for design transparency processing.

```bash
curl http://localhost:8090/health    # mapped port in local dev
docker compose logs rembg
```

### Docker build failures

```bash
# Clean up failed builds (frees disk space)
./start.sh --clean

# Rebuild from scratch
./start.sh --build
```

---

## Contributing

1. Create a feature branch: `feat/feature-name` or `fix/issue-description`
2. Follow existing code patterns (shadcn/ui components, semantic tokens, next-intl)
3. Test through browser UI and verify with Playwright
4. Commit format: `feat: description` or `fix: description`

---

## License

Proprietary — All rights reserved.
