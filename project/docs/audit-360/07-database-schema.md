# Auditoría 7 — Database Schema, Migrations, RLS, Data Architecture

**Fecha:** 2026-02-23
**Scope:** Supabase Cloud — PostgreSQL 16 + pgvector

---

## 1. Migration Inventory

- **98 migration files** en `supabase/migrations/`
- Periodo: 2026-02-13 a 2026-02-22 (10 dias de desarrollo)
- Patrón: `YYYYMMDDHHMMSS_nombre.sql`

### Evolución del schema (por fases):
1. **Fundacional** (13-14 Feb): Schema core (users, products, variants, orders, conversations, messages, documents, designs, coupons, shipping)
2. **Cart & Checkout** (14 Feb): cart_items, personalizations, return_requests
3. **Social & Engagement** (14-15 Feb): wishlists, reviews, notifications
4. **Agent System** (15-16 Feb): agent_sessions, agent_events, agent_daily_costs, heartbeat_events, soul_change_log, system_events
5. **Analytics Pipeline** (16-17 Feb): customer_segments, demand_forecasts, price_history, association_rules, ab_experiments, product_beliefs, product_daily_metrics, product_lifecycle_decisions, daily_portfolio_metrics
6. **Marketing** (17-18 Feb): marketing_content, newsletter_campaigns, newsletter_subscribers, drip_queue, referrals, credit_transactions
7. **Messaging** (18-19 Feb): messaging_channels, user_messaging_links, telegram_messages, whatsapp_messages
8. **Legal & RBAC** (19-21 Feb): user_consents, legal_settings, legal_pages, legal_page_versions, admin_roles, user_roles, RBAC functions
9. **Hardening** (21-22 Feb): RLS policies, indexes, audit_log, error_logs, functions

---

## 2. Complete Table Map

### 64 tablas totales organizadas por dominio:

#### CORE (8 tablas)
| Tabla | PK | Columnas Clave | FKs |
|-------|-----|----------------|-----|
| **users** | UUID | email (UNIQUE), name, role, locale, currency, credits, deleted_at | — |
| **products** | UUID | title, slug (UNIQUE), status, price_cents, cost_cents, category, printify_id | — |
| **product_variants** | UUID | product_id, size, color, price_cents, cost_cents, sku, printify_variant_id | products(id) CASCADE |
| **designs** | UUID | user_id, product_id, prompt, image_url, fal_request_id, status | users(id), products(id) |
| **orders** | UUID | user_id, status, total_cents, stripe_session_id, printify_order_id | users(id) SET NULL |
| **order_items** | UUID | order_id, product_id, variant_id (NOT NULL), quantity, unit_price_cents | orders CASCADE, products RESTRICT |
| **shipping_addresses** | UUID | user_id, full_name, address_line1/2, city, country | users(id) CASCADE |
| **conversations** | UUID | user_id, session_id, model, locale | users(id), conversations(id) CASCADE |

#### FEATURE (8 tablas)
| Tabla | Propósito |
|-------|-----------|
| **wishlists** / **wishlist_items** | Listas de deseos (público/privado con share_token) |
| **product_reviews** | Reviews con moderación (rating 1-5, moderation_status) |
| **notifications** | Notificaciones in-app (type, is_read, data JSONB) |
| **translations** | i18n dinámico (namespace, key, locale, value) |
| **coupons** | Cupones descuento (code UNIQUE, usage_limit, times_used) |
| **shipping_zones** | Zonas de envío (country, zip_pattern, base_rate) |
| **personalizations** | Personalización de productos (text, font, image) |

#### AGENT (5 tablas)
| Tabla | Propósito |
|-------|-----------|
| **agent_sessions** | Metadata de sesiones (tipo, status, tool_calls/errors) |
| **agent_events** | Event-sourced log de acciones (BIGSERIAL, FK dropped) |
| **agent_daily_costs** | Costes diarios por agente |
| **heartbeat_events** | Monitoreo heartbeat |
| **soul_change_log** | Mutaciones del SOUL.md |

#### ANALYTICS/LIFECYCLE (10 tablas)
| Tabla | Propósito |
|-------|-----------|
| **customer_segments** | RFM scoring (recency, frequency, monetary) |
| **demand_forecasts** | Previsión de demanda por producto |
| **price_history** | Historial de precios |
| **association_rules** | Market basket analysis (antecedents, confidence, lift) |
| **ab_experiments** / **ab_events** | A/B testing |
| **product_beliefs** | Bayesian belief tracking (alpha, beta, SPRT) |
| **product_daily_metrics** | Métricas diarias (views, cart_adds, revenue, margin) |
| **product_lifecycle_decisions** | Decisiones de lifecycle por agente |
| **daily_portfolio_metrics** | KPIs diarios del portfolio |

#### MARKETING (5), MESSAGING (5), USAGE/CREDITS (3), LEGAL (4), RBAC (2), THEME (1), INFRA (6)

**Total: 64 tablas, 14 funciones, 12 triggers**

