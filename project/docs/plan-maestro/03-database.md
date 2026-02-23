# Plan 03 — Database Schema, RLS & Performance

**Prioridad**: P0 — BLOQUEANTE
**Estimación**: 30-35h
**Dependencias**: Plan 01 Bloque C (RLS) ejecuta la parte de seguridad; este plan cubre schema, indexes, performance
**Bloquea**: Plan 05 (Categorías), Plan 11 (Multi-tenant)

---

## 1. Objetivo

Estabilizar el schema de base de datos: reconciliar auth, optimizar queries, preparar para escala de 1.000+ clientes, y eliminar deuda técnica en migraciones.

## 2. Estado Actual (Validado)

| Área | Score | Evidencia |
|------|-------|-----------|
| Schema Design | 6/10 | 64 tablas bien estructuradas, pero sin normalización de categorías |
| Auth Sync | 2/10 | `public.users.id` generado con `gen_random_uuid()`, no referencia `auth.users(id)` |
| RLS | 3/10 | 25+ tablas sin RLS (cubierto en Plan 01-C, aquí se valida) |
| Indexes | 5/10 | Indexes básicos existen, faltan compound indexes para queries frecuentes |
| pgvector | 4/10 | IVFFlat en vez de HNSW (ineficiente para <10K rows) |
| Migrations | 5/10 | 98 migrations, test/seed data embebido en producción |
| Partitioning | 0/10 | Sin particiones en tablas de alto crecimiento |
| Connection Pooling | 3/10 | Supabase pooler disponible pero no configurado |

## 3. Gap Estructural

La base de datos creció orgánicamente — cada feature añadió tablas y migraciones sin un plan de escalabilidad. Las consecuencias:
- `public.users` y `auth.users` no están sincronizados → RLS policies pueden fallar silenciosamente
- Categorías como VARCHAR → imposible hacer queries relacionales, joins, o jerarquías
- Tablas de alto crecimiento (messages, agent_events, audit_log) sin partitioning → degradación O(n) con el tiempo
- Test data en migraciones de producción → datos ficticios que podrían confundirse con reales
- pgvector con IVFFlat requiere `VACUUM` después de inserts, HNSW no

## 4. Decisión Arquitectónica

### Auth Sync: Trigger `handle_new_user()` + FK constraint

**Justificación**:
- Patrón estándar de Supabase (documentado oficialmente)
- Crea automáticamente row en `public.users` cuando alguien se registra via `auth.signUp()`
- FK constraint asegura integridad referencial

### Indexes: Compound indexes para queries del admin + frontend

**Justificación**:
- Las queries más frecuentes (orders by status+date, products by category, designs by user+status) benefician de compound indexes
- GIN index para `documents.content` habilita full-text search eficiente
- Costo: más espacio en disco, writes ligeramente más lentos — aceptable para read-heavy workload

### Partitioning: Range partitioning por mes para tablas de eventos

**Justificación**:
- `agent_events`, `messages`, `audit_log` crecen linealmente con el uso
- Partition pruning elimina scans de particiones antiguas
- Permite archivar/eliminar datos antiguos por partición (GDPR compliance)

### pgvector: Migrar de IVFFlat a HNSW

**Justificación**:
- HNSW es 2-5x más rápido para datasets <100K rows
- No requiere VACUUM después de inserts
- Supabase lo soporta nativamente

## 5. Plan de Implementación

### Bloque A: Auth Reconciliation (4h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| A1 | Crear migración: trigger `handle_new_user()` que copia `auth.users` → `public.users` | 1h |
| A2 | Crear migración: FK `public.users(id)` → `auth.users(id)` con `ON DELETE CASCADE` | 30min |
| A3 | Script de reconciliación: sincronizar UUIDs existentes entre `auth.users` y `public.users` | 1.5h |
| A4 | Verificar que RLS policies funcionan post-reconciliación | 1h |

### Bloque B: Indexes Faltantes (6h)

| # | Tarea | Index | Esfuerzo |
|---|-------|-------|----------|
| B1 | Orders: compound index `(status, created_at DESC)` | `idx_orders_status_created` | 30min |
| B2 | Orders: index `(user_id, created_at DESC)` | `idx_orders_user_created` | 30min |
| B3 | Products: index `(category, status)` | `idx_products_category_status` | 30min |
| B4 | Designs: index `(user_id, status, created_at DESC)` | `idx_designs_user_status_created` | 30min |
| B5 | Documents: GIN index `to_tsvector('english', content)` | `idx_documents_content_fts` | 30min |
| B6 | Variants: index `(product_id, is_active)` | `idx_variants_product_active` | 30min |
| B7 | Agent events: index `(agent_name, created_at DESC)` | `idx_agent_events_agent_created` | 30min |
| B8 | Messages: index `(conversation_id, created_at)` | `idx_messages_conversation_created` | 30min |
| B9 | Cart items: index `(session_id)` para guest carts | `idx_cart_items_session` | 30min |
| B10 | Newsletter: index `(status, locale)` | `idx_newsletter_status_locale` | 30min |
| B11 | Audit log: index `(entity_type, entity_id, created_at DESC)` | `idx_audit_entity_created` | 30min |
| B12 | User consents: ya tiene indexes optimizados — SKIP | — | 0 |

