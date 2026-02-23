# Plan 11 — Multi-Tenant Architecture & SaaS Readiness

**Prioridad**: P3 — VISION LARGO PLAZO
**Estimacion**: 80-100h
**Dependencias**: Plan 01 (Seguridad — RLS base), Plan 03 (Database — auth sync, indexes, partitioning)
**Bloquea**: Nada (es el plan terminal de la cadena)

---

## 1. Objetivo

Transformar POD AI de una plataforma single-brand a una arquitectura multi-tenant completa, donde cada tenant (marca/tienda) opera con aislamiento total de datos, configuracion independiente, agentes IA propios, y facturacion separada. Este plan es la base para ofrecer POD AI como SaaS.

### Resultado final:
- N tiendas coexisten en la misma infraestructura
- Cada tenant tiene su propio dominio, branding, catalogo, agentes y facturacion
- Los datos estan aislados por RLS + `tenant_id` en JWT claims
- Un tenant comprometido NO puede acceder a datos de otro
- PII cifrado at-rest con pgsodium
- SMTP configurable por tenant para emails con dominio propio

---

## 2. Estado Actual (Validado)

| Area | Score | Evidencia |
|------|-------|-----------|
| Modelo de tenant | 0/10 | No existe `tenant_id` en ninguna tabla |
| brand_config | 2/10 | Singleton (1 row global), sin FK a tenant |
| store_themes | 2/10 | `is_active` con UNIQUE constraint — 1 tema global activo |
| legal_settings | 2/10 | Singleton (1 row JSONB), sin FK a tenant |
| RLS multi-tenant | 0/10 | Policies actuales usan `auth.uid() = user_id` — sin dimension tenant |
| PodClaw tenant isolation | 0/10 | Config global en `config.py` — mismos budgets/tools para todo |
| Billing per tenant | 0/10 | Stripe directo a 1 cuenta merchant |
| Custom domains | 0/10 | Caddy con 1 DOMAIN fijo |
| Storage isolation | 0/10 | Sin buckets Supabase, imagenes en URLs externas |
| PII encryption | 0/10 | Sin pgsodium, datos en texto plano |
| SMTP per tenant | 0/10 | 1 RESEND_API_KEY global |

### Tablas singleton que necesitan tenant_id:
- `brand_config` — 1 row global (migracion `20260221100000`)
- `store_themes` — UNIQUE constraint `is_active=true` global (migracion `20260221140000`)
- `legal_settings` — 1 row global (migracion `20260222203434`)
- `legal_pages` / `legal_page_versions` — sin scoping
- `coupons` — codigos globales, colisionarian entre tenants
- `shipping_zones` — zonas globales
- `translations` — namespace global

### Tablas que necesitan `tenant_id` (impacto):
- **CORE (8)**: users, products, product_variants, designs, orders, order_items, shipping_addresses, conversations
- **FEATURE (8)**: wishlists, wishlist_items, product_reviews, notifications, translations, coupons, shipping_zones, personalizations
- **AGENT (5)**: agent_sessions, agent_events, agent_daily_costs, heartbeat_events, soul_change_log
- **ANALYTICS (10)**: customer_segments, demand_forecasts, price_history, association_rules, ab_experiments, ab_events, product_beliefs, product_daily_metrics, product_lifecycle_decisions, daily_portfolio_metrics
- **MARKETING (5)**: marketing_content, newsletter_campaigns, newsletter_subscribers, drip_queue, referrals
- **MESSAGING (5)**: messaging_channels, user_messaging_links, telegram_messages, whatsapp_messages, messaging_conversations
- **USAGE (3)**: user_usage, credit_transactions, push_subscriptions
- **LEGAL (4)**: user_consents, legal_settings, legal_pages, legal_page_versions
- **CONFIG (2)**: brand_config, store_themes
- **INFRA (6)**: audit_log, error_logs, documents, messages, cart_items, system_events

**Total: 56 tablas requieren `tenant_id`** (de 64 — excluidas: admin_roles, user_roles que son globales de plataforma, mas tablas RBAC internas).

---

## 3. Gap Estructural

La plataforma fue disenada como single-brand desde el primer dia. Cada decision arquitectonica asume un unico operador:

1. **brand_config singleton** — No hay forma de tener 2 marcas con branding diferente. `INSERT` se bloquea por la logica de "1 row activa".

2. **store_themes UNIQUE constraint** — `CREATE UNIQUE INDEX store_themes_unique_active ON store_themes (is_active) WHERE is_active = true` impide que 2 tenants tengan temas activos simultaneos.

3. **legal_settings singleton** — El frontend pide la primera row. Si hay N tenants, todos verian la misma info legal.

4. **Coupons sin scope** — `coupons.code` es UNIQUE global. El tenant A creando codigo "SUMMER20" bloquearia al tenant B.

5. **PodClaw config.py global** — Budgets, rate limits, API keys son variables de entorno unicas. No hay forma de dar a un tenant Printify-shop-X y a otro Printify-shop-Y.

6. **Caddy single-domain** — El `Caddyfile` sirve 1 dominio. Multi-tenant requiere N dominios con TLS automatico.

7. **RLS sin dimension tenant** — Las policies actuales (`auth.uid() = user_id`) aislarian usuarios entre si pero no prevendrian que un admin de tenant A vea datos de tenant B.

8. **Sin PII encryption** — GDPR Art. 32 recomienda cifrado at-rest para datos personales. Con multi-tenant, un breach en la DB expondria datos de TODOS los tenants.

### Por que Row-Level (tenant_id column) y NO schema-per-tenant ni DB-per-tenant:

| Estrategia | Pros | Contras | Veredicto |
|-----------|------|---------|-----------|
| **Row-Level (tenant_id)** | Migraciones centralizadas, 1 schema, RLS nativo en Supabase, queries cross-tenant para analytics de plataforma | Requiere disciplina en queries (WHERE tenant_id = X) | **RECOMENDADO** |
| Schema-per-tenant | Aislamiento fuerte, migraciones independientes | Supabase no soporta schemas dinamicos facilmente, 100+ schemas = overhead de conexiones | No viable con Supabase |
| DB-per-tenant | Aislamiento total | 1 proyecto Supabase por tenant = coste prohibitivo, imposible gestionar | Descartado |

**Decision: Row-Level Tenancy con RLS**. Supabase esta optimizado para este patron (JWT claims + RLS policies). Es el unico approach viable sin migrar fuera de Supabase.

---

## 4. Decision Arquitectonica

### 4.1 Modelo de Tenant

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,           -- subdomain: slug.podai.com
  custom_domain TEXT UNIQUE,           -- optional: mitienda.com
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning', 'active', 'suspended', 'cancelled')),
  owner_id UUID NOT NULL,              -- REFERENCES auth.users(id)
  stripe_customer_id TEXT,             -- Stripe billing
  stripe_subscription_id TEXT,
  stripe_connect_account_id TEXT,      -- Stripe Connect (marketplace payments)
  printify_shop_id TEXT,
  printify_api_token_encrypted TEXT,   -- pgsodium encrypted
  resend_api_key_encrypted TEXT,
  smtp_config JSONB DEFAULT '{}',      -- custom SMTP per tenant
  fal_key_encrypted TEXT,
  max_products INTEGER DEFAULT 50,     -- plan-based limits
  max_agents INTEGER DEFAULT 3,
  max_daily_budget_eur NUMERIC(8,2) DEFAULT 5.00,
  features JSONB DEFAULT '{}',         -- feature flags per tenant
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 tenant_id en JWT Claims

Supabase permite custom JWT claims via `auth.users.raw_app_meta_data`:

```sql
-- Asignar tenant_id al usuario en signup
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('tenant_id', $tenant_id)
WHERE id = $user_id;
```

Acceso en RLS policies:
```sql
-- Funcion helper para extraer tenant_id del JWT
CREATE OR REPLACE FUNCTION auth.tenant_id() RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE sql STABLE;
```

### 4.3 RLS Pattern Multi-Tenant

```sql
-- Ejemplo para products
CREATE POLICY "Tenant isolation" ON products
  FOR ALL USING (tenant_id = auth.tenant_id());

-- Acceso publico (catalogo visible sin auth)
CREATE POLICY "Public read active products" ON products
  FOR SELECT USING (
    status = 'active'
    AND tenant_id = (
      -- Resolver tenant_id desde el dominio/subdomain
      -- Set via request header por Caddy/middleware
      COALESCE(
        auth.tenant_id(),
        current_setting('app.current_tenant_id', true)::uuid
      )
    )
  );
```

