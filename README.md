# POD Platform — AI-Powered Print-on-Demand Store

**A self-hostable, white-label SaaS template for building AI-native print-on-demand stores.**

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

---

## What Is This?

A full-stack platform that combines:

- **Conversational storefront** — customers chat with an AI to browse, customize, and buy products
- **Autonomous agent system** — 7 AI agents (PodClaw) run store operations 24/7 without human intervention
- **Admin dashboard** — real-time monitoring, order management, and analytics
- **MCP server** — exposes 35 store tools to Claude Desktop, ChatGPT, and other AI assistants

Everything is configurable from a single `.env` file. No code changes required to rebrand.

---

## Quick Start (Docker)

> **Requirements:** Docker 24+ and Docker Compose v2+

```bash
# 1. Clone
git clone https://github.com/lroy-stack/podai-store.git
cd podai-store

# 2. Create your config (auto-created on first run)
./start.sh --private
# A .env file is created from .env.example. Edit it with your API keys.
nano .env

# 3. Start
./start.sh --private
```

Once running:

| Service | URL |
|---------|-----|
| Storefront | http://localhost:3000 |
| Admin Panel | http://localhost:3001/panel |
| PodClaw API | http://localhost:8100/health |
| MCP Server | http://localhost:8002/health |

> **Port note:** In local dev (`--private`), PodClaw maps to **8100** (not 8000) because port 8000 is reserved for the Supabase Kong API gateway when using the self-hosted Supabase option.

→ See [`guides/01-quick-start.md`](guides/01-quick-start.md) for step-by-step instructions.

---

## Configuration (White-Label)

All branding, emails, and company info are controlled from `.env`:

```bash
# Core brand identity
NEXT_PUBLIC_SITE_NAME=My Store Name
NEXT_PUBLIC_SITE_TAGLINE=Custom products, made for you
NEXT_PUBLIC_BASE_URL=https://yourdomain.com

# Contact emails
STORE_CONTACT_EMAIL=hello@yourdomain.com
STORE_SUPPORT_EMAIL=support@yourdomain.com

# Company info (used in legal pages + emails)
STORE_COMPANY_NAME=Your Company Name
STORE_COMPANY_ADDRESS=Your Address, City, Country
STORE_DOMAIN=yourdomain.com
```

**No code changes needed.** The entire stack reads from `.env` at runtime.

→ See [`.env.example`](.env.example) for all 50+ configurable variables.

---

## Required API Keys

You need accounts with these services to run the platform:

| Service | Purpose | Get API Key |
|---------|---------|-------------|
| **Supabase** | Database, auth, storage | [supabase.com](https://supabase.com) → free tier available |
| **Stripe** | Payments + webhooks | [stripe.com](https://stripe.com) → test mode available |
| **Printful** | Product fulfillment (storefront + agents) | [printful.com/api](https://www.printful.com/api) → required |
| **Resend** | Transactional + marketing email | [resend.com](https://resend.com) → free tier available |
| **Google Gemini** | AI embeddings for product search | [aistudio.google.com](https://aistudio.google.com) → free tier available |
| **fal.ai** | AI image generation (FLUX.1) | [fal.ai](https://fal.ai) → pay-per-use |
| **Anthropic** | Autonomous agent system | [claude.ai/max](https://claude.ai) → Max plan **or** [console.anthropic.com](https://console.anthropic.com) → API key |

> **Note:** PodClaw supports two authentication modes:
> - **Claude Max plan** (recommended for personal use): run `claude auth login` once — no API key needed.
> - **Anthropic API key** (recommended for VPS/server deploys): set `ANTHROPIC_API_KEY` in `.env`. The Agent SDK picks it up automatically.

---

## Architecture

```
                    ┌──────────────────────┐
                    │    Caddy (80/443)     │
                    │  Reverse Proxy + TLS  │
                    └──────┬───────────────┘
                           │
          ┌────────────────┼──────────────────┐
          │                │                  │
 ┌────────▼──────┐  ┌─────▼──────┐  ┌────────▼────────┐
 │  Frontend      │  │  Admin     │  │  PodClaw Bridge  │
 │  Next.js 16    │  │  Next.js   │  │  FastAPI + 7     │
 │  AI Chat + Shop│  │  Port 3001 │  │  Claude Agents   │
 └────────┬───────┘  └────────────┘  └────────┬────────┘
          │                                    │
          └─────────────┬──────────────────────┘
                        │
              ┌─────────▼──────────┐
              │  Supabase           │
              │  PostgreSQL 16      │   ┌──────────────┐
              │  + pgvector (RAG)   │   │  MCP Server  │
              │  + Auth + RLS       │   │  OAuth 2.1   │
              └─────────────────────┘   │  35 tools    │
                                        └──────────────┘
```

→ See [`ARCHITECTURE.md`](ARCHITECTURE.md) for detailed system design.

---

## Project Structure

```
pod-platform/
├── frontend/              Next.js 16 storefront (chat, shop, checkout)
├── admin/                 Next.js 16 admin dashboard
├── podclaw/               Python autonomous agent system (7 AI agents)
├── mcp-server/            TypeScript MCP server (OAuth 2.1, 35 tools)
├── cloudflare-worker/     Optional Cloudflare Worker MCP proxy
├── deploy/                Dockerfiles, Caddyfile, rembg sidecar
├── supabase/              Database schema + migrations
├── docs/                  Architecture docs and setup guides
├── docker-compose.yml          Base stack (8 services)
├── docker-compose.private.yml  Local dev (127.0.0.1 ports)
├── docker-compose.public.yml   Production (80/443, auto-HTTPS)
├── .env.example                All configurable variables (documented)
└── start.sh                    Orchestration script
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, AI SDK 6 |
| Admin | Next.js 16, TanStack Query/Table, Recharts, iron-session |
| Agents | Python 3.12, Claude Agent SDK, FastAPI, APScheduler |
| MCP Server | TypeScript, Node.js, OAuth 2.1 + PKCE |
| Database | Supabase (PostgreSQL 16 + pgvector + Auth + RLS) |
| Cache | Redis 7 |
| Payments | Stripe (Checkout + Webhooks + Tax) |
| Fulfillment (agents) | Printful API |
| AI: Images | fal.ai (FLUX.1 Schnell) |
| AI: Search | Google Gemini embeddings + pgvector |
| Email | Resend + HTML templates |
| Proxy | Caddy 2.9 (auto-HTTPS + TLS) |

---

## Autonomous Agents (PodClaw)

7 AI agents run your store operations automatically:

| Agent | Schedule | What it does |
|-------|----------|-------------|
| researcher | Daily | Market trends, competitor analysis |
| designer | Daily | AI design generation, mockup creation |
| cataloger | 3×/day | Product CRUD, Printful sync, pricing |
| marketing | 2×/day | Social copy, ad campaigns |
| customer_support | 2×/day | Reviews, refunds, customer emails |
| qa_inspector | After cataloger | Image quality, listing validation |
| finance | Nightly | Revenue reports, anomaly detection |

**Safety controls:** Per-agent budget limits, daily spending cap (configurable), fail-closed security hook, circuit breaker, no shell access.

→ See [`podclaw/SECURITY.md`](podclaw/SECURITY.md) for the full threat model.

---

## Deployment

### Local Development

```bash
./start.sh --private
```

All ports bound to `127.0.0.1`. Auth disabled for easier testing.

### Production

```bash
# 1. Set DOMAIN in .env
DOMAIN=yourdomain.com
NEXT_PUBLIC_BASE_URL=https://yourdomain.com

# 2. Deploy
./start.sh --public
```

Caddy automatically obtains TLS certificates from Let's Encrypt.

### Health Checks

```bash
curl http://localhost:3000/api/health    # Frontend
curl http://localhost:8100/health        # PodClaw (8100 in local dev)
curl http://localhost:8002/health        # MCP Server
```

→ See [`guides/03-deployment.md`](guides/03-deployment.md) for VPS setup, DNS, and Cloudflare.

---

## Database Setup

```bash
# 1. Link to your Supabase project
supabase link --project-ref <your-project-ref>

# 2. Push all migrations
supabase db push
```

---

## Development

```bash
# Frontend
cd frontend && npm run dev        # http://localhost:3000
cd frontend && npm run type-check # TypeScript check
cd frontend && npm test           # Vitest unit tests
cd frontend && npm run test:e2e   # Playwright E2E

# Admin
cd admin && npm run dev           # http://localhost:3001

# PodClaw agents
cd podclaw
source venv/bin/activate
python -m podclaw.main --workspace ../ --dry-run  # Verify config
python -m podclaw.main --workspace ../             # Start
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [`guides/01-quick-start.md`](guides/01-quick-start.md) | Step-by-step first-run guide |
| [`guides/02-env-reference.md`](guides/02-env-reference.md) | All environment variables explained |
| [`guides/03-deployment.md`](guides/03-deployment.md) | VPS, DNS, production deployment |
| [`guides/04-white-label.md`](guides/04-white-label.md) | Branding and customization guide |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System design and data flows |
| [`podclaw/SECURITY.md`](podclaw/SECURITY.md) | Agent security model |

---

## Troubleshooting

**Services not starting:**
```bash
./start.sh --status        # Check health
docker compose logs -f     # View all logs
```

**Port conflicts:**
```bash
lsof -i :3000    # Find process on port
kill -9 <PID>
```

**PodClaw agents not dispatching:**
```bash
curl http://localhost:8100/health    # local dev port (8100, not 8000)
docker compose logs podclaw
# Option A — Claude Max plan: claude auth login
# Option B — API key: ensure ANTHROPIC_API_KEY is set in .env
```

**Environment variables not loaded:**
- Docker: `.env` must exist at project root
- Local dev: use `frontend/.env.local` and `admin/.env.local`

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork → feature branch: `feat/your-feature`
2. Follow existing patterns (shadcn/ui, semantic tokens, next-intl)
3. Test with Playwright: `npm run test:e2e`
4. Commit: `feat: description` / `fix: description`
5. Open PR with description and test plan

---

## License

[MIT License](LICENSE) — free for commercial and non-commercial use.
