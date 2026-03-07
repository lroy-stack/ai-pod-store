---
name: Audit Database
description: >
  Comprehensive audit of the Supabase PostgreSQL database. Use when asked to audit, review,
  or assess the database — covering schema design, RLS policies, multi-tenancy isolation,
  indexes, migrations, data integrity, and query performance.
---

# Audit Database

Systematic audit of the Supabase PostgreSQL 16 database with pgvector, RLS, and 24+ tables.

## Prerequisites

- Read `supabase/migrations/` for schema definitions and RLS policies
- Access DB directly: `postgresql://postgres:***@db.your-project.supabase.co:5432/postgres`
- Read `frontend/src/lib/supabase-admin.ts` for service role usage patterns

## Workflow

### Phase 1: Schema & Data Integrity

1. **Table inventory**:
   - List all tables with row counts
   - Identify orphaned tables (no references, no data)
   - Check for missing tables that should exist

2. **Foreign key constraints**:
   - List all FK relationships
   - Check for missing FKs (e.g., `order_items.product_id` → `products.id`)
   - Verify ON DELETE behavior (CASCADE vs SET NULL vs RESTRICT)
   - Check for orphaned records (FK target deleted without cascade)

3. **Data types & constraints**:
   - Check for missing NOT NULL constraints on required fields
   - Verify UUID usage for primary keys
   - Check for appropriate CHECK constraints (e.g., `price_cents >= 0`)
   - Verify ENUM types or CHECK constraints for status fields

4. **Indexes**:
   - List all indexes with sizes
   - Identify missing indexes on FK columns
   - Identify missing indexes on frequently queried columns
   - Check for unused indexes (bloat without benefit)
   - Verify composite indexes match query patterns

### Phase 2: Row-Level Security (RLS) — CRITICAL

5. **RLS activation**:
   - Is RLS enabled on EVERY table? List any without → CRITICAL
   - Which tables are exempt and why? (e.g., `products` is public read)

6. **Policy coverage**:
   - For each user-scoped table (orders, profiles, wishlists, cart_items, conversations, messages):
     - SELECT policy: `auth.uid() = user_id`?
     - INSERT policy: `auth.uid() = user_id`?
     - UPDATE policy: `auth.uid() = user_id`?
     - DELETE policy: `auth.uid() = user_id`?
   - Any table with SELECT ALL but no user filter → CRITICAL

7. **Service role bypass**:
   - Which operations use the service role (bypass RLS)?
   - Are these justified? (admin operations, cron sync, webhooks)
   - Document each service role usage with justification

8. **Cross-tenant data leakage**:
   - Can User A see User B's orders via any query path?
   - Can User A see User B's chat history?
   - Can User A modify User B's profile?
   - Test with RLS policies: simulate queries as different users

### Phase 3: Multi-Tenancy Isolation

9. **User-scoped tables**:
   - List all tables that MUST be user-scoped
   - Verify each has `user_id` column with FK to `auth.users`
   - Verify RLS policies enforce user_id = auth.uid()

10. **Shared tables**:
    - List tables that are correctly shared (products, categories, etc.)
    - Verify read-only access for anon/authenticated roles
    - Verify write access is restricted to service role or admin

11. **Chat/conversation isolation**:
    - Verify `conversations` table has user_id with RLS
    - Verify `messages` table is scoped to conversation (which is scoped to user)
    - Check for any direct message query without user scope

### Phase 4: Migrations & Versioning

12. **Migration history**:
    - List all migrations in order
    - Check for destructive migrations (DROP TABLE, DROP COLUMN)
    - Verify migrations are idempotent (can re-run safely)
    - Check for data migrations vs schema migrations

13. **Schema drift**:
    - Compare migration definitions vs actual DB schema
    - Identify any manual changes not captured in migrations
    - Check for columns/tables in DB but not in migrations

### Phase 5: Performance & Monitoring

14. **Query patterns**:
    - Identify N+1 query patterns in application code
    - Check for missing pagination on list endpoints
    - Verify connection pooling configuration

15. **Storage & growth**:
    - Check table sizes and growth rate
    - Identify tables that need partitioning
    - Check for large TEXT/JSONB columns without limits
    - Verify pgvector index type (ivfflat vs hnsw)

## Output Format

Generate `AUDIT_DATABASE_[DATE].md` at workspace root with:

```markdown
# Database Audit — [DATE]

## Summary
- Tables: X | With RLS: X | Without RLS: X
- Total checks: X
- PASS: X | WARN: X | FAIL: X | CRITICAL: X

## RLS Coverage Matrix
| Table | SELECT | INSERT | UPDATE | DELETE | Status |
|---|---|---|---|---|---|

## Critical Findings
[RLS gaps, data leakage vectors, missing constraints]

## Warnings & Recommendations
[Index optimization, schema improvements, performance]
```