### 4.4 Billing: Stripe Connect (Platform Model)

**Justificacion**: Stripe Connect permite que POD AI actue como plataforma. Cada tenant tiene su Connected Account. POD AI cobra una comision (application_fee) en cada transaccion.

- **Standard Connect**: Tenant gestiona su propio Stripe dashboard
- **Express Connect**: Onboarding simplificado, POD AI gestiona payouts
- **Subscriptions**: POD AI cobra mensualidad por el plan (free/starter/pro/enterprise)

### 4.5 PodClaw Per-Tenant

```python
# Nuevo: tenant_config.py
class TenantAgentConfig:
    tenant_id: str
    daily_budget_eur: float
    enabled_agents: list[str]
    agent_budgets: dict[str, float]
    printify_shop_id: str
    printify_api_token: str
    resend_api_key: str
    # ... per-tenant overrides
```

Cada sesion de agente recibe el `tenant_id` y usa SOLO los recursos de ese tenant (Printify shop, Resend key, budget pool).

### 4.6 Custom Domains: Caddy On-Demand TLS

```
{
  on_demand_tls {
    ask http://podclaw:8000/api/domains/verify
    interval 5m
    burst 5
  }
}

:443 {
  tls {
    on_demand
  }
  # ... proxy rules
}
```

El endpoint `/api/domains/verify` consulta la tabla `tenants` para verificar que el dominio es valido antes de provisionar certificado TLS.

---

## 5. Plan de Implementacion

### Fase 1: Foundation — Tabla de Tenants y Migracion Core (20h)

#### Bloque A: Tenant Model y Funciones Base (6h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| A1 | Crear tabla `tenants` con schema completo | Nueva migracion | 1h |
| A2 | Crear funcion `auth.tenant_id()` para extraer tenant_id de JWT claims | Nueva migracion | 30min |
| A3 | Crear funcion `set_tenant_id()` trigger que auto-popula `tenant_id` en INSERT | Nueva migracion | 30min |
| A4 | Crear `default tenant` row (tenant_id para la tienda existente) | Nueva migracion | 30min |
| A5 | Crear RLS policies para tabla `tenants` (owner puede leer/editar su tenant) | Nueva migracion | 1h |
| A6 | Crear funcion `provision_tenant()` que inicializa brand_config, legal_settings, themes | Nueva migracion | 1.5h |
| A7 | Endpoint Bridge: `POST /api/tenants/provision` (llama a `provision_tenant()`) | `podclaw/bridge/api.py` | 1h |

#### Bloque B: Migracion tenant_id a Tablas Core (8h)

| # | Tarea | Tablas Afectadas | Esfuerzo |
|---|-------|-----------------|----------|
| B1 | ADD COLUMN `tenant_id UUID REFERENCES tenants(id)` a tablas CORE | users, products, product_variants, designs, orders, order_items, shipping_addresses, conversations, messages | 2h |
| B2 | Backfill: UPDATE todas las rows existentes con el `default_tenant_id` | Todas las tablas core | 1h |
| B3 | ALTER COLUMN `tenant_id` SET NOT NULL despues del backfill | Todas las tablas core | 30min |
| B4 | Crear indexes compuestos `(tenant_id, ...)` para queries frecuentes | 9 tablas core | 2h |
| B5 | ADD COLUMN + backfill para tablas FEATURE | wishlists, wishlist_items, product_reviews, notifications, coupons, shipping_zones, personalizations, translations | 1.5h |
| B6 | ADD COLUMN + backfill para tablas CART/USAGE | cart_items, user_usage, credit_transactions, push_subscriptions | 1h |

#### Bloque C: Migracion Singletons a Multi-Tenant (6h)