### pgvector Usage
- **1 tabla**: `documents.embedding` VECTOR(768) — Gemini embeddings
- **Indice**: IVFFlat (lists=100) con vector_cosine_ops
- **Funciones**: `search_documents()` (vector), `hybrid_search_documents()` (70% vector + 30% text rank)
- **PROBLEMA**: IVFFlat requiere reentrenamiento; HNSW es superior para <10K rows

---

## 3. RLS Policy Audit — HALLAZGOS CRITICOS

### 25+ TABLAS SIN RLS (Severidad CRITICA)

Estas tablas son accesibles por CUALQUIER cliente con la anon key:

| Tabla | Dato Expuesto | Riesgo |
|-------|---------------|--------|
| **products** | Catálogo completo | WRITE abierto — cualquiera puede crear/borrar productos |
| **product_variants** | Variantes y precios | WRITE abierto |
| **designs** | Diseños de usuarios | PII + propiedad intelectual |
| **order_items** | Items de pedidos | Datos de compra |
| **documents** | RAG knowledge base | Embeddings expuestos |
| **audit_log** | Trail de auditoría | Info operacional sensible |
| **agent_sessions/events/costs** | Datos de agentes IA | Costes, decisiones, logs |
| **newsletter_subscribers** | Emails de suscriptores | **PII directo** |
| **drip_queue** | Cola de emails + user_id | **PII directo** |
| **push_subscriptions** | Push tokens | Tokens sensibles |
| **credit_transactions** | Transacciones financieras | Datos financieros |
| **customer_segments** | Segmentación RFM | Datos analíticos |
| **marketing_content** | Campañas de marketing | Estrategia comercial |

### Tablas con RLS pero políticas `USING (true)` (Severidad CRITICA)

| Tabla | Problema |
|-------|----------|
| **telegram_messages** | TODOS los roles (incl. anon) pueden leer/escribir TODOS los mensajes |
| **whatsapp_messages** | Igual — completamente abierto |
| **user_messaging_links** | Links de messaging de TODOS los usuarios visibles |
| **messaging_conversations** | Todas las conversaciones visibles |

### Otras brechas RLS notables:
- **error_logs**: anon puede leer stack traces (info de debug sensible)
- **store_themes**: cualquier usuario autenticado puede crear/modificar themes
- **ab_events**: cualquiera puede INSERT eventos (vector de DoS/contaminación)

---

## 4. Hallazgo Arquitectónico Crítico: auth.users vs public.users

### El problema:
- `public.users.id` se genera con `gen_random_uuid()` — **NO referencia** `auth.users(id)`
- Las RLS policies usan `auth.uid()` — pero `public.users.id` puede ser diferente
- **NO existe trigger `handle_new_user()`** para sincronizar
- Solo 2 tablas referencian `auth.users(id)`: newsletter_subscribers y personalizations

### Consecuencia:
Las RLS policies que hacen `WHERE users.id = auth.uid()` **podrían nunca matchear** a menos que la aplicación manualmente sincronice los IDs.

### Recomendación:
Crear trigger `handle_new_user()` que copie `auth.users.id` a `public.users.id` en signup, o añadir FK `public.users.id REFERENCES auth.users(id)`.

---

## 5. Performance Concerns

### Tablas de alto crecimiento sin estrategia de archival:
| Tabla | Patrón de Crecimiento | Riesgo |
|-------|----------------------|--------|
| **messages** | Cada mensaje de chat, unbounded | ALTO — sin partición, sin archival |
| **agent_events** | BIGSERIAL, alta velocidad | ALTO — sin partición |
| **ab_events** | BIGSERIAL, alta velocidad | MEDIO |
| **audit_log** | Cada acción admin/agent | MEDIO — sin TTL |
| **heartbeat_events** | Cada heartbeat check | MEDIO |

### Indexes faltantes:
| Tabla | Index Faltante | Justificación |
|-------|---------------|---------------|
| products | `idx_products_status` | Filtro frecuente por status |
| orders | `idx_orders_created_at` | Queries por rango de tiempo |
| orders | `idx_orders_paid_at` | Usado en `compute_daily_product_metrics` |
| order_items | `idx_order_items_product_id` | Queries de portfolio metrics |
| designs | `idx_designs_user_id` / `product_id` | Lookups frecuentes |
| product_variants | `idx_variants_product_id` | Join target frecuente |
| documents | GIN index on `to_tsvector('english', content)` | `hybrid_search_documents()` es O(n) sin él |

### Queries costosos:
1. `compute_portfolio_metrics()` — 6 sub-queries incl. NOT EXISTS para zombie products
2. `hybrid_search_documents()` — `to_tsvector()` en cada row sin GIN index
3. RLS admin checks — `EXISTS (SELECT FROM users WHERE role='admin')` en cada row access

---

## 6. Supabase Configuration Issues