### Bloque C: Migration Cleanup (4h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| C1 | Identificar test/seed data en migraciones de producción | 1h |
| C2 | Crear `supabase/seed.sql` con datos de prueba separados | 1h |
| C3 | Crear migración que elimine test data de tablas de producción | 1h |
| C4 | Documentar convención: migraciones solo DDL, datos en seed.sql | 1h |

### Bloque D: pgvector Optimization (3h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| D1 | Migración: DROP INDEX IVFFlat existente en `documents` | 30min |
| D2 | Migración: CREATE INDEX HNSW en `documents.embedding` | 30min |
| D3 | Verificar performance: query 768-dim vectors con HNSW vs IVFFlat | 1h |
| D4 | Ajustar `ef_construction` y `m` parameters para balance recall/speed | 1h |

### Bloque E: Partitioning (8h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| E1 | Diseñar esquema de partitioning: range por mes para 3 tablas | 1h |
| E2 | Migración: convertir `agent_events` a tabla particionada | 2h |
| E3 | Migración: convertir `messages` a tabla particionada | 2h |
| E4 | Migración: convertir `audit_log` a tabla particionada | 1h |
| E5 | Crear cron para auto-crear particiones futuras (3 meses adelante) | 1h |
| E6 | Crear cron para archivar particiones > 12 meses | 1h |

### Bloque F: Connection Pooling (2h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| F1 | Habilitar Supavisor (connection pooler) en Supabase Dashboard | 30min |
| F2 | Configurar frontend para usar pooler URL en producción | 30min |
| F3 | Configurar PodClaw para usar pooler URL | 30min |
| F4 | Test de concurrencia: 50 conexiones simultáneas | 30min |

### Bloque G: Redis Performance Fix (1h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| G1 | Reemplazar `client.keys(pattern)` por `SCAN` en `clearPattern()` | 1h |

## 6. Orden de Ejecución

```
Bloque A (Auth) ──→ Bloque B (Indexes) ──→ Bloque D (pgvector)
                                                    ↓
Bloque C (Cleanup) ─────────────────────→ Bloque E (Partitioning) ──→ Bloque F (Pooling)
                                                    ↓
                                             Bloque G (Redis)
```

- A es prerequisito (auth sync necesario antes de optimizar queries que dependen de user_id)
- B y C son paralelizables
- D, E, F son independientes entre sí pero secuenciales con B
- G es independiente, puede ir en cualquier momento

## 7. Validaciones Técnicas

| # | Validación | Criterio |
|---|-----------|----------|
| V1 | Auth sync | Registro nuevo → `public.users.id` === `auth.users.id` |
| V2 | Indexes | `EXPLAIN ANALYZE` de top 5 queries muestra index scan (no seq scan) |
| V3 | No test data | `SELECT * FROM products WHERE name LIKE '%test%'` → 0 rows en prod |
| V4 | HNSW funciona | Vector similarity search retorna en <50ms |
| V5 | Partitions | `\d+ agent_events` muestra particiones por mes |
| V6 | Pooler | `SELECT count(*) FROM pg_stat_activity` < max_connections / 2 bajo carga |
| V7 | Redis SCAN | `clearPattern('cache:*')` no bloquea Redis (monitorear con `SLOWLOG`) |

## 8. Validaciones de Negocio

- Registro de nuevos usuarios funciona sin interrupciones
- Búsqueda de productos por categoría responde en <200ms
- Dashboard de orders carga en <1s incluso con 10K+ orders
- Historial de mensajes no se degrada con el volumen

## 9. Métricas de Éxito

| Métrica | Antes | Después |
|---------|-------|---------|
| Auth tables sincronizadas | No | Sí (trigger automático) |
| Queries con index scan | ~60% | >95% |
| pgvector query time (768-dim) | ~150ms | <50ms |
| Test data en prod | Presente | Eliminado |
| Tablas particionadas | 0 | 3 |
| DB score | 5/10 | 8.5/10 |

## 10. Estimación Total

| Bloque | Horas |
|--------|-------|
| A — Auth Reconciliation | 4h |
| B — Indexes | 6h |
| C — Migration Cleanup | 4h |
| D — pgvector | 3h |
| E — Partitioning | 8h |
| F — Connection Pooling | 2h |
| G — Redis Fix | 1h |
| **Total** | **28h** |

**Con 2 agentes paralelos**: ~20h elapsed

---

*Plan derivado de audit 07-database-schema.md validado (95% precisión). 2026-02-23.*