| # | Tarea | Tabla | Esfuerzo |
|---|-------|-------|----------|
| C1 | `brand_config`: ADD `tenant_id`, DROP constraint de 1 row, crear UNIQUE `(tenant_id, is_active)` | brand_config | 1h |
| C2 | `store_themes`: ADD `tenant_id`, cambiar UNIQUE constraint a `(tenant_id, is_active)` | store_themes | 1h |
| C3 | `legal_settings`: ADD `tenant_id`, UNIQUE `(tenant_id)` | legal_settings | 45min |
| C4 | `legal_pages` + `legal_page_versions`: ADD `tenant_id` | legal_pages, legal_page_versions | 45min |
| C5 | `coupons`: ADD `tenant_id`, cambiar UNIQUE de `(code)` a `(tenant_id, code)` | coupons | 45min |
| C6 | `shipping_zones`: ADD `tenant_id` | shipping_zones | 30min |
| C7 | Duplicar rows singleton existentes para el default tenant + backfill tenant_id | Todas las singletons | 1.5h |

### Fase 2: RLS Multi-Tenant y Aislamiento de Datos (16h)

#### Bloque D: RLS Policies con tenant_id (8h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| D1 | Reescribir policies de tablas CORE: `USING (tenant_id = auth.tenant_id())` | 2h |
| D2 | Reescribir policies de tablas FEATURE + CART | 1.5h |
| D3 | Crear policies para tablas ANALYTICS (solo service_role + tenant match) | 1.5h |
| D4 | Crear policies para tablas AGENT (service_role + tenant match) | 1h |
| D5 | Crear policies para tablas MARKETING + MESSAGING | 1h |
| D6 | Crear policy especial para `products` — lectura publica filtrada por tenant del dominio | 1h |

#### Bloque E: Storage Isolation (4h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| E1 | Crear funcion `create_tenant_bucket(tenant_id)` que provee bucket Supabase Storage | 1h |
| E2 | RLS en buckets: `(storage.foldername(name))[1] = auth.tenant_id()::text` | 1h |
| E3 | Migrar imagenes existentes al bucket del default tenant | 1h |
| E4 | Actualizar Designer agent y frontend para usar bucket path con tenant_id | 1h |

#### Bloque F: PII Encryption at Rest con pgsodium (4h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| F1 | Habilitar extension `pgsodium` en Supabase (requiere contactar soporte en Cloud) | 30min |
| F2 | Crear server key para cifrado de columnas sensibles | 30min |
| F3 | Cifrar columnas PII: `users.email`, `users.phone`, `users.name` | 1h |
| F4 | Cifrar `shipping_addresses.full_name`, `street_line1`, `phone` | 1h |
| F5 | Cifrar `tenants.printify_api_token`, `resend_api_key`, `fal_key` | 30min |
| F6 | Crear vistas desencriptadas con SECURITY DEFINER para uso interno | 30min |

### Fase 3: Tenant Onboarding y Admin (18h)

#### Bloque G: Flujo de Onboarding (10h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| G1 | Pagina `/signup` para nuevos tenants (formulario: nombre, slug, email, plan) | 2h |
| G2 | API route `POST /api/tenants` — crear tenant + usuario owner en Supabase Auth | 1.5h |
| G3 | Trigger post-signup: `provision_tenant()` — crear brand_config, legal_settings, themes, storage bucket | 1.5h |
| G4 | Pagina `/onboarding` — wizard 4 pasos: branding, Printify conexion, Stripe Connect, dominio | 3h |
| G5 | API routes para cada paso del wizard (save progress, validate Printify token, iniciar Stripe Connect OAuth) | 2h |

#### Bloque H: Super-Admin Panel Multi-Tenant (8h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| H1 | Dashboard de tenants: lista, status, plan, revenue, agentes activos | 2h |
| H2 | Detalle de tenant: metricas, configuracion, logs, actions (suspend, upgrade, delete) | 2h |
| H3 | Crear role `platform_admin` separado de `tenant_admin` en admin RBAC | 1h |
| H4 | API routes admin para CRUD de tenants (`/api/admin/tenants/*`) | 2h |
| H5 | Audit log filtrado por tenant + vista cross-tenant para platform_admin | 1h |

### Fase 4: PodClaw Per-Tenant (14h)

