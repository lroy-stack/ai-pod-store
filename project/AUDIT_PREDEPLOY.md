# POD AI — Auditoría Técnica Pre-Producción
## Informe End-to-End · Febrero 2026

> **Ámbito:** Arquitectura completa · Frontend · Admin · PodClaw · Infraestructura Docker · Seguridad VPS · Preparación Open Source
> **VPS objetivo:** Hostinger · 8 núcleos · 32 GB RAM · 400 GB SSD
> **Estado general:** ✅ Sólido — requiere 9 correcciones críticas antes del primer deploy

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura General](#2-arquitectura-general)
3. [Auditoría de Infraestructura Docker](#3-auditoría-de-infraestructura-docker)
4. [Auditoría de Seguridad](#4-auditoría-de-seguridad)
5. [Auditoría del Frontend (Next.js Storefront)](#5-auditoría-del-frontend-nextjs-storefront)
6. [Auditoría del Admin Panel](#6-auditoría-del-admin-panel)
7. [Auditoría de PodClaw (Agente Autónomo)](#7-auditoría-de-podclaw-agente-autónomo)
8. [Gaps Identificados](#8-gaps-identificados)
9. [Plan de Acción Pre-Deploy](#9-plan-de-acción-pre-deploy)
10. [Dimensionamiento VPS](#10-dimensionamiento-vps)
11. [Checklist de Firewall y Red](#11-checklist-de-firewall-y-red)
12. [Preparación Open Source](#12-preparación-open-source)
13. [Documentación Recomendada](#13-documentación-recomendada)

---

## 1. Resumen Ejecutivo

POD AI es una plataforma de print-on-demand impulsada por IA con tres superficies principales: un **storefront multilingual** (EN/ES/DE) construido en Next.js 16, un **panel de administración** dedicado, y **PodClaw**, un sistema de agentes autónomos con 9 sub-agentes especializados que gestionan el negocio de forma autónoma (investigación, diseño, marketing, catálogo, finanzas, SEO, atención al cliente).

La arquitectura es técnicamente madura y bien pensada: Caddy como reverse proxy con HTTPS automático, servicios en red interna sin puertos expuestos al exterior, multi-stage Dockerfiles con usuarios no-root, y un modelo de seguridad de agentes en capas (SDK + hooks + sandboxing). Sin embargo, hay **9 issues críticos** y **14 mejoras importantes** que deben resolverse antes de un deploy de producción.

**Puntuación por área:**

| Área | Calidad | Notas |
|------|---------|-------|
| Arquitectura general | ⭐⭐⭐⭐⭐ | Excelente diseño de servicios |
| Docker / Compose | ⭐⭐⭐⭐ | Falta resource limits y Redis auth |
| Seguridad de agentes | ⭐⭐⭐⭐⭐ | Modelo de permisos muy robusto |
| Seguridad de red | ⭐⭐⭐⭐ | Falta CSP, rutas de test expuestas |
| Frontend / Auth | ⭐⭐⭐ | Validación JWT solo en cliente |
| Gestión de secretos | ⭐⭐⭐ | Sin Secret Management formal |
| Testing / CI | ⭐⭐ | Sin CI/CD, tests e2e sin ejecutar |
| Documentación | ⭐⭐⭐⭐ | Buena, pero falta guía de deploy |
| Preparación OSS | ⭐⭐ | Falta CONTRIBUTING, SECURITY global, LICENSE |

---

## 2. Arquitectura General

### 2.1 Topología de Servicios

```
Internet
    │
    ▼
[Caddy :80/:443]  ← TLS automático Let's Encrypt
    │
    ├─── /           → frontend:3000  (Next.js storefront)
    ├─── /panel*     → admin:3001     (Next.js admin panel)
    └─── /api/bridge → podclaw:8000   (FastAPI bridge)
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
         redis:6379              rembg:8080
         (cache/queue)          (bg removal)
              │
              ▼
         Supabase (cloud) ← única DB externa
```

**Evaluación:** La topología es correcta. Caddy como único punto de entrada, todos los servicios internos sin puertos expuestos hacia el host en producción. El servicio `rembg` está aislado y sólo accesible vía red interna. Supabase cloud-managed elimina la complejidad de auto-alojar PostgreSQL.

### 2.2 Stack Tecnológico

| Capa | Tecnología | Versión | Estado |
|------|-----------|---------|--------|
| Frontend | Next.js | 16.1.6 | ✅ Estable (última) |
| Runtime frontend | Node.js | 22 (Alpine) | ✅ LTS |
| Admin | Next.js | 16.x | ✅ |
| Agentes | Python | 3.12 | ✅ Estable |
| Bridge | FastAPI | ≥0.115 | ✅ |
| Cache | Redis | 7 (Alpine) | ✅ |
| Proxy | Caddy | 2 (Alpine) | ✅ |
| BD | Supabase (PostgreSQL 15) | Cloud | ✅ |
| SDK Agentes | claude-agent-sdk | ≥0.1.0 | ⚠️ No pinned |
| React | 19.2.0 | RC/Stable | ⚠️ Verificar compatibilidad |

---

## 3. Auditoría de Infraestructura Docker

### 3.1 `docker-compose.yml` (base)

**Lo que funciona correctamente:**
- Ningún servicio expone puertos al host en producción — correcto.
- Healthchecks configurados en todos los servicios.
- `depends_on` con condición `service_healthy` — orden de arranque garantizado.
- Redis con `appendonly yes` + `maxmemory 256mb` + política LRU — configuración apropiada.
- Volúmenes nombrados para datos persistentes (datos PodClaw, Redis, Caddy TLS).
- `restart: unless-stopped` en todos los servicios.

**Issues encontrados:**

#### 🔴 CRÍTICO: Sin límites de recursos en contenedores principales

Solo `rembg` tiene límite de memoria (2G). Los otros 4 servicios pueden consumir toda la RAM del VPS.

```yaml
# AÑADIR a cada servicio (valores sugeridos para 32GB VPS):
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

Distribución recomendada para VPS de 32GB:

| Servicio | RAM limit | RAM reserva | CPU limit |
|----------|-----------|-------------|-----------|
| frontend | 1G | 256M | 1.0 |
| admin | 512M | 128M | 0.5 |
| podclaw | 4G | 512M | 3.0 |
| rembg | 2G | 512M | 2.0 |
| redis | 512M | 128M | 0.5 |
| caddy | 256M | 64M | 0.5 |
| **Total** | **~8.5G** | **~1.6G** | **7.5** |
| **Sistema OS** | ~2G | — | 0.5 |

Esto deja ~20GB de RAM libre para el SO, buffers y picos de carga del agente.

#### 🔴 CRÍTICO: Redis sin contraseña

El servicio `redis` no tiene `requirepass`. Aunque no está expuesto al host en producción, si algún contenedor se compromete puede acceder directamente a Redis sin autenticación.

```yaml
redis:
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru --requirepass "${REDIS_PASSWORD}"
  environment:
    REDIS_PASSWORD: "${REDIS_PASSWORD}"
```

Y actualizar `REDIS_URL` en todos los servicios: `redis://:${REDIS_PASSWORD}@redis:6379`

#### 🟡 IMPORTANTE: podclaw usa env_file del frontend

```yaml
podclaw:
  env_file:
    - ../frontend/.env.local  # ← Todas las variables del frontend van a PodClaw
```

PodClaw recibe variables como `NEXT_PUBLIC_*` que no necesita, y las variables de Stripe y Printify están duplicadas. Crear `deploy/.env.podclaw` dedicado con solo las variables que PodClaw necesita.

#### 🟡 IMPORTANTE: Caddyfile healthcheck incorrecto

```yaml
caddy:
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/"]
```

En el compose base no hay binding de puertos — el check falla porque `localhost:80` dentro del contenedor Caddy sí existe. Pero el check debería usar la interfaz interna, no localhost del host. Verificar que el healthcheck pasa antes de deploy.

### 3.2 Dockerfiles

#### Frontend & Admin — Multi-Stage ✅

Los Dockerfiles de frontend y admin son ejemplares:
- 3 etapas: `deps` → `builder` → `runner`
- Usuario no-root (`nextjs:1001`) en runner
- `NEXT_TELEMETRY_DISABLED=1`
- Build args para variables públicas
- `--no-cache-dir` en pip equivalente para npm
- `standalone` output de Next.js — imagen mínima

**Issue menor:** La instrucción `npm install --ignore-scripts=false` permite la ejecución de scripts de instalación de paquetes. Para producción usar `--ignore-scripts=true` y verificar que el build funciona, o al menos añadir `--audit` en CI.

#### PodClaw Dockerfile ✅

- Usuario no-root (`podclaw:1001`) — ✅
- `--no-cache-dir` — ✅
- Directorios de datos pre-creados con permisos correctos — ✅
- Healthcheck configurado — ✅

**Issue:** No hay `--no-new-privileges` ni seccomp profile. Para hardening adicional añadir en docker-compose:

```yaml
podclaw:
  security_opt:
    - no-new-privileges:true
```

#### rembg Dockerfile ⚠️

- **Ejecuta como root** — no hay usuario no-root configurado
- El modelo u2net (176MB) se descarga en build time — ✅ correcto
- Dependencias sin versiones exactas (solo `>=`)

```dockerfile
# AÑADIR antes de CMD:
RUN addgroup --system --gid 1001 rembg && \
    adduser --system --uid 1001 --ingroup rembg rembg && \
    chown -R rembg:rembg /app
USER rembg
```

### 3.3 Caddyfile

**Lo correcto:**
- Routing limpio: `/api/bridge/*` → podclaw, `/panel*` → admin, resto → frontend
- Headers de seguridad: HSTS, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy
- `encode zstd gzip` — compresión activa
- `Server` header eliminado (`-Server`)

**Issues:**

#### 🔴 CRÍTICO: Falta Content-Security-Policy (CSP)

```caddyfile
header {
  # ... headers existentes ...
  Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; frame-src https://js.stripe.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com;"
  Permissions-Policy "camera=(), microphone=(), geolocation=()"
}
```

#### 🟡 IMPORTANTE: Falta rate limiting en Caddy

Para endpoints sensibles como `/api/bridge` añadir rate limiting a nivel Caddy como primera línea de defensa.

---

## 4. Auditoría de Seguridad

### 4.1 Gestión de Secretos

**Estado actual:** Todos los secretos se gestionan via archivos `.env.local`. No hay Secret Manager formal.

**Issues:**

#### 🔴 CRÍTICO: URL real de Supabase en archivo de ejemplo

`admin/.env.local.example` contiene:
```
SUPABASE_URL=https://your-project.supabase.co
```

Esto es una URL de proyecto real, no un placeholder. Si este archivo se commitea en el repo público, el ID del proyecto de Supabase queda expuesto. **Reemplazar por `https://your-project-id.supabase.co`.**

#### 🟡 IMPORTANTE: Sin rotación de secretos documentada

Para open source, documentar cómo rotar cada secreto:
- `PODCLAW_BRIDGE_AUTH_TOKEN` → regenerar y reiniciar podclaw + admin
- `JWT_SECRET` → invalida todas las sesiones activas
- Claves API de Anthropic, Stripe, etc. → proceso en cada proveedor

#### 🟡 IMPORTANTE: `NEXT_PUBLIC_GOOGLE_AI_KEY` expuesto al cliente

```env
NEXT_PUBLIC_GOOGLE_AI_KEY=...  # ← Esta variable va al bundle del navegador
```

Una clave de Google AI en el frontend es una vulnerabilidad. Cualquier usuario puede extraerla del bundle JS. Mover las llamadas a Gemini a un API route de Next.js en el servidor.

#### 🟡: Gestión de `.env.local` en VPS

El archivo `frontend/.env.local` contiene todos los secretos y es leído directamente por docker-compose. Para un setup más robusto, considerar Docker Secrets o variables de entorno del sistema para secretos críticos.

### 4.2 Autenticación del Bridge (PodClaw)

**Evaluación: Buena** — La implementación en `auth.py` es sólida:
- Comparación en tiempo constante (`secrets.compare_digest`) — protege contra timing attacks ✅
- Rate limiting con lockout de 5 minutos ✅
- Localhost exempt para acceso mismo-host ✅
- Fail-closed: si no hay token configurado, retorna 503 ✅

**Issue:** El rate limiter está en memoria (`AuthRateLimiter`). Se resetea al reiniciar el contenedor. Para producción, migrar a Redis para persistencia entre reinicios.

### 4.3 Autenticación del Frontend

**Issue crítico:**

```typescript
// middleware.ts línea 94
const accessToken = request.cookies.get('sb-access-token')?.value
if (!accessToken) {
  // Redirect to login
}
```

El middleware de Next.js solo verifica la **existencia** del cookie `sb-access-token`, no su validez criptográfica. Un atacante podría enviar cualquier valor en ese cookie para acceder a rutas protegidas. La validación real debe hacerse en el servidor:

```typescript
// Corrección: verificar con Supabase server client
import { createServerClient } from '@supabase/ssr'
const supabase = createServerClient(...)
const { data: { user } } = await supabase.auth.getUser()
if (!user) { /* redirect */ }
```

**Nota:** Si Supabase SSR está configurado en los route handlers individuales, el middleware puede ser solo una primera línea — verificar que cada API route protegida valida sesión independientemente.

### 4.4 Rutas de Test Expuestas en Producción

**🔴 CRÍTICO:** El frontend tiene rutas API de test que no deben existir en producción:

```
/api/test-email
/api/test-telegram-start
/api/test-telegram-webhook
/api/test-messaging
/api/test-rate-limit
/api/test-rls
/api/test-error
```

Estas rutas pueden:
- Revelar configuración del sistema
- Disparar envíos de email o mensajes Telegram
- Exponer detalles de errores internos

**Solución:**
```typescript
// En cada route.ts de test:
if (process.env.NODE_ENV === 'production') {
  return NextResponse.json({ error: 'Not available' }, { status: 404 })
}
```
O mejor: mover todos a una carpeta `src/app/api/__tests__/` y excluirla del build de producción.

### 4.5 Seguridad de PodClaw (Agentes)

**Evaluación: Excelente** — El modelo de seguridad de agentes es uno de los puntos más fuertes del proyecto:

✅ **Deny chain de 3 hooks:** security → cost_guard → rate_limit
✅ **Fail-closed en security_hook** (error = deneído)
✅ **SDK `max_budget_usd`** como backstop duro
✅ **`allowed_tools` por agente** — ninguno tiene acceso a Bash
✅ **SandboxSettings** — aislamiento OS-level
✅ **`[DATA]` boundaries** para inyección desde APIs externas
✅ **Detección de inyección** en `memory_manager.py`
✅ **PII stripping** antes de almacenar
✅ **Audit log completo** en Supabase

**Issue menor:** El `BRIDGE_AUTH_ENABLED` tiene default `"true"` en `config.py`, pero en `docker-compose.yml` base no se establece explícitamente. El `docker-compose.prod.yml` sí lo establece. Añadir `PODCLAW_BRIDGE_AUTH_ENABLED: "true"` explícito en el compose base para mayor claridad.

### 4.6 `.gitignore` — Datos Sensibles

**Issue:** `podclaw/memory/` no está en `.gitignore`. La memoria de los agentes puede contener información sensible del negocio (customer insights, pricing history, etc.).

```gitignore
# AÑADIR:
podclaw/memory/
podclaw/data/
*.log
admin.log
```

Los archivos `admin.log` y `podclaw/test_e2e_pipeline_run*.log` contienen trazas de ejecución que no deberían commitearse.

---

## 5. Auditoría del Frontend (Next.js Storefront)

### 5.1 Estructura de Rutas

```
src/app/
├── [locale]/           # i18n: EN, ES, DE
│   ├── (landing)/      # Hero, carousel, CTA — layout mínimo
│   ├── (app)/          # StorefrontLayout (sidebar + header)
│   │   ├── chat/       # Chat con PodClaw
│   │   ├── shop/       # Catálogo de productos
│   │   ├── cart/       # Carrito
│   │   ├── orders/     # Pedidos del usuario
│   │   ├── profile/    # Perfil
│   │   └── wishlist/   # Wishlists
│   └── (focused)/      # Auth, Checkout (sin sidebar)
└── api/                # ~30 API routes (backend-for-frontend)
```

**Evaluación:** La arquitectura de route groups es correcta y bien implementada. La separación `(landing)/(app)/(focused)` es clara y evita contaminar layouts.

### 5.2 API Routes (30+)

El frontend actúa como Backend-for-Frontend (BFF). Las rutas cubren:
- Auth (`/api/auth/*`)
- Productos, carrito, pedidos, wishlist
- Pagos (`/api/webhooks/stripe`, checkout)
- Comunicación (`/api/telegram`, `/api/newsletter`)
- Analytics (`/api/analytics`, `/api/ab-test`)
- Admin proxy (`/api/agent/*` → podclaw bridge)

**Issues:**
- Las rutas de webhook (`/api/webhooks/stripe`) deben verificar firma de Stripe — verificar implementación.
- Las rutas `/api/cron/*` deben protegerse con `CRON_SECRET` o IP whitelist para evitar activación no autorizada.

### 5.3 Middleware

El middleware implementa:
- **i18n** (next-intl) — routing multilingüe ✅
- **A/B testing** — asignación determinista por visitor ID ✅
- **Auth guard** para `/profile` y `/orders` — ⚠️ validación superficial (ver §4.3)

**Missing:** El middleware no cubre `/cart` y `/checkout` (guest checkout intencional). Verificar que el flujo de checkout no permita operaciones no autorizadas via API directamente.

### 5.4 Calidad de Código

- **Next.js 16 + React 19** — Stack muy moderno, con potential breaking changes en React 19.
- **shadcn/ui** — Design system consistente, bien documentado en `CLAUDE.md`.
- **Semantic tokens** — tokens de Tailwind correctamente abstraídos.
- Múltiples scripts de test e2e configurados en `package.json` — buena señal.

**No se encontraron tests unitarios propios del proyecto** (solo dependencias).

---

## 6. Auditoría del Admin Panel

### 6.1 Estructura

```
admin/src/app/
├── login/          # Autenticación del admin
├── agent/          # Control de PodClaw (agents, tasks, memory, soul)
├── analytics/      # Métricas y reportes
├── customers/      # Gestión de clientes
├── designs/        # Librería de diseños
├── finance/        # Reportes financieros
├── messaging/      # Campañas email, Telegram, WhatsApp
├── orders/         # Gestión de pedidos
├── products/       # Catálogo admin
├── returns/        # Devoluciones
├── reviews/        # Reviews de clientes
├── seo/            # Gestión SEO
├── settings/       # Configuración de la tienda
├── translations/   # Gestión de i18n
└── audit/          # Log de auditoría
```

**Evaluación:** Panel completo y bien estructurado. La integración con PodClaw via bridge está bien planteada.

### 6.2 Autenticación del Admin

El admin tiene su propio flujo de login (`admin/src/app/login/`). Verificar:
- ¿El panel admin usa Supabase Auth con RLS para restringir acceso solo a admins?
- ¿Existe protección de rutas admin equivalente al middleware del frontend?

**Recomendación crítica:** El panel admin debe estar protegido con autenticación de dos factores (2FA/TOTP) antes de producción.

### 6.3 `PODCLAW_BRIDGE_AUTH_TOKEN` en Admin

El admin necesita el token del bridge para comunicarse con PodClaw. Este token está en `admin/.env.local`. En producción, asegurarse de que este valor sea diferente al de desarrollo y sea suficientemente largo (mínimo 32 bytes aleatorios):

```bash
openssl rand -hex 32
```

---

## 7. Auditoría de PodClaw (Agente Autónomo)

### 7.1 Arquitectura de Agentes

**9 sub-agentes especializados:**

| Agente | Modelo | Budget/sesión | Budget/día | Conectores |
|--------|--------|---------------|------------|------------|
| researcher | Haiku | $0.60 | $1.50 | Supabase, Jina, WebSearch |
| marketing | Sonnet | $1.00 | $2.00 | Supabase, Jina, Resend, Telegram, WhatsApp |
| designer | Sonnet | $1.50 | $3.00 | Supabase, fal.ai, Printify, Gemini |
| newsletter | Sonnet | $0.80 | $1.50 | Supabase, Resend, Gemini |
| cataloger | Sonnet | $6.00 | $15.00 | Supabase, Printify, Gemini |
| customer_manager | Sonnet | $1.00 | $2.00 | Supabase, Resend, Stripe, Telegram, WhatsApp, Printify |
| seo_manager | Haiku | $0.50 | $1.00 | Supabase, Jina |
| finance | Sonnet | $1.20 | $2.50 | Supabase, Stripe |
| qa_inspector | Haiku | $0.15 | $0.15 | Supabase, Gemini, Printify |

**Nota:** El cataloger tiene el mayor budget por sesión ($6.00) — correcto dado que maneja creación en batch de productos Printify.

**⚠️ Discrepancia detectada:** `SECURITY.md` muestra una tabla de budgets diferente a `config.py`. El código (`config.py`) es el que aplica — actualizar `SECURITY.md`.

### 7.2 Conectores (9 integraciones)

- `fal_connector.py` — Generación de imágenes IA
- `gemini_connector.py` — QA visual, embeddings, generación fallback
- `jina_connector.py` — Web search, reranking
- `printify_connector.py` — Fulfillment (crear, publicar, gestionar productos)
- `resend_connector.py` — Email transaccional
- `stripe_connector.py` — Pagos, reembolsos
- `supabase_connector.py` — Base de datos, storage
- `telegram_connector.py` — Notificaciones admin, campañas
- `whatsapp_connector.py` — Campañas WhatsApp Business

**Evaluación:** Cobertura completa para el negocio planteado. Los conectores están bien separados y el `client_factory.py` gestiona la inicialización lazy.

### 7.3 Sistema de Memoria

```
podclaw/memory/
├── MEMORY.md          # Memoria long-term (weekly consolidation)
├── HEARTBEAT.md       # Checklist operacional
├── daily/             # Logs diarios por fecha
└── context/           # Archivos de contexto por agente
    ├── best_sellers.md
    ├── customer_insights.md
    ├── design_library.md
    ├── marketing_calendar.md
    ├── newsletter_segments.md
    ├── pricing_history.md
    ├── product_specs.md
    └── store_config.md
```

La rotación de archivos de contexto (`CONTEXT_FILE_MAX_LINES`) evita el crecimiento ilimitado — diseño correcto.

### 7.4 Heartbeat y Scheduler

- **Heartbeat cada 30 min** (configurable): revisión de salud de la tienda, alertas proactivas.
- **Scheduler APScheduler**: ciclos diarios siguiendo el ritmo en `SOUL.md` (06:00 research → 23:30 consolidación).
- **Soul Evolution**: el agente puede proponer cambios a su propia identidad (SOUL.md), sujetos a aprobación del admin — diseño innovador y prudente.

### 7.5 Hooks del SDK (10 hooks)

| Hook | Tipo | Función |
|------|------|---------|
| `security_hook` | PreToolUse (fail-closed) | Allowlist de herramientas + patterns peligrosos |
| `cost_guard_hook` | PreToolUse | Límite diario de gasto |
| `rate_limit_hook` | PreToolUse | Límite de calls por herramienta/sesión |
| `event_log_hook` | PostToolUse | Audit trail en Supabase |
| `metrics_hook` | PostToolUse | Métricas de uso |
| `quality_gate_hook` | PostToolUse | Verificación de calidad de outputs |
| `memory_hook` | Stop | Persistencia de memoria al finalizar |
| `sync_hook` | Stop | Sincronización de estado |
| `transparency_hook` | Stop | Log de decisiones |
| `_parse_output.py` | Helper | Parseo estructurado de resultados |

**Evaluación: Excelente.** La cobertura de hooks es comprehensiva. El patrón fail-closed en security_hook es la práctica más importante para agentes autónomos.

### 7.6 `requirements.txt` — Dependencias No Pinned

```
claude-agent-sdk>=0.1.0     # ← No pinned
fastapi>=0.115.0            # ← No pinned
```

Para reproducibilidad en producción, usar versiones exactas:

```bash
# En el VPS, ejecutar:
pip install -r deploy/requirements.txt
pip freeze > deploy/requirements.lock.txt
# Y usar requirements.lock.txt en el Dockerfile
```

---

## 8. Gaps Identificados

### 8.1 Gaps Críticos (resolver antes de deploy)

| # | Gap | Impacto | Área |
|---|-----|---------|------|
| G-1 | Sin límites de recursos en contenedores | Un agente runaway puede tumbar el VPS | Docker |
| G-2 | Redis sin contraseña | Acceso no autenticado desde otros contenedores | Seguridad |
| G-3 | URL real de Supabase en ejemplo del admin | Expone ID de proyecto en repo público | Seguridad |
| G-4 | Rutas `/api/test-*` accesibles en producción | Exposición de funcionalidad interna | Seguridad |
| G-5 | Auth middleware no valida JWT | Bypass de protección de rutas | Seguridad |
| G-6 | `NEXT_PUBLIC_GOOGLE_AI_KEY` expuesto al cliente | API key pública en bundle JS | Seguridad |
| G-7 | `podclaw/memory/` no en `.gitignore` | Datos de negocio en repo público | Privacidad |
| G-8 | Sin CI/CD pipeline | Sin validación automática de cambios | Calidad |
| G-9 | rembg ejecuta como root | Superficie de ataque aumentada | Seguridad |

### 8.2 Gaps Importantes (resolver en primeras semanas)

| # | Gap | Impacto | Área |
|---|-----|---------|------|
| G-10 | Sin CSP headers | Vulnerabilidad XSS | Seguridad |
| G-11 | requirements.txt no pinned | Builds no reproducibles | DevOps |
| G-12 | Rate limiter del bridge en memoria | Se resetea con cada restart | Resiliencia |
| G-13 | Sin 2FA para admin panel | Riesgo si credenciales comprometidas | Seguridad |
| G-14 | podclaw env_file = frontend env | Variables innecesarias en PodClaw | Organización |
| G-15 | Discrepancia budgets SECURITY.md vs config.py | Documentación incorrecta | Docs |
| G-16 | Sin estrategia de backup de volúmenes | Pérdida de datos en fallo | Operaciones |
| G-17 | Sin log rotation configurada | Discos llenos a largo plazo | Operaciones |
| G-18 | Sin monitoring/alerting externo | Incidentes sin detección proactiva | Operaciones |

### 8.3 Gaps para Open Source

| # | Gap | |
|---|-----|-|
| G-19 | Sin `LICENSE` en raíz del proyecto | Requerido para OSS |
| G-20 | Sin `CONTRIBUTING.md` global | Solo existe en podclaw/ |
| G-21 | Sin `SECURITY.md` global (nivel proyecto) | Solo existe en podclaw/ |
| G-22 | Sin `CODE_OF_CONDUCT.md` | Best practice OSS |
| G-23 | Sin guía de instalación one-click | Para que sea "directly installable" |
| G-24 | Sin documentación de RLS de Supabase | Tabla de migrations no documentada |
| G-25 | Sin changelog (`CHANGELOG.md`) | Para tracking de versiones |

---

## 9. Plan de Acción Pre-Deploy

### Fase 1: Correcciones Críticas de Seguridad (1-2 días)

**1. Corregir `.gitignore`:**
```gitignore
podclaw/memory/
podclaw/data/
*.log
admin.log
podclaw/test_e2e_*
```

**2. Corregir `admin/.env.local.example` — reemplazar URL real:**
```env
SUPABASE_URL=https://your-project-id.supabase.co
```

**3. Deshabilitar rutas de test en producción:**
Añadir en cada `api/test-*/route.ts`:
```typescript
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }
  // ... test logic
}
```

**4. Mover `NEXT_PUBLIC_GOOGLE_AI_KEY` al servidor:**
Crear `/api/embeddings/route.ts` que haga la llamada server-side y eliminar la variable pública.

**5. Corregir validación de auth en middleware:**
Usar Supabase SSR para validar el token, no solo verificar existencia del cookie.

### Fase 2: Infraestructura Docker (1 día)

**6. Añadir Redis password al compose:**
```yaml
redis:
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru --requirepass "${REDIS_PASSWORD:?}"
```

**7. Añadir resource limits a todos los servicios** (ver §3.1 tabla de distribución).

**8. Añadir `security_opt` a podclaw:**
```yaml
podclaw:
  security_opt:
    - no-new-privileges:true
```

**9. Añadir usuario no-root en rembg Dockerfile** (ver §3.2).

**10. Añadir CSP en Caddyfile** (ver §3.3).

**11. Crear `deploy/.env.podclaw` dedicado.**

### Fase 3: Firewall y VPS (2-4 horas)

Ver sección §11 para checklist completo.

### Fase 4: CI/CD Básico (1 día)

Crear `.github/workflows/ci.yml` mínimo:
```yaml
name: CI
on: [push, pull_request]
jobs:
  lint-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd frontend && npm ci && npm run lint && npm run type-check
  lint-admin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd admin && npm ci && npm run lint
  lint-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install ruff mypy && ruff check podclaw/ && mypy podclaw/ --ignore-missing-imports
  build-docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose -f deploy/docker-compose.yml build
```

### Fase 5: Documentación OSS (2-3 días)

Ver sección §12 y §13.

---

## 10. Dimensionamiento VPS

### Hostinger VPS: 8 núcleos · 32 GB RAM · 400 GB SSD

**Evaluación:** El VPS es adecuado para este stack, con holgura para escalar.

### Distribución de Recursos

```
RAM TOTAL: 32 GB
├── Sistema operativo (Ubuntu 22):       ~1.5 GB
├── Docker daemon + overhead:            ~0.5 GB
├── caddy:                               ~0.25 GB
├── redis:                               ~0.5 GB
├── frontend (Next.js):                  ~1.0 GB
├── admin (Next.js):                     ~0.5 GB
├── rembg (u2net en memoria):            ~2.0 GB
├── podclaw (agentes + FastAPI):         ~4.0 GB
│   └── Modelo LLM: llamadas API ext.   (no usa RAM local)
├── Buffer para picos:                   ~4.0 GB
└── RAM libre:                           ~17.75 GB ← Holgura excelente
```

**CPU (8 núcleos):**
- Os + overhead: ~0.5
- Frontend + Admin: ~1.5 (occasional spikes en builds)
- PodClaw (múltiples agentes async): ~3.0 (picos cuando corren varios agentes)
- rembg (CPU inference): ~2.0 (cuando está procesando)
- Redis + Caddy: ~0.5
- Buffer: ~0.5

**Almacenamiento (400 GB SSD):**

| Uso | Estimado |
|-----|----------|
| Sistema operativo | ~15 GB |
| Docker images (todas) | ~6 GB |
| Imágenes rembg + u2net | ~2 GB |
| Redis AOF data | ~1 GB |
| PodClaw data (SQLite + memory) | ~2 GB |
| Caddy TLS certs | ~1 MB |
| Logs | ~10 GB (con rotation) |
| Imágenes generadas por agentes | ~20 GB |
| **Total estimado** | **~56 GB** |
| **Disponible** | **~344 GB** |

**El VPS tiene capacidad más que suficiente.** Con esta holgura, se podría añadir Supabase auto-hosted en el futuro si se desea eliminar la dependencia cloud.

### Docker Build Times (estimados)

| Imagen | Build time cold | Build time cached |
|--------|-----------------|-------------------|
| frontend | ~4 min | ~30 s |
| admin | ~3 min | ~25 s |
| podclaw | ~2 min | ~20 s |
| rembg | ~8 min (descarga u2net) | ~1 min |
| **Total** | **~17 min** | **~2 min** |

**Recomendación:** Usar GitHub Actions o BuildKit con cache para CI/CD.

---

## 11. Checklist de Firewall y Red

### 11.1 Configuración UFW (Ubuntu Firewall)

```bash
# 1. Instalar y configurar UFW
sudo apt-get install -y ufw fail2ban

# 2. Política por defecto: denegar todo
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 3. Permitir SOLO los puertos necesarios
sudo ufw allow 22/tcp comment 'SSH'        # ⚠️ Cambiar a puerto custom
sudo ufw allow 80/tcp comment 'HTTP → Caddy (redirect a HTTPS)'
sudo ufw allow 443/tcp comment 'HTTPS → Caddy'

# 4. NUNCA abrir estos puertos al exterior:
# sudo ufw allow 3000  # ❌ Frontend interno
# sudo ufw allow 3001  # ❌ Admin interno
# sudo ufw allow 8000  # ❌ PodClaw bridge interno
# sudo ufw allow 6379  # ❌ Redis interno
# sudo ufw allow 8080  # ❌ rembg interno

# 5. Activar
sudo ufw enable
sudo ufw status verbose
```

### 11.2 Fail2Ban (protección SSH y HTTP)

```bash
# Configurar fail2ban para SSH
sudo tee /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 22  # o tu puerto custom
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600

[nginx-http-auth]
enabled = false  # Caddy, no nginx
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 11.3 SSH Hardening

```bash
# /etc/ssh/sshd_config
sudo tee -a /etc/ssh/sshd_config << 'EOF'
Port 2222                    # Cambiar puerto por defecto
PermitRootLogin no           # No root por SSH
PasswordAuthentication no    # Solo llaves SSH
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 20
X11Forwarding no
EOF

sudo systemctl restart sshd

# Actualizar UFW si se cambia el puerto:
sudo ufw delete allow 22/tcp
sudo ufw allow 2222/tcp comment 'SSH custom port'
```

### 11.4 Docker Network Isolation

Los contenedores de Docker Compose por defecto crean una red bridge interna (`podai_default`). Verificar que no haya binding de puertos al host `0.0.0.0` en producción:

```bash
# Verificar puertos expuestos (debe mostrar SOLO 80 y 443):
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

### 11.5 Actualizaciones Automáticas de Seguridad

```bash
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
# Seleccionar: sí para actualizaciones de seguridad automáticas
```

### 11.6 Protección adicional del Bridge

El bridge PodClaw (`/api/bridge/*`) pasa por Caddy. Añadir rate limiting a nivel Caddy:

```caddyfile
handle /api/bridge/* {
    rate_limit {remote.ip} 10r/m  # 10 requests por minuto por IP
    uri strip_prefix /api/bridge
    reverse_proxy podclaw:8000
}
```

### 11.7 Monitoreo de Seguridad

```bash
# Instalar Lynis para auditoría periódica
sudo apt-get install -y lynis
sudo lynis audit system

# Verificar puertos en escucha
sudo ss -tulpn | grep LISTEN

# Verificar procesos corriendo como root innecesariamente
sudo ps aux | grep -v "^root" | grep -v "^$(whoami)"
```

---

## 12. Preparación Open Source

### 12.1 Estructura de Archivos OSS Necesarios

```
podai/                          # Raíz del repo
├── LICENSE                     # ← FALTA — añadir (MIT recomendado)
├── README.md                   # ← Existe, revisar §13.1
├── CONTRIBUTING.md             # ← FALTA (existe en podclaw/, mover/ampliar)
├── SECURITY.md                 # ← FALTA global (existe en podclaw/)
├── CODE_OF_CONDUCT.md          # ← FALTA
├── CHANGELOG.md                # ← FALTA
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # ← FALTA
│   │   └── release.yml         # ← Opcional
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md       # ← FALTA
│   │   └── feature_request.md  # ← FALTA
│   └── PULL_REQUEST_TEMPLATE.md # ← FALTA
├── deploy/
│   ├── docker-compose.yml      # ✅
│   ├── docker-compose.prod.yml # ✅
│   ├── docker-compose.local.yml # ✅
│   └── .env.example            # ✅ (revisar datos reales)
└── docs/                       # ← FALTA directorio completo
    ├── architecture.md
    ├── installation.md
    ├── configuration.md
    ├── supabase-setup.md
    └── faq.md
```

### 12.2 Licencia Recomendada

Para un proyecto que quieres publicar como open source pero con modelo de negocio, considera:

- **MIT** — máxima adopción, mínimas restricciones. Cualquiera puede fork y comercializar.
- **Apache 2.0** — MIT + protección de patentes. Recomendado para proyectos de empresa.
- **AGPL-3.0** — Si quieres que derivados también sean open source (copyleft fuerte).
- **Business Source License (BSL)** — Open source con restricción comercial temporal.

**Recomendación:** Si el objetivo es adopción máxima y publicarlo como portfolio, **MIT**. Si buscas protegerte de competidores que tomen el código, **AGPL-3.0**.

### 12.3 Instalación One-Click

Para que sea "directly installable", crear un script de bootstrap:

```bash
# install.sh — instalación en VPS limpio
#!/bin/bash
set -euo pipefail

echo "🐙 POD AI — Instalador"
echo "======================"

# Verificar dependencias
command -v docker >/dev/null || { echo "Instala Docker primero"; exit 1; }
command -v docker compose >/dev/null || { echo "Instala Docker Compose v2"; exit 1; }

# Configuración interactiva
read -p "Dominio (ej: podai.com): " DOMAIN
read -p "Supabase URL: " SUPABASE_URL
read -p "Supabase Anon Key: " SUPABASE_ANON_KEY
# ... más variables

# Generar secretos automáticamente
PODCLAW_BRIDGE_AUTH_TOKEN=$(openssl rand -hex 32)
REDIS_PASSWORD=$(openssl rand -hex 16)

# Crear .env.local desde template
envsubst < deploy/.env.example > frontend/.env.local
# ...

# Build y deploy
DOMAIN=$DOMAIN docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml up -d

echo "✅ POD AI desplegado en https://$DOMAIN"
```

### 12.4 Supabase Setup Documentado

El proyecto depende de Supabase cloud. Crear `docs/supabase-setup.md` con:
1. Crear proyecto en supabase.com
2. Tablas requeridas (con SQL de creación)
3. RLS policies necesarias
4. Storage buckets
5. Auth providers (OAuth)
6. Edge Functions (si aplica)
7. Webhooks necesarios

Esta es la pieza de documentación más crítica para que alguien pueda instalar el proyecto desde cero.

---

## 13. Documentación Recomendada

### 13.1 README.md Revisión

El README actual debe incluir:

```markdown
# POD AI

> Plataforma de print-on-demand autogestionada por IA

## ✨ Features
- Tienda multilingual (EN/ES/DE)
- 9 agentes IA autónomos (PodClaw)
- Gestión completa de catálogo vía Printify
- Pagos Stripe + fulfillment automático
- Panel de administración completo

## 🚀 Quick Start

### Prerequisitos
- Docker 24+
- Docker Compose 2+
- Cuenta Supabase (cloud, gratis)
- Dominio apuntando al servidor

### Instalación
\`\`\`bash
git clone https://github.com/tu-org/podai
cd podai
cp deploy/.env.example frontend/.env.local
# Editar frontend/.env.local con tus valores
DOMAIN=tudominio.com docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml up -d
\`\`\`

## 📚 Documentación
- [Arquitectura](docs/architecture.md)
- [Configuración](docs/configuration.md)
- [Setup Supabase](docs/supabase-setup.md)
- [PodClaw Agents](podclaw/README.md)

## 🛡️ Seguridad
Ver [SECURITY.md](SECURITY.md) para reportar vulnerabilidades.

## 📄 Licencia
MIT — ver [LICENSE](LICENSE)
```

### 13.2 Documentación de Variables de Entorno

Crear tabla exhaustiva en `docs/configuration.md`:

| Variable | Servicio | Requerida | Descripción | Ejemplo |
|----------|---------|-----------|-------------|---------|
| `SUPABASE_URL` | Frontend, Admin, PodClaw | ✅ | URL del proyecto Supabase | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Admin, PodClaw | ✅ | Service role key (nunca exponer) | `eyJ...` |
| `ANTHROPIC_API_KEY` | PodClaw | ✅ | Clave API de Anthropic para Claude | `sk-ant-...` |
| `STRIPE_SECRET_KEY` | Frontend | ✅ | Clave secreta de Stripe | `sk_live_...` |
| `PODCLAW_BRIDGE_AUTH_TOKEN` | Admin, PodClaw | ✅ | Token de auth del bridge (min 32 chars) | `openssl rand -hex 32` |
| `REDIS_PASSWORD` | Redis, todos | ✅ (prod) | Password de Redis | `openssl rand -hex 16` |
| `DOMAIN` | Caddy | ✅ (prod) | Dominio principal | `podai.com` |
| ... | | | | |

### 13.3 Runbook de Operaciones

Crear `docs/operations.md` con:
- Cómo ver logs: `docker compose logs -f [service]`
- Cómo reiniciar un agente: via admin panel o `POST /agents/{name}/run`
- Cómo hacer backup de volúmenes
- Cómo rotar secretos
- Cómo actualizar la plataforma
- Troubleshooting común

---

## Apéndice: Checklist Pre-Deploy Ejecutable

```bash
#!/bin/bash
# pre-deploy-check.sh

echo "=== POD AI — Pre-Deploy Checklist ==="

PASS=0; FAIL=0

check() {
    if eval "$2"; then
        echo "✅ $1"; ((PASS++))
    else
        echo "❌ $1 — FALLA"; ((FAIL++))
    fi
}

# Seguridad básica
check "Sin URL real en admin example" \
    "! grep -q 'yehvotdnhcwxjjpcznrf' admin/.env.local.example"

check "podclaw/memory en .gitignore" \
    "grep -q 'podclaw/memory' .gitignore"

check "Redis password configurado" \
    "grep -q 'REDIS_PASSWORD' frontend/.env.local"

check "Bridge token configurado (>32 chars)" \
    "[ \$(grep 'PODCLAW_BRIDGE_AUTH_TOKEN=' frontend/.env.local | cut -d= -f2 | wc -c) -gt 32 ]"

check "NODE_ENV=production en compose" \
    "grep -q 'NODE_ENV: production' deploy/docker-compose.yml"

check "Puertos internos no expuestos en prod" \
    "! grep -q '\"3000:3000\"' deploy/docker-compose.yml"

check "DOMAIN var en prod compose" \
    "grep -q 'DOMAIN' deploy/docker-compose.prod.yml"

check "Caddy HTTPS configurado" \
    "grep -q '443' deploy/docker-compose.prod.yml"

check "Bridge auth enabled en prod" \
    "grep -q 'PODCLAW_BRIDGE_AUTH_ENABLED.*true' deploy/docker-compose.prod.yml"

check "UFW activo" \
    "sudo ufw status | grep -q 'Status: active'"

check "Puerto 3000 cerrado externamente" \
    "! sudo ufw status | grep -q '3000'"

check "Puerto 8000 cerrado externamente" \
    "! sudo ufw status | grep -q '8000'"

echo ""
echo "=== Resultado: $PASS ✅ · $FAIL ❌ ==="
if [ $FAIL -gt 0 ]; then
    echo "⚠️  Resolver los $FAIL fallos antes de continuar"
    exit 1
fi
echo "🚀 Listo para deploy"
```

---

*Auditoría generada el 21 de Febrero de 2026. Válida para el estado del código auditado en esta fecha. Re-auditar tras implementar las correcciones críticas.*
