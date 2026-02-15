# POD AI — Print-on-Demand AI Platform

A 100% AI-managed Print-on-Demand ecommerce platform with conversational storefront powered by PodClaw autonomous agent.

## Features

- 🤖 **Conversational AI Storefront** — Chat-first shopping experience with real-time product search, design generation, and checkout
- 🎨 **AI Design Generation** — FLUX.1 via fal.ai creates custom designs on-demand
- 🛍️ **Full Ecommerce** — Cart, wishlist, checkout, payments (Stripe), order tracking
- 🌍 **Multi-language** — EN/ES/DE with next-intl routing
- 🔍 **RAG Pipeline** — Google Gemini embeddings + pgvector semantic search
- 📦 **Print-on-Demand** — Printify integration for product fulfillment
- 🔐 **Social Auth** — Google OAuth + Apple Sign-In via Supabase Auth
- 📊 **Analytics** — Python-based RFM, cohort, demand forecasting
- 🧠 **PodClaw Agent** — Autonomous store manager (8 sub-agents: researcher, cataloger, designer, customer_manager, finance, seo_manager, marketing, newsletter)
- 📱 **PWA** — Offline mode with IndexedDB catalog cache
- 🎯 **A/B Testing** — Edge Middleware variant assignment
- 🔊 **Voice Input** — Web Speech API (locale-aware)
- 📸 **Image Upload** — Multimodal chat with image analysis
- 📧 **Email** — Transactional emails via Resend (locale-aware templates)

## Tech Stack

### Frontend
- **Next.js 16.1.6** — App Router, Turbopack, React Compiler, PPR, `use cache`
- **React 19.2** — View Transitions, useEffectEvent, Activity API
- **Tailwind CSS v4** — Semantic design tokens
- **shadcn/ui** — Component library
- **next-intl** — i18n with `[locale]` prefix routing
- **AI SDK 6** — ToolLoopAgent, streaming, artifacts

### Backend & Infrastructure
- **Supabase** — PostgreSQL + pgvector + RLS + Auth (remote cloud instance)
- **Redis** — Sessions, semantic cache, translation cache (optional — graceful fallback)
- **Stripe** — Payments + Tax + webhooks
- **Printify** — Product fulfillment + webhooks
- **Google Gemini** — 768-dim embeddings (gemini-embedding-001)
- **fal.ai** — FLUX.1 design generation
- **Resend** — Transactional emails

### PodClaw Autonomous Agent
- **Python 3.11+** — Claude Agent SDK (NanoClaw fork)
- **FastAPI** — Bridge API (port 8000) for admin dashboard
- **APScheduler** — Daily cycle automation (06:00-23:30 UTC)
- **8 Sub-Agents** — Each with specialized tools and daily schedules

## Project Structure

```
project/
├── frontend/          # Next.js 16 storefront (port 3000)
│   ├── src/
│   │   ├── app/       # App Router pages & API routes
│   │   ├── components/ # React components
│   │   └── lib/       # Server utilities
│   ├── messages/      # i18n translations (en/es/de)
│   └── public/        # Static assets
├── admin/             # Next.js 16 admin panel (port 3001, English-only)
│   └── src/
│       ├── app/       # Admin pages & API routes
│       └── components/
├── podclaw/           # Python autonomous agent
│   ├── main.py        # Entry point + scheduler
│   ├── core.py        # Orchestrator
│   ├── agents/        # 8 sub-agent definitions
│   ├── mcp/           # SDK in-process MCP connectors
│   └── bridge/        # FastAPI bridge (port 8000)
└── supabase/          # Database migrations
    └── migrations/
```

## Prerequisites

- **Node.js 18+** (Node 20+ recommended)
- **Python 3.11+**
- **Git**
- **Supabase account** (cloud instance)
- **API Keys**:
  - Supabase (URL + Service Key + Anon Key)
  - Stripe (Secret Key + Publishable Key + Webhook Secret)
  - Printify (Token)
  - Google Gemini (API Key)
  - fal.ai (API Key)
  - Resend (API Key)
  - Optional: Redis (URL)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd pod-agent-harness/pod_workspace/project
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Install Admin Panel Dependencies

```bash
cd ../admin
npm install
```

### 4. Install PodClaw Dependencies

```bash
cd ../podclaw
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 5. Configure Environment Variables

Create `.env.local` files:

**Frontend** (`frontend/.env.local`):
```bash
# Supabase (Remote Cloud)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Printify
PRINTIFY_TOKEN=your_token_here

# Google Gemini
GEMINI_API_KEY=your_api_key_here

# fal.ai
FAL_KEY=your_key_here

# Resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@podai.com

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# App Config
NEXT_PUBLIC_BASE_URL=https://podai.com
NODE_ENV=development
```

**Admin** (`admin/.env.local`):
```bash
# Same Supabase credentials as frontend
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here