#### Bloque I: Agent Isolation (8h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| I1 | Crear `TenantAgentConfig` class en `podclaw/tenant_config.py` | 1.5h |
| I2 | Cargar config de tenant desde Supabase al iniciar sesion de agente | 1h |
| I3 | Modificar `client_factory.py` para inyectar `tenant_id` en cada agent session | 1.5h |
| I4 | Modificar `cost_guard_hook` para usar budget del tenant (no global) | 1h |
| I5 | Crear tabla `tenant_agent_configs` (overrides de budgets, rate limits, enabled agents por tenant) | 1h |
| I6 | Modificar rate limiter para scope `{tenant_id}:{agent}:{tool}` | 1h |
| I7 | Memory isolation: directorio `memory/{tenant_id}/` separado por tenant | 1h |

#### Bloque J: Connectors Per-Tenant (6h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| J1 | Printify connector: aceptar `shop_id` y `api_token` por tenant (no env var global) | 1.5h |
| J2 | Stripe connector: aceptar `stripe_secret_key` por tenant (para Stripe Connect) | 1h |
| J3 | Resend connector: aceptar `api_key` y `from_email` por tenant | 1h |
| J4 | fal.ai connector: aceptar `fal_key` por tenant | 30min |
| J5 | Telegram/WhatsApp: configuracion per-tenant (bot token, phone number) | 1h |
| J6 | Desencriptar secrets de la tabla `tenants` al cargar connector config | 1h |

### Fase 5: Billing y Custom Domains (12h)

#### Bloque K: Stripe Connect + Subscriptions (8h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| K1 | Configurar Stripe Connect en modo Platform (Express accounts) | 1h |
| K2 | OAuth flow para conectar tenant a Stripe Connect | 2h |
| K3 | Checkout modificado: `payment_intent` con `application_fee_amount` para POD AI | 1.5h |
| K4 | Webhook handler para `account.updated`, `payout.created`, `charge.dispute` | 1.5h |
| K5 | Crear 4 planes de suscripcion en Stripe (free, starter, pro, enterprise) | 30min |
| K6 | API de billing: `GET /api/billing/usage`, `POST /api/billing/upgrade` | 1h |
| K7 | Enforcement de limites de plan (max_products, max_agents, max_daily_budget) | 30min |

#### Bloque L: Custom Domains (4h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| L1 | Caddy: configurar `on_demand_tls` con endpoint de verificacion | 1h |
| L2 | Endpoint `GET /api/domains/verify?domain=X` — consulta tabla tenants | 30min |
| L3 | UI admin: "Custom Domain" con instrucciones DNS (CNAME a platform.podai.com) | 1h |
| L4 | Middleware Next.js: resolver `tenant_id` desde `Host` header | 1h |
| L5 | DNS verification: check CNAME antes de activar dominio | 30min |

### Fase 6: SMTP Per-Tenant y Finalizacion (6h)

#### Bloque M: SMTP Custom (3h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| M1 | Tabla `tenant_smtp_configs`: host, port, user, pass_encrypted, from_email, from_name | 30min |
| M2 | Resend adapter: si tenant tiene SMTP custom, usar nodemailer en vez de Resend API | 1.5h |
| M3 | UI admin: configuracion SMTP con test de envio ("Send test email") | 1h |

#### Bloque N: Testing e Integracion (3h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| N1 | Test E2E: crear tenant, onboarding completo, publicar producto, procesar orden | 1.5h |
| N2 | Test de aislamiento: tenant A NO puede ver datos de tenant B via RLS | 1h |
| N3 | Test de performance: queries con 10 tenants x 1000 products cada uno | 30min |

---

## 6. Orden de Ejecucion

```
Fase 1 (20h) ──────> Fase 2 (16h) ──────> Fase 3 (18h)
  A: Tenant Model       D: RLS Multi-T       G: Onboarding
  B: tenant_id Core      E: Storage           H: Super-Admin
  C: Singletons          F: PII Encrypt
       |                      |
       |                      v
       |                 Fase 4 (14h) ──────> Fase 5 (12h) ──> Fase 6 (6h)
       |                   I: Agent Isol       K: Billing       M: SMTP
       |                   J: Connectors       L: Domains       N: Testing
       |
       +-- PREREQUISITO: Plan 01 (RLS base) + Plan 03 (auth sync, indexes)
```