| Config | Valor Actual | Problema |
|--------|-------------|----------|
| Password min length | **6** | Demasiado débil para ecommerce con pagos |
| Email confirmations | **disabled** | Users sin verificar email |
| Connection pooler | **disabled** | Agotamiento de conexiones bajo carga |
| MFA | **disabled** | Sin 2FA para admin (production blocker) |
| Storage buckets | **ninguno configurado** | Necesario para imágenes de diseños |
| SMTP | **no configurado** | Emails no funcionarán |
| OAuth providers | **ninguno** | No Google/Apple login |
| Session timeout | **no configurado** | Sesiones nunca expiran por inactividad |

---

## 7. Data Model Assessment

### Multi-Tenant Readiness: NO LISTO
- No existe `tenant_id` en ninguna tabla
- `brand_config` es singleton (1 marca)
- `store_themes` usa `is_active` (1 tema activo)
- `legal_settings` es singleton
- **Requiere refactor significativo para SaaS multi-tenant**

### Problemas de consistencia:
- **Dual role systems**: `users.role` (simple) y RBAC (`admin_roles`/`user_roles`) coexisten sin reconciliación
- **Currency inconsistency**: Schema inicial usa 'usd', pricing_pipeline cambió a 'EUR'
- **Trigger duplicado**: `cart_items` tiene DOS triggers updated_at
- **Test data en migrations**: Productos mock, usuarios test, pedidos test embebidos en migrations de producción
- **FK faltante**: `personalizations.product_id` referencia products pero sin FOREIGN KEY
- **No `product_categories` table**: category es VARCHAR sin master list

### Lo que está bien:
- Products/variants bien separados (1:N)
- Orders/order_items bien separados
- Cart flow bien modelado (session_id OR user_id, personalization link)
- Agent event-sourcing bien diseñado
- Legal pages con versioning
- RBAC con join table y funciones SECURITY DEFINER
- Review rating materializado con trigger

---

## 8. Resumen de Hallazgos por Severidad

### CRITICAL (pre-producción obligatorio)
1. 25+ tablas sin RLS — datos expuestos incluyendo PII
2. Messaging tables con `USING (true)` — completamente abiertas
3. `public.users` no linkeado a `auth.users` — RLS puede no funcionar
4. No trigger `handle_new_user()`
5. Test/seed data en migrations de producción

### HIGH
6. IVFFlat en vez de HNSW para pgvector
7. Password min length = 6
8. Email confirmation disabled
9. error_logs accesible a anon
10. store_themes writable por cualquier user autenticado
11. Sin estrategia de archival/partición

### MEDIUM
12. Indexes faltantes (orders, designs, variants, documents GIN)
13. Dual role systems sin reconciliar
14. FK faltante en personalizations.product_id
15. Storage buckets no configurados
16. Connection pooler disabled
17. Currency inconsistency (USD vs EUR)

### LOW
18. Soft-delete inconsistente
19. CHAR(5) para locale (debería ser VARCHAR)
20. system_events cleanup no automatizado

---

## 9. Roadmap de Remediación

### Fase 1: Seguridad Crítica (1-2 semanas)
- [ ] Enable RLS en TODAS las tablas + policies apropiadas
- [ ] Fix messaging policies (reemplazar `USING (true)`)
- [ ] Link `public.users` a `auth.users` + trigger `handle_new_user()`
- [ ] Mover test data a `seed.sql`
- [ ] Aumentar password min a 8+
- [ ] Enable email confirmations
- [ ] Fix store_themes policies (admin-only write)
- [ ] Fix error_logs policies (admin-only read)

### Fase 2: Performance & Correctness (2-3 semanas)
- [ ] Añadir indexes faltantes
- [ ] Reemplazar IVFFlat con HNSW
- [ ] Añadir GIN index para text search
- [ ] Enable connection pooler
- [ ] Reconciliar dual role systems
- [ ] Añadir FK a personalizations.product_id
- [ ] Configurar storage buckets
- [ ] Crear tabla `product_categories`
- [ ] Crear tabla `order_status_history`

### Fase 3: Escalabilidad (1 mes+)
- [ ] Implementar partitioning (messages, agent_events, audit_log)
- [ ] Automated cleanup jobs (system_events, heartbeat_events)
- [ ] Enable MFA para admin
- [ ] Configurar SMTP
- [ ] Evaluar multi-tenant strategy (tenant_id column)

---

## 10. Impacto en Escalabilidad (1.000+ clientes)

| Área | Estado Actual | Con 1K+ Clientes | Acción Requerida |
|------|--------------|-------------------|------------------|
| RLS | 25+ tablas abiertas | Data breach garantizado | CRITICO — fix inmediato |
| Messages table | Sin partición | Query degradation >100K rows | Partitioning por mes |
| Connection pooling | Disabled | Connection exhaustion >50 concurrent | Enable pooler |
| Indexes | Faltantes en queries clave | Slow queries en analytics | Añadir pre-production |
| Multi-tenant | No existe | Imposible escalar a SaaS | Requiere redesign |
| Auth sync | No trigger | Usuarios huérfanos | Fix inmediato |
