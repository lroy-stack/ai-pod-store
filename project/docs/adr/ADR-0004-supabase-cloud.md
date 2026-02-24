# ADR-0004: Supabase Cloud over Self-Hosted PostgreSQL

## Status

Accepted

## Context

POD AI requires a relational database with:
1. **Vector search** (pgvector 768-dim embeddings) for semantic product search and RAG
2. **Row-level security (RLS)** for multi-tenant data isolation (future: each store is a tenant)
3. **Real-time subscriptions** for chat messages, order updates, and inventory changes
4. **Storage** for product images, user avatars, and design files
5. **Hosted auth** for frontend user authentication (email/password, OAuth)
6. **Edge functions** for webhooks and async tasks

We evaluated three options:
- **Self-hosted PostgreSQL + separate services**: Full control but requires managing Realtime, Storage, Auth, Edge Functions separately (8+ services)
- **AWS RDS + custom integrations**: Managed PostgreSQL but still requires custom Realtime, Storage, Auth (4+ services)
- **Supabase Cloud**: Managed PostgreSQL + Realtime + Storage + Auth + Edge Functions in one platform

## Decision

We will use **Supabase Cloud** (PostgreSQL 16 with pgvector 0.5.1) as the primary database and backend-as-a-service.

**Configuration**:
- **Instance**: Supabase Cloud (https://your-project.supabase.co)
- **Database**: PostgreSQL 16.1 with extensions: pgvector, pg_trgm, uuid-ossp, pg_stat_statements
- **Schema**: 64+ tables across 9 migrations (as of 2026-02-24)
- **Indexes**: HNSW vector index on documents.embedding (768-dim), B-tree on foreign keys, GIN on JSONB columns
- **RLS**: Enabled on all 64 tables with policies for customer/admin access
- **Auth**: Supabase Auth for frontend (email/password, magic links)
- **Storage**: Supabase Storage buckets for product-images, user-avatars, design-files
- **Realtime**: Subscribed to messages, orders, cart_items tables

**Why Supabase Cloud**:
- **Zero DevOps**: No need to manage Postgres upgrades, backups, replication, or monitoring
- **Built-in pgvector**: Vector search is first-class (CREATE INDEX USING hnsw)
- **Integrated ecosystem**: Auth, Storage, Realtime use the same connection pool and security model
- **Generous free tier**: 500MB DB, 1GB storage, 2GB bandwidth - enough for MVP
- **Instant API**: Auto-generated REST and GraphQL APIs with RLS enforcement
- **CLI workflow**: `supabase migration new`, `supabase db push` - same developer experience as local Postgres

## Consequences

**Positive**:
- ✅ **Faster iteration**: No time spent on Postgres ops, backups, or scaling - focus on features
- ✅ **Built-in security**: RLS policies are battle-tested, auth tokens are cryptographically signed
- ✅ **Real-time without Redis**: Supabase Realtime eliminates need for separate Redis PubSub
- ✅ **Unified monitoring**: Database metrics, auth logs, storage usage all in one dashboard
- ✅ **TypeScript types**: supabase-js auto-generates types from schema for type-safe queries
- ✅ **Edge-optimized**: Supabase uses connection pooler (PgBouncer) for serverless functions

**Negative**:
- ❌ **Vendor lock-in**: Migrating off Supabase requires recreating Auth, Storage, Realtime infrastructure
- ❌ **Cost scaling**: Supabase Pro ($25/mo) → Team ($599/mo) has steep jump for high-traffic apps
- ❌ **Limited control**: Cannot customize Postgres config (shared_buffers, work_mem, etc.) on shared plans
- ❌ **Cold starts**: Free tier databases pause after 1 week of inactivity (3-5s cold start)
- ❌ **PostgreSQL version lag**: Supabase Cloud lags 6-12 months behind latest Postgres releases

**Mitigations**:
- Keep database schema portable: avoid Supabase-specific functions (use standard SQL where possible)
- Use environment variables for Supabase URL and keys to enable swapping providers
- Document manual migration path in docs/MIGRATION.md (export schema, auth users, storage files)
- Monitor database size and connection usage to predict when to upgrade plans
- Use Redis for high-frequency caching (session data, rate limits) to reduce Postgres load

## Implementation Notes

**Local development**:
- We do NOT use `supabase start` (local Supabase Docker containers)
- All development and testing uses the **cloud instance** (shared dev/staging/production)
- Migrations are applied via `supabase db push` to the cloud instance
- This trade-off: faster setup, consistent environment, but requires careful testing before push

**Migration workflow**:
```bash
cd project/
supabase migration new add_feature_x
# Edit supabase/migrations/<timestamp>_add_feature_x.sql
supabase db push
```

**ONE SQL statement per migration file** (Supabase CLI uses prepared statements - multiple statements fail).

**Schema versioning**:
- All schema changes are tracked in `supabase/migrations/`
- Applied migrations are recorded in `supabase_migrations` table
- Never modify applied migrations - only create new ones

## References

- Supabase Cloud: https://supabase.com
- Database URL: https://your-project.supabase.co
- Supabase CLI: https://supabase.com/docs/guides/cli
- Migration files: `project/supabase/migrations/`
