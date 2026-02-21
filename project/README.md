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

# 2. Copy and configure environment variables
cp config/.env.required .env
# Edit .env with your actual API keys (see Configuration section)

# 3. Start all services
docker compose -f deploy/docker-compose.yml up -d
```

Once running:

| Service | URL |
|---------|-----|
| Storefront | http://localhost:3000 |
| Admin Panel | http://localhost:3001 |
| PodClaw API | http://localhost:8000/health |

```bash
# View logs
docker compose -f deploy/docker-compose.yml logs -f

# Stop all services
docker compose -f deploy/docker-compose.yml down
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

All services read from environment variables. **Never commit real credentials.**

See [`config/.env.required`](config/.env.required) for the complete variable list with placeholder values.

### Required Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | All | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | All | Supabase service role key |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Public Supabase URL (same as above) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Public anon key |
| `STRIPE_SECRET_KEY` | Frontend, PodClaw | Stripe secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Frontend | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Frontend | Stripe webhook signing secret |
| `PRINTIFY_TOKEN` | Frontend, PodClaw | Printify API token |
| `ANTHROPIC_API_KEY` | PodClaw | Claude API key for agents |
| `GEMINI_API_KEY` | Frontend, PodClaw | Google Gemini API key (embeddings) |
| `FAL_KEY` | Frontend, PodClaw | fal.ai API key (design generation) |
| `RESEND_API_KEY` | Frontend, PodClaw | Resend email API key |

### Optional Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `REDIS_URL` | Frontend, PodClaw | Redis connection string (graceful fallback if absent) |
| `TELEGRAM_BOT_TOKEN` | PodClaw | Telegram bot for admin notifications |
| `WHATSAPP_ACCESS_TOKEN` | PodClaw | WhatsApp Business API token |
| `PODCLAW_BRIDGE_AUTH_TOKEN` | Admin, PodClaw | Bearer token for Bridge API auth |
| `REMBG_URL` | PodClaw | Background removal sidecar URL (default: `http://localhost:7000`) |

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
├── deploy/          Docker Compose, Dockerfiles, Caddyfile
├── supabase/        PostgreSQL migrations (56 tables)
└── config/          Environment variable templates
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

### Production (Docker Compose + Caddy)

Caddy provides automatic HTTPS via Let's Encrypt.

```bash
# Set your domain
export DOMAIN=your-domain.com

# Start production stack
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml up -d
```

This runs:
- **Caddy** on ports 80/443 with automatic TLS
- **Frontend** on port 3000 (proxied at `/`)
- **Admin** on port 3001 (proxied at `/panel`)
- **PodClaw** on port 8000 (proxied at `/api/bridge/*`)
- **rembg** on port 7000 (internal only)
- **Redis** on port 6379 (internal only)

### Health Checks

```bash
curl http://localhost:3000/api/health    # Frontend
curl http://localhost:8000/health        # PodClaw
curl http://localhost:8000/api/health    # PodClaw deep check
```

### Local Development (Docker)

For local development with Docker:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml up -d
```

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

Ensure `.env.local` (frontend/admin) or `.env` (podclaw) exists and has all required variables. The app will fail on startup if critical variables are missing. Check `config/.env.required` for the complete list.

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
docker compose -f deploy/docker-compose.yml logs podclaw
```

### rembg sidecar not responding

The background removal service must be running for design transparency processing.

```bash
curl http://localhost:7000/health
docker compose -f deploy/docker-compose.yml logs rembg
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