# PodClaw Bridge
PODCLAW_BRIDGE_URL=http://localhost:8000
```

**PodClaw** (`podclaw/.env`):
```bash
# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Supabase (same as frontend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here

# External APIs
STRIPE_SECRET_KEY=sk_test_...
PRINTIFY_TOKEN=your_token_here
FAL_KEY=your_key_here
GEMINI_API_KEY=your_api_key_here
RESEND_API_KEY=re_...

# Telegram (Optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# WhatsApp (Optional)
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_ACCESS_TOKEN=your_token
```

### 6. Setup Database

**Supabase is a REMOTE CLOUD instance** — no local database needed.

```bash
cd project
supabase link --project-ref yehvotdnhcwxjjpcznrf
supabase db push
```

This pushes all migrations to the remote Supabase instance. 24 tables will be created.

## Running the Application

### Quick Start (All Services)

From the `project/` directory:

```bash
bash init.sh
```

This starts:
- Frontend (port 3000) — `npm run dev` in frontend/
- Admin panel (port 3001) — `npm run dev` in admin/
- PodClaw agent (port 8000) — `python3 -m podclaw.main --workspace ../`

### Individual Services

**Frontend Storefront:**
```bash
cd frontend
npm run dev
# Access: http://localhost:3000
```

**Admin Panel:**
```bash
cd admin
npm run dev
# Access: http://localhost:3001
```

**PodClaw Agent:**
```bash
cd podclaw
python3 -m podclaw.main --workspace ../../
# Bridge API: http://localhost:8000
```

**Dry-run PodClaw (verify setup):**
```bash
cd podclaw
python3 -m podclaw.main --workspace ../../ --dry-run
```

## Development Workflow

### Frontend Development

```bash
cd frontend
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check
```

### Database Migrations

```bash
cd project
supabase migration new <migration_name>  # Create new migration
supabase db push                          # Push to remote
supabase migration list                   # Check status
```

### Testing

```bash
cd frontend
npm test             # Run tests
npm run test:e2e     # Playwright E2E tests
```

## Architecture Overview

### Conversational Storefront (PRIMARY INTERFACE)

The homepage (`/[locale]/`) IS the three-panel conversational storefront:

- **Left Sidebar** — Store navigation + AI-curated recommendations (adaptive based on DataPart streaming)
- **Center Panel** — Chat interface with 22 AI tools, streaming SSE, artifact components
- **Right Panel** — Detail view (expands when artifact clicked)

**NOT** a traditional ecommerce site with a chat widget. The chat IS the store.

### Chat Tools (22 total)

1. `search_products` → ProductGridArtifact
2. `browse_catalog` → ProductGridArtifact
3. `get_product_details` → ProductCardArtifact
4. `compare_products` → ComparisonTableArtifact
5. `get_recommendations` → ProductGridArtifact
6. `get_size_guide` → SizeGuideArtifact
7. `add_to_cart` → CartSummaryArtifact
8. `get_cart` → CartSummaryArtifact
9. `update_cart_quantity` → CartSummaryArtifact
10. `remove_from_cart` → CartSummaryArtifact
11. `apply_coupon` → CartSummaryArtifact
12. `estimate_shipping` → PricingTableArtifact
13. `create_checkout` (needsApproval) → ApprovalCardArtifact
14. `track_order` → OrderTimelineArtifact
15. `get_order_history` → OrderListArtifact
16. `request_return` (needsApproval) → ApprovalCardArtifact
17. `generate_design` → DesignPreviewArtifact
18. `customize_design` → DesignPreviewArtifact
19. `add_to_wishlist` → ConfirmationArtifact
20. `get_store_policies` → PolicyArtifact
21. `switch_language` → ConfirmationArtifact
22. `analyze_image` → AnalysisArtifact

### PodClaw Agent (8 Sub-Agents)

| Agent | Model | Schedule | Purpose |
|-------|-------|----------|---------|
| researcher | Haiku | 06:00 | Market trends, competitor analysis |
| designer | Sonnet | 07:00 | AI design generation |
| cataloger | Sonnet | 08:00, 14:00, 18:00 | Product CRUD, Printify sync |
| marketing | Sonnet | 09:00, 15:00 | Social media, campaigns |
| newsletter | Sonnet | 10:00, 17:00 | Email campaigns |
| customer_manager | Sonnet | 12:00, 22:00 + continuous | Reviews, retention, chat |
| seo_manager | Haiku | Sunday 16:00 | SEO, meta tags, sitemaps |
| finance | Sonnet | 23:00 | Revenue reports, anomaly detection |

**Bridge API** (port 8000):
- `GET /status` — Overall status
- `GET /agents` — All agents with tools
- `GET /events` — Query agent_events table
- `GET /schedule` — Scheduled jobs
- `POST /agents/{name}/run` — Trigger manually

## API Routes

### Storefront (`frontend/src/app/api/`)

- `/api/health` — Health check
- `/api/chat` — AI chat (ToolLoopAgent, SSE streaming)
- `/api/products` — Product catalog
- `/api/cart/*` — Shopping cart
- `/api/checkout/*` — Stripe checkout
- `/api/webhooks/stripe` — Stripe webhooks
- `/api/webhooks/printify` — Printify webhooks
- `/api/rag/*` — RAG search + indexing
- `/api/designs/*` — AI design generation
- `/api/auth/*` — Supabase Auth
- `/api/wishlist/*` — Wishlist CRUD

### Admin (`admin/src/app/api/`)

- `/api/agent/*` — PodClaw bridge proxy (catch-all)
- `/api/analytics/*` — Python analytics endpoints
- `/api/orders/*` — Order management
- `/api/customers/*` — Customer management

## Database Schema (24 Tables)

**Core:**
- `users` — User accounts (auth)
- `user_profiles` — Extended profile data
- `shipping_addresses` — User shipping addresses

**Products:**
- `products` — Product catalog (base_price_cents, currency, images JSONB)
- `product_variants` — SKUs, sizes, colors
- `reviews` — Product reviews

**Orders:**
- `orders` — Order records
- `order_items` — Line items
- `returns` — Return requests

**Cart & Wishlist:**
- `cart_items` — Shopping cart (session-based)
- `wishlists` — Named wishlists
- `wishlist_items` — Products in wishlists

**AI & RAG:**
- `documents` — RAG corpus (embedding vector<768>, locale)
- `designs` — AI-generated designs
- `chat_sessions` — Chat history

**Payments:**
- `coupons` — Discount codes
- `stripe_events` — Webhook event log

**Agent:**
- `agent_events` — Event sourcing (agent_name, session_id, data JSONB)
- `agent_daily_costs` — Cost tracking
- `agent_memory` — Daily memory logs

**Notifications:**
- `notifications` — User notifications
- `audit_log` — System audit trail

**i18n & A/B:**
- `translations` — Dynamic translations
- `ab_experiments` — A/B test definitions
- `ab_assignments` — Variant assignments

## Deployment

### Prerequisites
- Vercel account (or other Next.js host)
- Supabase cloud instance (already configured)
- Redis cloud instance (optional — app works without it)

### Frontend Deployment

```bash
cd frontend
npm run build
# Deploy to Vercel or:
npm start  # Production server
```

### PodClaw Deployment

```bash
cd podclaw
# Option 1: systemd service
sudo cp podclaw.service /etc/systemd/system/
sudo systemctl enable podclaw
sudo systemctl start podclaw

# Option 2: Docker
docker build -t podclaw .
docker run -d --env-file .env -p 8000:8000 podclaw
```

## Environment Variables Reference

See `config/.env.required` for the complete list of required environment variables.

**CRITICAL:**
- All Supabase vars point to the REMOTE CLOUD instance (not local)
- Redis is optional — app works without it (graceful fallback)
- `NEXT_PUBLIC_BASE_URL` must be `https://podai.com` (production) or `http://localhost:3000` (dev)
- Email sender must use `RESEND_FROM_EMAIL` (no hardcoded domains)

## Troubleshooting

### Dev Server Won't Start

```bash
# Check port availability
lsof -i :3000  # Frontend
lsof -i :3001  # Admin
lsof -i :8000  # PodClaw

# Kill existing processes
kill -9 <PID>

# Restart
cd project && bash init.sh
```

### Supabase Connection Errors

```bash
# Verify credentials
grep SUPABASE_URL frontend/.env.local

# Test connection
curl -H "apikey: YOUR_ANON_KEY" \
  "https://your-project.supabase.co/rest/v1/"

# Check migration status
cd project
supabase migration list
```

### PodClaw Won't Start

```bash
# Verify dependencies
cd podclaw
source venv/bin/activate
pip list

# Check logs
python3 -m podclaw.main --workspace ../../ 2>&1 | tee podclaw.log

# Dry-run mode
python3 -m podclaw.main --workspace ../../ --dry-run
```

### Chat API Errors

Check browser console and server logs:

```bash
# Frontend logs
cd frontend
npm run dev

# Check health endpoint
curl http://localhost:3000/api/health

# Check chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

## Contributing

1. Feature branches: `feat/feature-name`
2. Bug fixes: `fix/issue-description`
3. Commit format: `feat: description — test #123 passing`
4. Test all changes through browser UI (use Playwright MCP)
5. Update `feature_list.json` after verification

## License

Proprietary — All rights reserved

## Support

For issues, contact: support@podai.com