### Dependencias criticas:
- **Fase 1** requiere Plan 01 completado (RLS habilitado en todas las tablas) y Plan 03 completado (auth.users sincronizado con public.users, indexes basicos)
- **Fase 2** requiere Fase 1 (tenant_id existe en las tablas)
- **Fase 3** requiere Fase 2 (RLS multi-tenant funciona)
- **Fase 4** puede ejecutarse en paralelo con Fase 3 (PodClaw es independiente del frontend)
- **Fase 5** requiere Fase 3 (onboarding debe existir para billing)
- **Fase 6** requiere Fases 4+5

### Paralelismo optimo (2 agentes):
```
Agente 1: Fase 1 → Fase 2 → Fase 3 → Fase 5
Agente 2:          Fase 2 F → Fase 4 → Fase 6
```
**Tiempo con 2 agentes**: ~55h elapsed (vs 86h secuencial)

---

## 7. Validaciones Tecnicas

| # | Validacion | Criterio de Exito |
|---|-----------|-------------------|
| V1 | tenant_id en todas las tablas | `SELECT table_name FROM information_schema.columns WHERE column_name = 'tenant_id'` retorna 56+ tablas |
| V2 | RLS multi-tenant funciona | Query con JWT de tenant A retorna 0 rows de tenant B |
| V3 | auth.tenant_id() funciona | `SELECT auth.tenant_id()` retorna UUID correcto del JWT claim |
| V4 | brand_config multi-tenant | 2 tenants con brand_config activa simultaneamente — sin UNIQUE violation |
| V5 | store_themes multi-tenant | Tenant A con tema "Ocean Blue" activo, Tenant B con "Crimson Red" — ambos funcionan |
| V6 | Coupons scoped | Tenant A y B pueden tener codigo "SUMMER20" — sin UNIQUE violation |
| V7 | Storage isolation | `supabase.storage.from('tenant-A-bucket').list()` retorna SOLO archivos de tenant A |
| V8 | PII cifrado | `SELECT email FROM users` retorna texto cifrado (no texto plano) |
| V9 | PodClaw per-tenant | Agente de tenant A usa Printify-shop-A (no Printify-shop-B) |
| V10 | Custom domain TLS | `curl https://mitienda.com` resuelve correctamente con certificado valido |
| V11 | Stripe Connect | Pago en tenant A genera payout a Connected Account de A + application_fee a plataforma |
| V12 | SMTP per-tenant | Email de tenant A sale desde `orders@mitienda.com` (no `noreply@podai.com`) |
| V13 | provision_tenant() | Llamar a la funcion crea brand_config, legal_settings, themes, bucket — todo con el tenant_id correcto |
| V14 | Plan limits | Tenant en plan "starter" con 50 products — intento de crear product #51 retorna error |

---

## 8. Validaciones de Negocio

- Un nuevo merchant puede registrarse, configurar su tienda, conectar Printify, y empezar a vender en <30 minutos
- Un cliente final comprando en `mitienda.com` NO sabe que POD AI es la plataforma subyacente (white-label completo)
- Los datos de un tenant suspendido/cancelado permanecen cifrados e inaccesibles pero no se borran (retencion legal 7 anos)
- POD AI cobra comision automatica en cada transaccion via Stripe Connect application_fee
- Un tenant puede migrar de plan "free" a "pro" sin downtime ni perdida de datos
- PodClaw opera independientemente por tenant — un agent crash en tenant A NO afecta a tenant B
- La informacion legal (Impressum, politica de privacidad) es diferente por tenant (cada tienda tiene su propio DPO, direccion, etc.)
- Los emails transaccionales de cada tenant salen con el dominio propio del merchant (no @podai.com)

---

## 9. Metricas de Exito

| Metrica | Antes (Single-Tenant) | Despues (Multi-Tenant) |
|---------|----------------------|----------------------|
| Tenants soportados | 1 | Ilimitados (plan-based) |
| Tablas con tenant_id | 0/64 | 56/64 |
| RLS multi-tenant | 0 policies | 56+ policies con `auth.tenant_id()` |
| Data isolation score | 0/10 | 9/10 (RLS + storage + PII encrypt) |
| Custom domains | 0 | N (on-demand TLS) |
| PII cifrado at-rest | 0 columnas | 8+ columnas con pgsodium |
| Agent isolation | 0/10 | 8/10 (config, budget, connectors per-tenant) |
| Billing automation | 0/10 | 8/10 (Stripe Connect + subscriptions) |
| Onboarding time | N/A | <30 min (signup → go-live) |
| SMTP per-tenant | 0 | N tenants con dominio propio |
| Platform revenue streams | 1 (ventas propias) | 3 (subscriptions + application_fee + premium features) |

