# Database ERD — POD-AI Platform

> **Last Updated:** 2026-02-24
> **Database:** Supabase Cloud (PostgreSQL 16 + pgvector)
> **Total Tables:** 64+
> **Migrations:** 143 applied

## Schema Overview

The POD-AI platform uses a PostgreSQL database with the following domain clusters:

1. **Users & Authentication** — User accounts, profiles, sessions
2. **Products & Catalog** — Products, variants, categories, reviews
3. **Orders & Fulfillment** — Orders, line items, shipping, returns
4. **Design & Content** — AI-generated designs, blog posts, translations
5. **Cart & Checkout** — Shopping carts, abandoned cart tracking
6. **Messaging & Notifications** — Multi-channel messaging, notifications
7. **AI Agents** — PodClaw events, sessions, memory
8. **Analytics & Insights** — AB tests, customer segments, demand forecasts
9. **System & Reliability** — Webhooks, cron jobs, audit logs

---

## 1. Users & Authentication

### `users` (Core)
Primary user table with profile data.

```sql
users (
  id              uuid PRIMARY KEY,
  email           varchar(255) UNIQUE NOT NULL,
  name            varchar(255),
  role            varchar(50) DEFAULT 'customer',
  locale          varchar(10) DEFAULT 'en',
  currency        varchar(3) DEFAULT 'EUR',
  email_verified  boolean DEFAULT false,
  notification_preferences jsonb,
  referral_code   varchar(20) UNIQUE,
  referred_by     uuid REFERENCES users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `referred_by` → `users.id` (self-referential, referral program)
- ← `orders.user_id`
- ← `cart_items.user_id`
- ← `shipping_addresses.user_id`
- ← `product_reviews.user_id`
- ← `designs.user_id`
- ← `conversations.user_id`

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (email)
- UNIQUE (referral_code)
- INDEX (referred_by)
- INDEX (role)

**RLS:** Enabled. Users can read/update own row. Service role has full access.

---

### `user_messaging_links`
Links users to messaging platform accounts (Telegram, WhatsApp).

```sql
user_messaging_links (
  id              uuid PRIMARY KEY,
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  channel         varchar(50) NOT NULL,
  external_id     varchar(255) NOT NULL,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  UNIQUE (channel, external_id)
)
```

**Relationships:**
- `user_id` → `users.id`

---

## 2. Products & Catalog

### `categories`
Hierarchical product categories with i18n names.

```sql
categories (
  id              uuid PRIMARY KEY,
  slug            varchar(100) UNIQUE NOT NULL,
  name_en         varchar(255) NOT NULL,
  name_es         varchar(255) NOT NULL,
  name_de         varchar(255) NOT NULL,
  parent_id       uuid REFERENCES categories(id),
  display_order   integer DEFAULT 0,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `parent_id` → `categories.id` (self-referential hierarchy)
- ← `products.category_id`

**Seed Data:** 18 categories (Apparel, Accessories, Home, Tech, Art, etc.)

---

### `products` (Core)
Main product catalog from Printify sync.

```sql
products (
  id                  uuid PRIMARY KEY,
  printify_product_id varchar(255) UNIQUE,
  category_id         uuid REFERENCES categories(id),
  title               varchar(500) NOT NULL,
  description         text,
  price               numeric(10,2) NOT NULL,
  images              jsonb DEFAULT '[]',
  tags                text[],
  status              varchar(50) DEFAULT 'draft',
  deleted             boolean DEFAULT false,
  deleted_at          timestamptz,
  admin_edited_at     timestamptz,
  last_synced_at      timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
)
```

**Relationships:**
- `category_id` → `categories.id`
- ← `product_variants.product_id`
- ← `product_reviews.product_id`
- ← `order_items.product_id`
- ← `cart_items.product_id`

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (printify_product_id)
- INDEX (category_id)
- INDEX (status)
- INDEX (deleted)
- INDEX (admin_edited_at)

**Soft Delete:** `deleted=true` instead of physical deletion.

---

### `product_variants`
Size/color/material variants of products.

```sql
product_variants (
  id              uuid PRIMARY KEY,
  product_id      uuid REFERENCES products(id) ON DELETE CASCADE,
  sku             varchar(255) UNIQUE NOT NULL,
  title           varchar(255) NOT NULL,
  price           numeric(10,2) NOT NULL,
  stock           integer DEFAULT 0,
  is_default      boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (product_id, sku)
)
```

**Relationships:**
- `product_id` → `products.id`
- ← `order_items.variant_id`

**Constraints:**
- `UNIQUE (product_id, sku)` — prevents duplicate SKUs per product

---

### `product_reviews`
Customer reviews with photo upload support.

```sql
product_reviews (
  id              uuid PRIMARY KEY,
  product_id      uuid REFERENCES products(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  rating          integer CHECK (rating BETWEEN 1 AND 5),
  comment         text,
  image_urls      jsonb DEFAULT '[]',
  verified_purchase boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `product_id` → `products.id`
- `user_id` → `users.id`

**Features:**
- Photo upload (max 3 images per review)
- Verified purchase badge

---

## 3. Orders & Fulfillment

### `orders` (Core)
Customer orders with payment and fulfillment tracking.

```sql
orders (
  id                  uuid PRIMARY KEY,
  user_id             uuid REFERENCES users(id),
  stripe_session_id   varchar(255) UNIQUE,
  stripe_payment_intent varchar(255),
  stripe_refund_id    varchar(255) UNIQUE,
  total               numeric(10,2) NOT NULL,
  currency            varchar(3) DEFAULT 'EUR',
  status              varchar(50) DEFAULT 'pending',
  shipping_address_id uuid REFERENCES shipping_addresses(id),
  refund_status       varchar(50),
  refund_requested_at timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
)
```

**Relationships:**
- `user_id` → `users.id`
- `shipping_address_id` → `shipping_addresses.id`
- ← `order_items.order_id`
- ← `return_requests.order_id`

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (stripe_session_id)
- UNIQUE (stripe_refund_id)
- INDEX (user_id)
- INDEX (status)

**Atomic Refund:** `issue_refund_atomic()` function ensures idempotency.

---

### `order_items`
Line items in orders.

```sql
order_items (
  id              uuid PRIMARY KEY,
  order_id        uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id),
  variant_id      uuid REFERENCES product_variants(id),
  quantity        integer NOT NULL CHECK (quantity > 0),
  price           numeric(10,2) NOT NULL,
  created_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `order_id` → `orders.id`
- `product_id` → `products.id`
- `variant_id` → `product_variants.id`

---

### `shipping_addresses`
Saved shipping addresses for users.

```sql
shipping_addresses (
  id              uuid PRIMARY KEY,
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  full_name       varchar(255) NOT NULL,
  address_line1   varchar(255) NOT NULL,
  address_line2   varchar(255),
  city            varchar(100) NOT NULL,
  state           varchar(100),
  postal_code     varchar(20) NOT NULL,
  country         varchar(2) NOT NULL,
  phone           varchar(50),
  is_default      boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `user_id` → `users.id`
- ← `orders.shipping_address_id`

---

### `return_requests`
Return/refund request lifecycle.

```sql
return_requests (
  id              uuid PRIMARY KEY,
  order_id        uuid REFERENCES orders(id) ON DELETE CASCADE,
  reason          text NOT NULL,
  status          varchar(50) DEFAULT 'pending',
  resolution      text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `order_id` → `orders.id`

**Status Lifecycle:** `pending` → `approved` → `refunded` OR `rejected`

---

## 4. Design & Content

### `designs`
AI-generated product designs.

```sql
designs (
  id              uuid PRIMARY KEY,
  user_id         uuid REFERENCES users(id),
  prompt          text NOT NULL,
  image_url       varchar(500),
  fal_request_id  varchar(255),
  status          varchar(50) DEFAULT 'pending',
  moderation_status varchar(50) DEFAULT 'pending',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `user_id` → `users.id`

**Moderation:** AI-powered moderation (NSFW, violence, IP infringement detection).

---

### `blog_posts`
Blog content management with i18n.

```sql
blog_posts (
  id              uuid PRIMARY KEY,
  slug            varchar(255) UNIQUE NOT NULL,
  title_en        text NOT NULL,
  title_es        text NOT NULL,
  title_de        text NOT NULL,
  content_en      text NOT NULL,
  content_es      text NOT NULL,
  content_de      text NOT NULL,
  excerpt_en      text,
  excerpt_es      text,
  excerpt_de      text,
  featured_image  varchar(500),
  author_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  status          varchar(50) DEFAULT 'draft',
  published_at    timestamptz,
  tags            text[],
  views           integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `author_id` → `users.id`

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (slug)
- INDEX (status)
- INDEX (published_at DESC) WHERE status='published'
- GIN INDEX (tags)

---

### `translations`
Dynamic content translations.

```sql
translations (
  id              uuid PRIMARY KEY,
  locale          varchar(10) NOT NULL,
  key             varchar(255) NOT NULL,
  value           text NOT NULL,
  category        varchar(100),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (locale, key)
)
```

**Indexes:**
- UNIQUE (locale, key)
- INDEX (category)

---

## 5. Cart & Checkout

### `cart_items`
Shopping cart (session-based + persistent for logged-in users).

```sql
cart_items (
  id              uuid PRIMARY KEY,
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  session_id      varchar(255),
  product_id      uuid REFERENCES products(id) ON DELETE CASCADE,
  variant_id      uuid REFERENCES product_variants(id),
  quantity        integer NOT NULL CHECK (quantity > 0),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `user_id` → `users.id` (nullable for guest carts)
- `product_id` → `products.id`
- `variant_id` → `product_variants.id`

**Indexes:**
- INDEX (user_id)
- INDEX (session_id)

---

## 6. Messaging & Notifications

### `messaging_channels`
Multi-channel messaging platforms (email, Telegram, WhatsApp).

```sql
messaging_channels (
  id              uuid PRIMARY KEY,
  type            varchar(50) UNIQUE NOT NULL,
  config          jsonb NOT NULL,
  is_enabled      boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
)
```

**Seed Data:**
- email (Resend API)
- telegram (Bot API)
- whatsapp (Business API)

---

### `messaging_conversations`
Conversation threads across channels.

```sql
messaging_conversations (
  id              uuid PRIMARY KEY,
  channel_id      uuid REFERENCES messaging_channels(id),
  external_thread_id varchar(255),
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (channel_id, external_thread_id)
)
```

**Relationships:**
- `channel_id` → `messaging_channels.id`

---

### `messages`
Chat messages (user ↔ PodClaw).

```sql
messages (
  id              uuid PRIMARY KEY,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  role            varchar(50) NOT NULL,
  content         text NOT NULL,
  embedding       vector(768),
  tool_calls      jsonb,
  created_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `conversation_id` → `conversations.id`

**Partitioning:** Monthly partitions (`messages_YYYY_MM`) for performance.

**Vector Search:** HNSW index on `embedding` for semantic similarity.

---

### `notifications`
User notifications (email, push, SMS).

```sql
notifications (
  id              uuid PRIMARY KEY,
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  type            varchar(100) NOT NULL,
  title           varchar(255) NOT NULL,
  message         text NOT NULL,
  data            jsonb DEFAULT '{}',
  read            boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `user_id` → `users.id`

**Indexes:**
- INDEX (user_id, read)
- INDEX (created_at DESC)

---

## 7. AI Agents (PodClaw)

### `agent_events`
Event log for all agent actions.

```sql
agent_events (
  id              uuid PRIMARY KEY,
  session_id      uuid REFERENCES agent_sessions(id),
  agent_name      varchar(100) NOT NULL,
  event_type      varchar(100) NOT NULL,
  payload         jsonb NOT NULL,
  created_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `session_id` → `agent_sessions.id`

**Partitioning:** Monthly partitions (`agent_events_YYYY_MM`).

**Retention:** Auto-delete after 90 days (cron job).

---

### `agent_sessions`
Agent execution sessions with cost tracking.

```sql
agent_sessions (
  id              uuid PRIMARY KEY,
  agent_name      varchar(100) NOT NULL,
  task            text,
  status          varchar(50) DEFAULT 'running',
  total_cost_usd  numeric(10,4) DEFAULT 0,
  started_at      timestamptz DEFAULT now(),
  completed_at    timestamptz
)
```

**Indexes:**
- INDEX (agent_name)
- INDEX (status)
- INDEX (started_at DESC)

---

### `documents`
Vector database for RAG (Retrieval-Augmented Generation).

```sql
documents (
  id              uuid PRIMARY KEY,
  content         text NOT NULL,
  embedding       vector(768) NOT NULL,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
)
```

**Vector Search:** HNSW index on `embedding` (768-dim Gemini embeddings).

**Use Case:** Semantic search for product recommendations, FAQs, knowledge base.

---

## 8. Analytics & Insights

### `ab_experiments`
A/B test experiments.

```sql
ab_experiments (
  id              uuid PRIMARY KEY,
  name            varchar(255) UNIQUE NOT NULL,
  variants        jsonb NOT NULL,
  status          varchar(50) DEFAULT 'draft',
  start_date      timestamptz,
  end_date        timestamptz,
  created_at      timestamptz DEFAULT now()
)
```

**Indexes:**
- UNIQUE (name)
- INDEX (status)

---

### `ab_events`
A/B test event tracking (impressions, conversions).

```sql
ab_events (
  id              uuid PRIMARY KEY,
  experiment_id   uuid REFERENCES ab_experiments(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES users(id),
  variant         varchar(100) NOT NULL,
  event_type      varchar(100) NOT NULL,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `experiment_id` → `ab_experiments.id`
- `user_id` → `users.id`

---

### `customer_segments`
Dynamic customer segmentation.

```sql
customer_segments (
  id              uuid PRIMARY KEY,
  name            varchar(255) UNIQUE NOT NULL,
  criteria        jsonb NOT NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)
```

**Example Criteria:**
```json
{
  "total_orders": {"gte": 5},
  "total_spend": {"gte": 500},
  "last_order_days": {"lte": 30}
}
```

---

### `demand_forecasts`
Product demand predictions.

```sql
demand_forecasts (
  id              uuid PRIMARY KEY,
  product_id      uuid REFERENCES products(id),
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  predicted_units integer NOT NULL,
  confidence      numeric(5,2),
  created_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `product_id` → `products.id`

---

### `association_rules`
"Customers also bought" product associations.

```sql
association_rules (
  id              uuid PRIMARY KEY,
  product_a_id    uuid REFERENCES products(id),
  product_b_id    uuid REFERENCES products(id),
  support         numeric(5,4) NOT NULL,
  confidence      numeric(5,4) NOT NULL,
  lift            numeric(5,4) NOT NULL,
  created_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `product_a_id` → `products.id`
- `product_b_id` → `products.id`

**Metrics:**
- Support: P(A ∩ B)
- Confidence: P(B|A)
- Lift: Confidence / P(B)

---

### `price_history`
Product price change tracking.

```sql
price_history (
  id              uuid PRIMARY KEY,
  product_id      uuid REFERENCES products(id),
  old_price       numeric(10,2),
  new_price       numeric(10,2) NOT NULL,
  changed_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `product_id` → `products.id`

---

## 9. System & Reliability

### `processed_events`
Webhook deduplication.

```sql
processed_events (
  id              uuid PRIMARY KEY,
  provider        varchar(50) NOT NULL,
  event_id        varchar(255) NOT NULL,
  event_type      varchar(100) NOT NULL,
  processed_at    timestamptz DEFAULT now(),
  UNIQUE (provider, event_id)
)
```

**Providers:** stripe, printify, telegram, whatsapp

**Indexes:**
- UNIQUE (provider, event_id)
- INDEX (processed_at) for cleanup

---

### `cron_runs`
Cron execution tracking.

```sql
cron_runs (
  id              uuid PRIMARY KEY,
  job_name        varchar(100) NOT NULL,
  status          varchar(50) NOT NULL,
  started_at      timestamptz DEFAULT now(),
  completed_at    timestamptz,
  error_message   text,
  CHECK (status IN ('running', 'success', 'failed'))
)
```

**Jobs:**
- `zombie-reaper` — Delete orphaned temp products
- `event-cleanup` — Delete old agent_events (>90d)
- `heartbeat-cleanup` — Delete old heartbeat logs (>90d)

---

### `audit_log`
System-wide audit trail.

```sql
audit_log (
  id              uuid PRIMARY KEY,
  user_id         uuid REFERENCES users(id),
  action          varchar(100) NOT NULL,
  resource_type   varchar(100) NOT NULL,
  resource_id     uuid,
  changes         jsonb,
  ip_address      varchar(45),
  user_agent      text,
  created_at      timestamptz DEFAULT now()
)
```

**Partitioning:** Monthly partitions (`audit_log_YYYY_MM`).

**Use Cases:**
- Compliance (GDPR, audit trails)
- Security investigations
- Admin action tracking

---

## 10. Conversations

### `conversations`
User ↔ PodClaw chat sessions.

```sql
conversations (
  id              uuid PRIMARY KEY,
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  title           varchar(255),
  status          varchar(50) DEFAULT 'active',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)
```

**Relationships:**
- `user_id` → `users.id`
- ← `messages.conversation_id`

---

## Indexes Summary

### Compound Indexes (Performance-Critical)

1. `idx_products_category_status` — products(category_id, status)
2. `idx_orders_user_status` — orders(user_id, status)
3. `idx_messages_conversation_created` — messages(conversation_id, created_at DESC)
4. `idx_cart_items_user_session` — cart_items(user_id, session_id)
5. `idx_agent_events_session_created` — agent_events(session_id, created_at DESC)
6. `idx_notifications_user_read` — notifications(user_id, read)
7. `idx_product_reviews_product_rating` — product_reviews(product_id, rating DESC)
8. `idx_order_items_order_product` — order_items(order_id, product_id)
9. `idx_ab_events_experiment_variant` — ab_events(experiment_id, variant)
10. `idx_documents_metadata` — documents USING GIN (metadata)
11. `idx_blog_posts_tags` — blog_posts USING GIN (tags)

### Vector Indexes (HNSW)

- `documents.embedding` — 768-dim (Gemini embeddings)
- `messages.embedding` — 768-dim (conversation context)

---

## RLS Policies

**All 64+ tables have Row Level Security enabled.**

### Common Patterns

1. **Public Read (Published Content)**
   ```sql
   CREATE POLICY "public_read" ON products
     FOR SELECT USING (status = 'published' AND deleted = false);
   ```

2. **User Owns Row**
   ```sql
   CREATE POLICY "user_owns" ON cart_items
     FOR ALL USING (auth.uid() = user_id);
   ```

3. **Service Role Full Access**
   ```sql
   CREATE POLICY "service_full" ON all_tables
     FOR ALL USING (auth.jwt()->>'role' = 'service_role');
   ```

4. **Admin Only**
   ```sql
   CREATE POLICY "admin_only" ON users
     FOR UPDATE USING (auth.jwt()->'user_metadata'->>'role' = 'admin');
   ```

---

## Relationships Graph

```
users
├── orders (1:N)
│   ├── order_items (1:N)
│   │   ├── products (N:1)
│   │   └── product_variants (N:1)
│   ├── shipping_addresses (N:1)
│   └── return_requests (1:N)
├── cart_items (1:N)
│   ├── products (N:1)
│   └── product_variants (N:1)
├── shipping_addresses (1:N)
├── product_reviews (1:N)
│   └── products (N:1)
├── designs (1:N)
├── conversations (1:N)
│   └── messages (1:N)
├── notifications (1:N)
└── user_messaging_links (1:N)

categories
├── products (1:N)
│   ├── product_variants (1:N)
│   ├── product_reviews (1:N)
│   └── association_rules (N:N)
└── categories (self-referential hierarchy)

agent_sessions
└── agent_events (1:N)

ab_experiments
└── ab_events (1:N)

messaging_channels
└── messaging_conversations (1:N)
```

---

## Backup & Recovery

### Supabase Cloud

- **Automated Backups:** Daily snapshots (7-day retention on Free, 30-day on Pro)
- **Point-in-Time Recovery (PITR):** Available on Pro tier
- **Manual Backup:** `pg_dump` via Supabase CLI

```bash
supabase db dump -f backup.sql
```

### Restore

```bash
supabase db reset --db-url postgresql://...
psql postgresql://... < backup.sql
```

---

## Migration Strategy

### Adding Tables

```sql
CREATE TABLE IF NOT EXISTS new_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
);

ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON new_table
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
```

### Adding Columns

```sql
ALTER TABLE existing_table
  ADD COLUMN IF NOT EXISTS new_column varchar(255);
```

### Adding Indexes

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_name
  ON table_name (column_name);
```

Use `CONCURRENTLY` to avoid table locks in production.

---

## Performance Notes

1. **Partitioning:** agent_events, messages, audit_log (monthly partitions)
2. **Connection Pooling:** Supabase pgBouncer (transaction mode, 15 connections)
3. **Query Optimization:** EXPLAIN ANALYZE for slow queries
4. **Vector Search:** HNSW > IVFFlat for recall and speed
5. **Cache Strategy:** Redis for hot data (products, categories, user sessions)

---

## Contact

- **Database Admin:** Supabase Support (support@supabase.io)
- **Schema Changes:** Create migration with `supabase migration new <name>`
- **Emergency:** Rollback via compensating migration (NO `supabase db reset` in production)

---

**End of ERD**
