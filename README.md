# AI POD Store — early working copy of Skapara

**Live:** https://skapara.com

An AI-native print-on-demand store: customers discover and buy products through a chat, and autonomous agents run
store operations. This repository is the earlier working copy, February to May 2026, and still contains the audit
notes and helper scripts from that work. The cleaned-up, white-label version is `skapara`.

## What it does

- Conversational storefront (Next.js) with product search, customisation and checkout.
- Admin dashboard.
- PodClaw, a Python agent system on the Claude Agent SDK: researcher, designer, cataloger, marketing, customer
  manager, QA inspector, finance, newsletter, SEO manager and brand manager (`project/podclaw/agents/`).
- MCP server (`project/mcp-server/`) exposing store tools to AI assistants.
- Supabase schema and migrations.

## Built with

Next.js 16, React 19, Tailwind CSS 4, AI SDK 6, Python, FastAPI, Supabase (PostgreSQL), Stripe, Printify,
Docker Compose.

## Run it locally

Requires Docker. Copy `project/.env.example` to `project/.env` and add your own keys.

```bash
cd project
./start.sh              # local development
./start.sh --status     # service health
./start.sh --down       # stop
```

Storefront checks, from `project/frontend`: `npm run dev`, `npm run type-check`, `npm test`, `npm run test:e2e`.

## Layout

```
project/            the application: frontend, admin, podclaw, mcp-server, cloudflare-worker, supabase, deploy, docs
supabase/           database migrations
memory/             sample context files used by the agents
brandi/             brand assets
*.py *.md           one-off scripts and audit notes from development
```

No licence file is included, so all rights are reserved.

---

Versión en español: copia de trabajo anterior de Skapara, una tienda de impresión bajo demanda con chat de IA y
agentes autónomos. La versión limpia está en el repositorio `skapara`.
