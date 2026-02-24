# POD AI — Onboarding Guide

Welcome to POD AI, a chat-first, AI-managed Print-on-Demand e-commerce platform. This guide will walk you through setting up all 5 sub-projects from zero to a running development environment.

---

## Prerequisites

**Required**:
- **Node.js** 20.x or later (for frontend and admin)
- **Python** 3.11+ (for PodClaw agent system)
- **Docker** 20.x+ and Docker Compose (for services)
- **Supabase CLI** 1.x+ (`brew install supabase/tap/supabase`)
- **Git** (for version control)

**Recommended**:
- **pnpm** or **npm** 9.x+ (package manager)
- **VS Code** with TypeScript and Python extensions
- **curl** (for API testing)
- **jq** (for JSON parsing)

**Accounts** (free tiers available):
- **Supabase Cloud** account (https://supabase.com)
- **Stripe** account in test mode (https://stripe.com)
- **Printify** account (https://printify.com)
- **Anthropic** API key (https://console.anthropic.com)

---

## Architecture Overview

POD AI consists of 5 sub-projects:

1. **Frontend** (`frontend/`) — Customer-facing Next.js storefront with chat, product catalog, and checkout
2. **Admin Panel** (`admin/`) — Internal Next.js management interface for orders, products, and agent monitoring
3. **PodClaw** (`podclaw/`) — Python autonomous agent system on Claude Agent SDK with 10 agents
4. **MCP Server** (`mcp-server/`) — TypeScript Model Context Protocol server for Claude Desktop integration
5. **Supabase** (`supabase/`) — Cloud PostgreSQL database with 98 migrations, RLS, and pgvector

Supporting services:
- **Redis** — Session persistence, rate limiting, caching
- **Caddy** — Reverse proxy and TLS termination
- **Rembg** — Background removal service for product images
- **Crawl4AI** — Web scraping for agent research

---

## Step 1: Clone Repository and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd pod_workspace/project

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install admin dependencies
cd admin
npm install
cd ..

# Install MCP server dependencies
cd mcp-server
npm install
cd ..

# Install PodClaw dependencies
cd podclaw
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

---

## Step 2: Configure Environment Variables

### 2.1 Frontend Environment

Create `frontend/.env.local`:

```bash
# Supabase (Cloud instance)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_KEY=<your-supabase-service-role-key>

# Stripe (Test mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Printify
PRINTIFY_API_KEY=<your-printify-api-key>
PRINTIFY_SHOP_ID=<your-printify-shop-id>

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Security
CSRF_SECRET=<generate-random-32-char-string>
SESSION_SECRET=<generate-random-32-char-string>

# Redis (optional for development)
REDIS_URL=redis://localhost:6379
```

### 2.2 Admin Environment

Create `admin/.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_KEY=<your-supabase-service-role-key>

# Admin Session
SESSION_SECRET=<generate-random-32-char-string>

# PodClaw Bridge API
NEXT_PUBLIC_PODCLAW_BRIDGE_URL=http://localhost:8000
PODCLAW_BRIDGE_AUTH_TOKEN=<bridge-auth-token>

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3001
NODE_ENV=development
```

### 2.3 PodClaw Environment

Create `podclaw/.env`:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=<your-supabase-service-role-key>

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Redis
REDIS_URL=redis://localhost:6379

# Bridge API
PODCLAW_BRIDGE_AUTH_TOKEN=<generate-random-token>
PODCLAW_BRIDGE_PORT=8000

# External APIs
PRINTIFY_API_KEY=<your-printify-api-key>
STRIPE_SECRET_KEY=sk_test_...
FAL_KEY=<fal-ai-key-for-image-generation>
GEMINI_API_KEY=<google-gemini-key>

# Telegram (optional)
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_WEBHOOK_SECRET=<webhook-secret>
```

### 2.4 MCP Server Environment

Create `mcp-server/.env`:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=<your-supabase-service-role-key>

# OAuth (for Claude Desktop authentication)
OAUTH_CLIENT_ID=<generate-random-id>
OAUTH_CLIENT_SECRET=<generate-random-secret>
JWT_SECRET=<generate-random-32-char-string>

# Redis
REDIS_URL=redis://localhost:6379

# App Config
MCP_SERVER_PORT=8002
NODE_ENV=development
```

---

## Step 3: Set Up Supabase Database

### 3.1 Link to Cloud Instance

```bash
cd project/
supabase link --project-ref yehvotdnhcwxjjpcznrf
```

### 3.2 Apply Migrations

⚠️ **IMPORTANT**: This project uses Supabase Cloud, NOT local Supabase. Never run `supabase start`.

```bash
# Push all 98 migrations to cloud instance
supabase db push --include-all

# Verify migrations applied
supabase db dump --schema public | head -100
```

### 3.3 Seed Test Data (optional)

```bash
# Seed categories, test products, and reviews
# (Migrations include seed data - check latest migration files)
```

---

## Step 4: Start Development Servers

### 4.1 Start Redis (via Docker)

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### 4.2 Start Frontend

```bash
cd frontend
npm run dev
# Frontend running at http://localhost:3000
```

### 4.3 Start Admin Panel

```bash
cd admin
npm run dev
# Admin running at http://localhost:3001
```

### 4.4 Start PodClaw Bridge API (optional)

```bash
cd podclaw
source venv/bin/activate
python -m uvicorn bridge.api:app --port 8000 --reload
# PodClaw Bridge API running at http://localhost:8000
```

### 4.5 Start MCP Server (optional)

```bash
cd mcp-server
npm run dev
# MCP server running at http://localhost:8002
```

---

## Step 5: Verify Installation

### 5.1 Frontend Health Check

```bash
curl http://localhost:3000/api/health | jq
# Expected: {"status":"degraded|healthy","timestamp":"...","supabase":{"status":"connected"}}
```

### 5.2 Admin Health Check

```bash
curl http://localhost:3001/api/health | jq
# Expected: {"status":"ok","timestamp":"..."}
```

### 5.3 Browse Frontend

Navigate to http://localhost:3000/en in your browser:
- ✅ Landing page loads with hero section
- ✅ Click "Start Shopping" → redirects to `/en/chat`
- ✅ Chat interface visible (three-panel layout)

### 5.4 Login to Admin Panel

Navigate to http://localhost:3001/login:
- Email: `admin@podstore.local`
- Password: `admin123`
- ✅ Redirects to `/dashboard` after login

---

## Step 6: Create Test User (Frontend)

### 6.1 Sign Up via UI

Navigate to http://localhost:3000/en/login:
- Click "Sign up"
- Email: `test@example.com`
- Password: `testpass123456`
- ✅ Check email for confirmation link (if email service configured)
- OR manually confirm via Supabase dashboard → Authentication → Users

### 6.2 Create via Supabase API (automated)

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=<your-service-key>

curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123456",
    "email_confirm": true,
    "user_metadata": {"name": "Test User"}
  }'
```

---

## Step 7: Run Tests (optional)

### 7.1 TypeScript Compilation

```bash
cd frontend
npx tsc --noEmit
# Should pass with 0 errors (some test file warnings are OK)
```

### 7.2 Playwright E2E Tests

```bash
cd frontend
npx playwright install chromium
npx playwright test
```

### 7.3 Python Tests (PodClaw)

```bash
cd podclaw
pytest tests/
```

---

## Step 8: Docker Compose (Production-like Environment)

For a production-like setup with all services orchestrated:

```bash
cd project/
docker-compose up -d

# Services:
# - Frontend: http://localhost:3000
# - Admin: http://localhost:3001/panel
# - PodClaw Bridge: http://localhost:8000
# - MCP Server: http://localhost:8002
# - Caddy (reverse proxy): http://localhost:80
```

---

## Common Issues

### Issue: `supabase db push` fails with "remote has migrations not in local"

**Solution**: Use `--include-all` flag:
```bash
supabase db push --include-all
```

### Issue: Frontend shows "Supabase connection failed"

**Solution**:
1. Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env.local`
2. Verify Supabase Cloud instance is not paused
3. Check network connectivity to Supabase

### Issue: Admin login fails with "Invalid credentials"

**Solution**:
1. Default credentials: `admin@podstore.local` / `admin123`
2. Check `users` table has admin user with `role = 'admin'`
3. Password hashed with bcrypt (10 rounds)

### Issue: Redis connection errors in logs

**Solution**:
- Redis is optional for development - app has graceful fallback
- To disable Redis warnings, comment out `REDIS_URL` in `.env.local`
- To enable Redis, run: `docker run -d -p 6379:6379 redis:7-alpine`

### Issue: TypeScript errors in test files

**Solution**:
- Test file errors (e.g., `tests/e2e/*.spec.ts`) are non-blocking
- Production code in `src/` must compile without errors
- Run `npx tsc --noEmit --skipLibCheck` to ignore test errors

### Issue: PodClaw Bridge API returns 401 Unauthorized

**Solution**:
- Check `PODCLAW_BRIDGE_AUTH_TOKEN` matches in:
  - `podclaw/.env` (server)
  - `admin/.env.local` (client)
- Header format: `Authorization: Bearer <token>`

---

## Next Steps

1. **Read CLAUDE.md** — Design system and component standards
2. **Read docs/adr/** — Architecture Decision Records explaining key choices
3. **Explore feature_list.json** — Track feature implementation progress (62/321 passing)
4. **Check claude-progress.txt** — Session-by-session implementation notes
5. **Join chat** — Ask PodClaw questions via http://localhost:3000/en/chat

---

## Architecture Diagrams

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Browser                       │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│                    Caddy (Reverse Proxy)                    │
│  - TLS termination                                          │
│  - Request routing                                          │
└──────┬─────────────────┬─────────────────┬─────────────────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Frontend   │   │    Admin    │   │   PodClaw   │
│  (Next.js)  │   │  (Next.js)  │   │  (FastAPI)  │
│  Port 3000  │   │  Port 3001  │   │  Port 8000  │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       └─────────────────┴─────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ Supabase │   │  Redis   │   │   MCP    │
   │  (Cloud) │   │  :6379   │   │  :8002   │
   └──────────┘   └──────────┘   └──────────┘
```

### Data Flow (Chat → Checkout)

```
User: "Buy a t-shirt"
       │
       ▼
[Frontend Chat UI]
       │
       ▼
[AI SDK streamText()]
       │
       ▼
[Claude API] → Tool: search_products
       │
       ▼
[Supabase] → Return products
       │
       ▼
[Frontend] → Display product cards
       │
       ▼
User: "Add to cart"
       │
       ▼
[Claude API] → Tool: add_to_cart
       │
       ▼
[Supabase] → Insert cart_items
       │
       ▼
User: "Checkout"
       │
       ▼
[Claude API] → Tool: create_checkout (needsApproval)
       │
       ▼
[Frontend] → Show approval button
       │
       ▼
User clicks "Confirm"
       │
       ▼
[Claude API] → Tool: confirm_order
       │
       ▼
[Stripe API] → Create PaymentIntent
       │
       ▼
[Supabase] → Insert order, update cart
       │
       ▼
[Frontend] → Redirect to checkout URL
```

---

## Development Workflow

### Creating a New Feature

1. **Check feature_list.json** for next failing feature
2. **Read verification steps** to understand requirements
3. **Implement** following CLAUDE.md patterns (shadcn/ui, semantic tokens, mobile-first)
4. **Test in browser** (Playwright for E2E, manual for UI)
5. **Mark as passing** in feature_list.json
6. **Commit** with conventional commit message
7. **Update** claude-progress.txt with implementation notes

### Creating a Database Migration

```bash
cd project/
supabase migration new <descriptive_name>
# Edit supabase/migrations/<timestamp>_<name>.sql
# ⚠️ ONE SQL statement per file (prepared statement limit)
supabase db push
```

### Adding i18n Translations

For frontend user-visible strings:
1. Add key to `frontend/messages/en.json`
2. Add translations to `es.json` and `de.json`
3. Use `getTranslations()` (Server Components) or `useTranslations()` (Client Components)

```typescript
// Server Component
import { getTranslations } from 'next-intl/server';

const t = await getTranslations('checkout');
<h1>{t('title')}</h1>

// Client Component
import { useTranslations } from 'next-intl';

const t = useTranslations('checkout');
<h1>{t('title')}</h1>
```

---

## Resources

- **CLAUDE.md** — Component and design standards
- **docs/adr/** — Architecture Decision Records
- **podclaw/AGENTS.md** — PodClaw agent system documentation
- **podclaw/SECURITY.md** — Security constraints and escalation rules
- **podclaw/SOUL.md** — Agent identity and immutable constraints
- **app_spec.txt** — Full application specification
- **feature_list.json** — Feature tracking (62/321 passing as of 2026-02-24)

---

## Support

For issues or questions:
1. Check this onboarding guide first
2. Read relevant ADRs in `docs/adr/`
3. Search claude-progress.txt for implementation context
4. Ask PodClaw via chat (http://localhost:3000/en/chat)
