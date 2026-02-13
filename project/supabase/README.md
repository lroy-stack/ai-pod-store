# Supabase Database Setup

This directory contains database migrations for the POD AI Store platform.

## Quick Start (Local Development)

### Option 1: Supabase CLI (Recommended)

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase instance (requires Docker)
cd project
supabase init
supabase start

# This will output:
# - API URL: http://localhost:54321
# - GraphQL URL: http://localhost:54321/graphql/v1
# - DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# - Studio URL: http://localhost:54323
# - Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# - Service role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Apply migrations
supabase db reset

# Open Supabase Studio (database GUI)
open http://localhost:54323
```

### Option 2: Cloud Supabase (Production)

1. **Create a project at [supabase.com](https://supabase.com)**
2. **Get your credentials** from Project Settings → API
3. **Create backend/.env file** (copy from backend/.env.example):

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

4. **Run migrations** via Supabase Dashboard:
   - Go to SQL Editor
   - Copy contents of `migrations/20260213000001_initial_schema.sql`
   - Run the SQL

Or use the CLI:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

## Database Schema

The migration creates **24 tables** organized into 6 categories:

### 1. Core Tables (5)
- `users` - User profiles (extends auth.users)
- `products` - Product catalog synced with Printify
- `product_variants` - Size/color combinations
- `orders` - Customer orders with Stripe tracking
- `designs` - AI-generated designs (fal.ai FLUX.1)

### 2. Supporting Tables (5)
- `shipping_addresses` - Customer shipping info
- `messages` - Chat messages
- `conversations` - Chat sessions
- `cart_items` - Shopping cart
- `order_items` - Line items in orders

### 3. Feature Tables (5)
- `wishlists` - User wishlists
- `wishlist_items` - Items in wishlists
- `product_reviews` - Customer reviews
- `notifications` - User notifications
- `translations` - i18n content (EN/ES/DE)

### 4. Infrastructure Tables (2)
- `audit_log` - Audit trail (actor_type, action, changes)
- `documents` - RAG knowledge base with **vector(768)** embeddings

### 5. Agent Tables (2)
- `agent_sessions` - PodClaw autonomous sessions
- `agent_events` - Event-sourced action log (bigserial PK)

### 6. Analytics Tables (6)
- `customer_segments` - RFM analysis results
- `demand_forecasts` - Time-series predictions
- `price_history` - Price change tracking
- `association_rules` - Market basket analysis
- `ab_experiments` - A/B test experiments
- `ab_events` - Variant assignments & conversions

## pgvector Setup

The migration enables the **pgvector extension** for semantic search:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id UUID PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(768), -- Google Gemini embeddings
  ...
);

-- HNSW index for fast cosine similarity search
CREATE INDEX idx_documents_embedding ON documents
  USING hnsw (embedding vector_cosine_ops);
```

**Embedding Model**: Google Gemini `gemini-embedding-001` (768 dimensions, free)

## Row Level Security (RLS)

RLS is enabled on all user-facing tables:

- **Users** can only read/update their own profile
- **Wishlists** are private to the owner
- **Cart items** are private to the owner
- **Conversations** and **messages** are private
- **Orders** are private (users can only view their own)
- **Designs** can be public or private
- **Product reviews** show approved reviews + user's own

## Environment Variables

Create `backend/.env`:

```env
# Database
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Redis (for sessions, cache, semantic cache)
REDIS_URL=redis://localhost:6379
```

## Health Check

Once configured, the backend health endpoint should return:

```bash
curl http://localhost:3001/api/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-02-13T...",
  "uptime": 123.45,
  "environment": "development",
  "db": "connected",    # ← Database working!
  "redis": "connected"  # ← Redis working!
}
```

## Troubleshooting

### Database connection fails

```bash
# Check if Supabase is running
supabase status

# Restart if needed
supabase stop
supabase start
```

### pgvector not working

```sql
-- Verify extension is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- If missing, enable it:
CREATE EXTENSION vector;
```

### Migrations not applying

```bash
# Reset database (WARNING: deletes all data)
supabase db reset

# Or apply manually via SQL Editor in Supabase Studio
```

## Next Steps

After database setup:

1. ✅ Configure Redis (see `../scripts/redis-setup.md`)
2. ✅ Seed sample products (see `../backend/src/scripts/seed.ts`)
3. ✅ Test RAG pipeline (see `../backend/src/services/rag/`)
4. ✅ Configure Stripe webhooks
5. ✅ Configure Printify integration
