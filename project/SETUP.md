# POD AI Store — Setup Guide

Complete setup guide for running the Print-on-Demand AI Store platform locally.

## Prerequisites

- **Node.js 22+** (required for both frontend and backend)
- **Docker Desktop** (for Supabase local instance)
- **Redis** (via Homebrew, Docker, or cloud service)
- **Git** (for version control)

## Quick Start (5 minutes)

```bash
# 1. Install dependencies
cd project/frontend && npm install
cd ../backend && npm install

# 2. Start Supabase (Docker required)
cd ..
supabase start

# This outputs your local credentials — copy them!

# 3. Start Redis
brew install redis && brew services start redis
# Or: docker run -d -p 6379:6379 redis:alpine

# 4. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your Supabase credentials from step 2

# 5. Start dev servers
bash init.sh

# ✅ Frontend: http://localhost:3000
# ✅ Backend: http://localhost:3001
```

## Detailed Setup

### 1. Database Setup (Supabase)

**Option A: Local Supabase (Recommended for development)**

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Initialize and start
cd project
supabase init
supabase start

# Copy the output credentials:
# API URL: http://localhost:54321
# Anon key: eyJhbGci...
# Service role key: eyJhbGci...

# Apply database migrations
supabase db reset

# Open Supabase Studio (database GUI)
open http://localhost:54323
```

**Option B: Cloud Supabase (Production)**

1. Create project at [supabase.com](https://supabase.com)
2. Get credentials from Project Settings → API
3. Run migration SQL via Dashboard → SQL Editor
4. Copy file: `supabase/migrations/20260213000001_initial_schema.sql`

See [supabase/README.md](./supabase/README.md) for details.

### 2. Redis Setup

**Option A: Homebrew (macOS)**

```bash
brew install redis
brew services start redis
redis-cli ping  # Should return: PONG
```

**Option B: Docker**

```bash
docker run -d --name pod-redis -p 6379:6379 redis:alpine
```

**Option C: Cloud Redis**

Use [Upstash](https://upstash.com) (free tier) or [Redis Cloud](https://redis.com/try-free)

See [scripts/redis-setup.md](./scripts/redis-setup.md) for details.

### 3. Environment Variables

Create `backend/.env` file:

```env
# Database (from supabase start output)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key-from-supabase-start
SUPABASE_SERVICE_KEY=your-service-role-key-from-supabase-start
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Redis
REDIS_URL=redis://localhost:6379

# Backend
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# JWT (for local dev, change in production)
JWT_SECRET=dev-jwt-secret-change-in-production

# API Keys (optional for initial setup, required for full functionality)
ANTHROPIC_API_KEY=sk-ant-your-key  # For AI chat
GOOGLE_AI_API_KEY=your-key          # For embeddings (free)
FAL_AI_API_KEY=your-key              # For design generation
STRIPE_SECRET_KEY=sk_test_your-key   # For payments
PRINTIFY_API_TOKEN=your-token        # For fulfillment
RESEND_API_KEY=your-key              # For emails
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase-start
```

### 4. Verify Setup

```bash
# Health check endpoint
curl http://localhost:3001/api/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-02-13T...",
  "uptime": 123.45,
  "environment": "development",
  "db": "connected",     # ✅ Database working
  "redis": "connected"   # ✅ Redis working
}
```

### 5. Test Frontend

Navigate to:
- http://localhost:3000/en → English
- http://localhost:3000/es → Spanish (Español)
- http://localhost:3000/de → German (Deutsch)

All three locales should render with proper UI text.

## Development Workflow

```bash
# Start everything (runs both frontend and backend)
bash init.sh

# Or start individually:
cd frontend && npm run dev  # Frontend on :3000
cd backend && npm run dev   # Backend on :3001

# Type checking
cd frontend && npx tsc --noEmit
cd backend && npx tsc --noEmit

# Linting
cd frontend && npx eslint . --max-warnings=0

# View database
open http://localhost:54323  # Supabase Studio

# View Redis data
redis-cli
> KEYS *
> GET products:all
```

## Project Structure

```
project/
├── frontend/               # Next.js 16 App Router
│   ├── src/app/[locale]/  # All routes use [locale] prefix
│   ├── messages/          # i18n translations (en.json, es.json, de.json)
│   └── public/
├── backend/               # Express API
│   └── src/
│       ├── routes/        # API endpoints
│       ├── services/      # Business logic
│       └── middleware/
├── supabase/
│   └── migrations/        # Database schema SQL
├── scripts/               # Python analytics
├── shared/types/          # TypeScript types
└── init.sh               # Start dev servers
```

## Technology Stack

- **Frontend**: Next.js 16.1.6, React 19, Tailwind CSS v4, shadcn/ui, next-intl
- **Backend**: Node.js 22, Express, TypeScript
- **Database**: Supabase (PostgreSQL 16 + pgvector for RAG)
- **Cache**: Redis (sessions, semantic cache, translations)
- **AI Chat**: AI SDK 6 (ToolLoopAgent, SSE streaming)
- **Embeddings**: Google Gemini (768-dim, free)
- **Design Gen**: fal.ai FLUX.1
- **Payments**: Stripe Checkout + Tax
- **Fulfillment**: Printify REST API
- **Analytics**: Python (pandas, scipy, prophet)
- **Agent**: PodClaw (Claude Agent SDK)

## Feature Flags

Some features require API keys:

| Feature | Required Keys | Status |
|---------|---------------|--------|
| Basic UI | None | ✅ Works out of box |
| Database | Supabase | ✅ Local via CLI |
| Redis | Redis URL | ✅ Local via Homebrew/Docker |
| AI Chat | ANTHROPIC_API_KEY | ⏸️ Optional |
| Embeddings | GOOGLE_AI_API_KEY | ⏸️ Optional (free) |
| Design Gen | FAL_AI_API_KEY | ⏸️ Optional |
| Payments | STRIPE_SECRET_KEY | ⏸️ Optional |
| Fulfillment | PRINTIFY_API_TOKEN | ⏸️ Optional |
| Email | RESEND_API_KEY | ⏸️ Optional |

**You can run the app without API keys** — those features will be disabled gracefully.

## Troubleshooting

### Port already in use

```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9  # Frontend
lsof -ti:3001 | xargs kill -9  # Backend
```

### Database connection fails

```bash
# Check Supabase status
supabase status

# Restart if needed
supabase stop && supabase start
```

### Redis connection fails

```bash
# Check if running
ps aux | grep redis

# Restart
brew services restart redis
```

### TypeScript errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

After setup is complete:

1. ✅ Verify health endpoint shows all green
2. ✅ Navigate to all 3 locales (EN/ES/DE)
3. ✅ Review database schema in Supabase Studio
4. 📚 Read [app_spec.txt](../app_spec.txt) for full feature list
5. 🧪 Run feature tests (see [feature_list.json](../feature_list.json))

## Getting API Keys (Optional)

- **Anthropic**: https://console.anthropic.com/account/keys
- **Google AI**: https://aistudio.google.com/app/apikey (free)
- **fal.ai**: https://fal.ai/dashboard (free tier)
- **Stripe**: https://dashboard.stripe.com/test/apikeys (test mode)
- **Printify**: https://printify.com/app/account/api
- **Resend**: https://resend.com/api-keys

## Support

- Issues: See [feature_list.json](../feature_list.json) for test cases
- Database schema: See [supabase/migrations/](./supabase/migrations/)
- API docs: See [backend/src/routes/](./backend/src/routes/)