### Metricas de performance multi-tenant:

| Metrica | Target |
|---------|--------|
| Query latency con 100 tenants | <50ms p95 (indice en tenant_id) |
| Tenant provisioning time | <10s (funcion + triggers) |
| TLS certificate provisioning | <30s (Caddy on-demand) |
| RLS overhead per query | <5ms adicionales |
| Storage per tenant (base) | <100MB (bucket initial) |

---

## 10. Estimacion Total

| Fase | Bloque | Horas | Acumulado |
|------|--------|-------|-----------|
| **Fase 1** | A — Tenant Model | 6h | 6h |
| | B — tenant_id Core | 8h | 14h |
| | C — Singletons Multi-T | 6h | 20h |
| **Fase 2** | D — RLS Multi-Tenant | 8h | 28h |
| | E — Storage Isolation | 4h | 32h |
| | F — PII Encryption | 4h | 36h |
| **Fase 3** | G — Onboarding Flow | 10h | 46h |
| | H — Super-Admin Multi-T | 8h | 54h |
| **Fase 4** | I — Agent Isolation | 8h | 62h |
| | J — Connectors Per-T | 6h | 68h |
| **Fase 5** | K — Stripe Connect | 8h | 76h |
| | L — Custom Domains | 4h | 80h |
| **Fase 6** | M — SMTP Per-Tenant | 3h | 83h |
| | N — Testing E2E | 3h | 86h |
| **Total** | | **86h** | — |

### Desglose por tipo de trabajo:

| Tipo | Horas | % |
|------|-------|---|
| Migraciones SQL | 26h | 30% |
| Backend (PodClaw/Bridge) | 22h | 26% |
| Frontend (Admin/Onboarding) | 18h | 21% |
| Infraestructura (Caddy/Storage/SMTP) | 12h | 14% |
| Testing | 8h | 9% |

### Riesgos y contingencia:

| Riesgo | Probabilidad | Impacto | Contingencia | Horas Extra |
|--------|-------------|---------|-------------|-------------|
| pgsodium no disponible en Supabase Cloud | Media | Alto | Usar pgcrypto como fallback (menos seguro) | +2h |
| Stripe Connect review process tarda >2 semanas | Alta | Medio | Implementar billing manual (invoicing) como bridge | +4h |
| Performance degradation con 100+ tenants | Baja | Alto | Partition tablas core por tenant_id | +8h |
| Caddy on-demand TLS rate limited por Let's Encrypt | Baja | Medio | Pre-provisionar certificados via API | +2h |
| Migracion de datos existentes rompe FKs | Media | Alto | Script de validacion pre-migration + rollback plan | +4h |

**Estimacion con riesgos**: 86-100h

**Esfuerzo con 2 agentes paralelos**: ~55h elapsed

---

### Hitos de Entrega:

| Hito | Fases | Horas | Entregable |
|------|-------|-------|-----------|
| **M1: Multi-Tenant Data Layer** | 1+2 | 36h | tenant_id en todas las tablas, RLS funcional, PII cifrado |
| **M2: Tenant Lifecycle** | 3 | 18h | Signup, onboarding, super-admin panel |
| **M3: Agent Isolation** | 4 | 14h | PodClaw per-tenant con budgets y connectors propios |
| **M4: Monetization** | 5+6 | 18h | Stripe Connect, custom domains, SMTP per-tenant |

Cada hito es un checkpoint deployable — se puede entregar M1 y operar con un solo tenant "default" mientras se construye M2-M4.

---

*Plan derivado de audit-360 (seccion 07-database-schema: "Multi-Tenant Readiness: NO LISTO") y 99-executive-summary (Fase 4 roadmap). Tablas, constraints y singletons verificados contra migraciones reales. 2026-02-23.*
