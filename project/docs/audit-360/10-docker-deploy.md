# 10 — Docker & Deployment: Auditoria Completa

> Fecha: 2026-02-23 | Auditor: Claude Opus 4.6 | Rama: master

---

## 1. Estado Actual

### 1.1 Estructura de archivos

```
project/
├── docker-compose.yml            # Base — 8 servicios, sin puertos expuestos
├── docker-compose.local.yml      # Override local (127.0.0.1, auth deshabilitado)
├── docker-compose.prod.yml       # Override produccion (80/443, DOMAIN requerido)
├── .env.example                  # Template con 30+ variables
├── .env                          # Secretos reales (gitignored)
├── start.sh                      # Script de orquestacion
├── frontend/Dockerfile           # Next.js 16, 3 stages, standalone
├── admin/Dockerfile              # Next.js 16, 3 stages, standalone, basePath=/panel
├── deploy/Dockerfile             # PodClaw, python:3.12-slim, single stage
├── deploy/rembg/Dockerfile       # rembg + FastAPI, u2net pre-descargado
├── deploy/Caddyfile              # Reverse proxy, TLS, security headers
└── mcp-server/Dockerfile         # (referenciado, no auditado en detalle)
```

### 1.2 Servicios

| Servicio | Imagen | Puerto | CPU | RAM (limite) | RAM (reserva) | Redes |
|----------|--------|--------|-----|-------------|---------------|-------|
| frontend | node:22-alpine (standalone) | 3000 | 1.0 | 384M | 256M | proxy, data |
| admin | node:22-alpine (standalone) | 3001 | 0.5 | 256M | 128M | proxy |
| podclaw | python:3.12-slim | 8000 | 1.0 | 512M | 256M | proxy, data, ai-services |
| mcp-server | custom Node.js | 8002 | 0.5 | 256M | 128M | proxy, data |
| rembg | python:3.12-slim + u2net | 8080 | 2.0 | 768M | 512M | ai-services |
| redis | redis:7-alpine | 6379 | 0.5 | 256M | 128M | data |
| crawl4ai | unclecode/crawl4ai:0.8.0 | 11235 | 1.0 | 768M | 384M | ai-services |
| caddy | caddy:2.9-alpine | 80/443 | 0.5 | 64M | 32M | proxy |

**Total reservas**: ~1.8 GB RAM, 6.5 CPUs
**Total limites**: ~3.2 GB RAM

### 1.3 Redes

```
proxy:       caddy <-> frontend, admin, podclaw, mcp-server
data:        frontend, podclaw, mcp-server <-> redis
ai-services: podclaw <-> rembg, crawl4ai
```

### 1.4 Volumenes nombrados

| Volumen | Uso | Persistencia critica |
|---------|-----|---------------------|
| `podclaw-data` | SQLite brain state | Alta |
| `podclaw-memory` | Memory logs, contexto | Alta |
| `redis-data` | AOF persistence | Media |
| `crawl4ai-output` | Cache de scraping | Baja |
| `caddy-data` | Certificados TLS | Alta |
| `caddy-config` | Config runtime | Baja |

---

## 2. Evaluacion Servicio por Servicio

### 2.1 Frontend (`frontend/Dockerfile`)

**Fortalezas:**
- Multi-stage correcto: `deps` -> `builder` -> `runner`
- Output standalone (`node server.js`, sin node_modules completo)
- Usuario no-root: `nextjs:nodejs` (UID 1001)
- `NEXT_TELEMETRY_DISABLED=1` en build y runtime
- HEALTHCHECK definido en Dockerfile y docker-compose
- `PUPPETEER_SKIP_DOWNLOAD=true` evita descarga de Chrome innecesaria
- Build args para `NEXT_PUBLIC_*` (baked en bundle JS)

**Debilidades:**
- `SUPABASE_SERVICE_KEY` pasado como build arg — queda en cache de layers
- Imagen base `node:22-alpine` incluye `npm`/`npx` innecesarios en runner
- No tiene `.dockerignore` verificado (podria copiar `node_modules` local)
- canvas requiere `python3 make g++` en deps stage — OK pero aumenta build time

**Puntuacion**: 8/10

### 2.2 Admin (`admin/Dockerfile`)

**Fortalezas:**
- Misma estructura multi-stage que frontend
- `additional_contexts` para compartir traducciones de frontend (patron creativo)
- basePath `/panel` configurado via ARG -> ENV
- HEALTHCHECK apunta a `/panel/api/health` (correcto con basePath)
- Usuario no-root

**Debilidades:**
- `SUPABASE_SERVICE_KEY` como build arg (mismo problema que frontend)
- No tiene `cap_drop: ALL` propio — hereda del anchor `*default-security`

**Puntuacion**: 8/10

### 2.3 PodClaw (`deploy/Dockerfile`)

**Fortalezas:**
- `python:3.12-slim` — imagen ligera
- Usuario no-root `podclaw:podclaw` (UID 1001)
- Directorios persistentes creados: `data/`, `memory/`
- HEALTHCHECK en endpoint `/health`
- `curl` instalado para healthcheck

**Debilidades:**
- **Single-stage** — no hay separacion builder/runner; `pip` y headers quedan en imagen
- **No hay `--no-cache-dir`** — wait, si lo tiene (`pip install --no-cache-dir`)
- Claude Agent SDK auth: usa `claude auth login` (tokens locales) — en Docker requiere montar token o volume para `~/.claude/`
- Falta verificar si `podclaw/requirements.txt` fija versiones exactas
- `apt-get update` sin `apt-get clean` explicitamente (pero `rm -rf /var/lib/apt/lists/*` si esta)

**Puntuacion**: 7/10

### 2.4 rembg (`deploy/rembg/Dockerfile`)

**Fortalezas:**
- Modelo u2net pre-descargado en build time (cold start rapido)
- Usuario no-root con home writable para cache numba
- Zero secrets — aislado en red `ai-services`
- HEALTHCHECK configurado

**Debilidades:**
- Sin multi-stage — `pip` y build tools quedan en imagen
- `libgl1 libglib2.0-0` necesarios pero aumentan superficie de ataque
- 768M de RAM puede ser insuficiente para imagenes grandes con u2net

**Puntuacion**: 7/10

### 2.5 Redis

**Fortalezas:**
- Imagen oficial `redis:7-alpine`
- Password requerido via `--requirepass`
- AOF persistence habilitado (`--appendonly yes`)
- `maxmemory 256mb` con politica `allkeys-lru`
- Comandos peligrosos deshabilitados: `FLUSHALL`, `FLUSHDB`, `DEBUG`, `CONFIG`
- `cap_drop: ALL` + solo `SETGID/SETUID/DAC_OVERRIDE`
- Healthcheck con `redis-cli -a` ping

**Debilidades:**
- Password visible en `command:` del docker-compose (interpolado, pero aparece en `docker inspect`)
- Sin TLS entre servicios (aceptable en red interna Docker)
- Sin `rename-command EVAL ""` (Lua scripting sigue habilitado)

**Puntuacion**: 9/10

### 2.6 Crawl4AI

**Fortalezas:**
- Imagen oficial versionada (`0.8.0`)
- `shm_size: 512m` para Chrome headless
- `cap_add: SYS_ADMIN` solo el minimo para Chrome sandbox
- Aislado en `ai-services` (no tiene acceso a redis ni proxy)
- Zero secrets (`CRAWL4AI_API_TOKEN: ""`)

**Debilidades:**
- `SYS_ADMIN` es un capability muy amplio
- `MAX_CONCURRENT_TASKS: "1"` — cuello de botella para scraping paralelo
- Sin rate limiting configurado para peticiones salientes

**Puntuacion**: 7/10

### 2.7 Caddy

**Fortalezas:**
- Imagen oficial `caddy:2.9-alpine`
- `cap_drop: ALL` + solo `NET_BIND_SERVICE`
- Volumenes para certificados TLS persistentes
- 64M de RAM — muy ligero
- Depende de todos los upstream con `condition: service_healthy`

**Debilidades:**
- Healthcheck usa `wget --spider http://localhost:80/` — en produccion debe verificar HTTPS
- Sin plugin caddy-cloudflare (comentado en Caddyfile, no instalado)
- 64M puede ser justo si hay muchas conexiones concurrentes

**Puntuacion**: 8/10

---

## 3. Evaluacion de Caddyfile

**Archivo**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/Caddyfile`

### Rutas

| Patron | Upstream | Notas |
|--------|----------|-------|
| `/api/bridge/*` | `podclaw:8000` | `uri strip_prefix` — auth via token |
| `/panel*` | `admin:3001` | basePath — sin strip |
| `/mcp*` | `mcp-server:8002` | Model Context Protocol |
| `/.well-known/oauth-*` | `mcp-server:8002` | OAuth 2.1 discovery |
| `/oauth/*` | `mcp-server:8002` | OAuth endpoints |
| `/*` (default) | `frontend:3000` | Catch-all |

### Security Headers

- `Strict-Transport-Security: max-age=31536000; includeSubDomains` -- OK
- `X-Content-Type-Options: nosniff` -- OK
- `X-Frame-Options: DENY` -- OK
- `X-XSS-Protection: 1; mode=block` -- OK (deprecado pero no dana)
- `Referrer-Policy: strict-origin-when-cross-origin` -- OK
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` -- OK
- `-Server` (oculta header Server) -- OK

### Gaps en Caddy

1. **Sin rate limiting** — Caddy soporta `rate_limit` con plugin, no esta configurado
2. **Sin CORS** — CORS se maneja en los backends, no en Caddy (aceptable)
3. **Sin CSP header** — Content-Security-Policy no definido
4. **Sin `trusted_proxies`** — necesario si se pone detras de Cloudflare
5. **Sin WAF** — sin proteccion contra SQL injection, XSS en requests
6. **Compresion `zstd gzip`** -- OK, orden correcto (zstd primero)

---

## 4. Evaluacion de start.sh

**Archivo**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/start.sh`

### Fortalezas

- `set -euo pipefail` — falla ante cualquier error
- Colores condicionales (detecta si es terminal)
- Creacion automatica de `.env` desde template
- Validacion de variables requeridas (11 variables)
- Deteccion de placeholders (`*placeholder*`, `*your-*`, `*change-me*`)
- Fases de arranque: infra -> app -> proxy
- Healthcheck con polling (hasta 60s) entre fases
- Modos: `--local`, `--prod`, `--down`, `--build`, `--clean`, `--status`
- Requiere `DOMAIN` en modo prod

### Debilidades

1. **Sin graceful shutdown** — `do_down()` hace `$COMPOSE_CMD down` sin `--timeout`
2. **Python3 como dependencia** — el health polling usa `python3 -c` para parsear JSON
3. **Sin backup pre-actualización** — no hace backup de volumes antes de rebuild
4. **Sin version pinning** — no verifica version minima de Docker/Compose
5. **Sin lock file** — puede ejecutarse multiples veces en paralelo
6. **`validate_env` exporta variables** — contamina el shell actual
7. **Sin rollback** — si fase 2 falla, fase 1 sigue corriendo sin la app

---

## 5. Arquitectura de Red

```
                    ┌─────────────────────────────────────────┐
                    │              INTERNET                     │
                    └──────────────┬───────────────────────────┘
                                   │ 80/443 (prod) | 8080 (local)
                    ┌──────────────▼───────────────┐
                    │         caddy (proxy)          │
                    └─┬─────────┬──────────┬───────┘
                      │         │          │
              ┌───────▼──┐  ┌──▼──────┐  ┌▼────────────┐
              │ frontend  │  │  admin  │  │   podclaw    │
              │  :3000    │  │  :3001  │  │   :8000      │
              └─────┬─────┘  └─────────┘  └─┬────────┬──┘
                    │                        │        │
              ┌─────▼─────────────┐    ┌─────▼──┐  ┌─▼─────────┐
              │     redis :6379    │    │ rembg  │  │  crawl4ai  │
              │     (data net)     │    │ :8080  │  │  :11235    │
              └───────────────────┘    └────────┘  └────────────┘
                    ▲                   ai-services network
                    │
              ┌─────┴───────┐
              │  mcp-server  │
              │   :8002      │
              └──────────────┘
```

### Aislamiento

- **rembg y crawl4ai** solo accesibles por podclaw (red `ai-services`)
- **redis** solo accesible por frontend, podclaw, mcp-server (red `data`)
- **admin** solo en red `proxy` — no necesita acceso a redis ni ai-services
- **caddy** solo en red `proxy` — no puede acceder a redis ni ai-services

### Gap de red

- `ai-services` tiene acceso a internet (crawl4ai necesita crawlear, rembg no) — podria restringirse rembg con `internal: true` en la red

---

## 6. Production Readiness Checklist

| Criterio | Estado | Notas |
|----------|--------|-------|
| Secretos sin hardcodear | OK | Todos via `${VAR}`, sin defaults secretos |
| `.env` gitignored | OK | `.env`, `.env.local` en `.gitignore` |
| Sin `env_file:` | OK | Cada servicio declara solo sus variables |
| TLS automatico | OK | Caddy auto-HTTPS via Let's Encrypt |
| Health checks | OK | Todos los 8 servicios con healthcheck |
| Restart policy | OK | `unless-stopped` en todos |
| Resource limits | OK | CPU + memoria en todos los servicios |
| Log rotation | OK | json-file, 10MB x 3 archivos |
| Non-root users | OK | Todos los Dockerfiles custom |
| cap_drop: ALL | OK | Todos los servicios |
| Volumenes persistentes | OK | redis-data, caddy-data, podclaw-data/memory |
| Backup de Redis | PARCIAL | AOF habilitado, pero sin backup externo |
| Backup de PodClaw | FALTA | Volumes sin estrategia de backup |
| Monitoring | FALTA | Sin Prometheus/Grafana, solo healthchecks |
| Alertas | FALTA | Sin integracion con alertas (PagerDuty, etc.) |
| Zero-downtime deploy | FALTA | Sin rolling update strategy |
| Log aggregation | FALTA | Logs en archivos locales, sin ELK/Loki |
| Secrets rotation | FALTA | Sin mecanismo de rotacion |
| Vulnerability scanning | FALTA | Sin Trivy/Snyk en CI |

**Puntuacion global: 7.5/10** — Solida para single-tenant, necesita mejoras para produccion multi-tenant.

---

## 7. Multi-tenant Readiness

### Estado actual: NO preparado

El stack actual es **single-tenant by design**:

1. **Base de datos**: Supabase Cloud unica, sin schemas por tenant
2. **Redis**: Instancia unica, sin namespacing por tenant
3. **PodClaw**: Agentes configurados para una tienda
4. **Frontend**: Una instancia, un dominio
5. **Admin**: Sin concepto de tenant/organizacion

### Propuesta para multi-tenancy

**Opcion A: Instancia por tenant (recomendada para < 50 tenants)**
- Fork del stack completo por cliente
- Aislamiento total de datos y recursos
- Facil de implementar, costoso de escalar

**Opcion B: Shared stack + tenant isolation (para 50-1000+ tenants)**
- PostgreSQL schemas por tenant (requiere reescribir queries)
- Redis key prefix por tenant
- PodClaw scheduler multi-tenant
- Frontend con tenant detection por dominio/subdomain
- Caddy wildcard certificate

---

## 8. Gaps Detectados

### Criticos (bloquean produccion)

1. **Claude SDK auth en Docker**: PodClaw usa `claude auth login` (tokens locales). En produccion Docker, necesita un volume mount para `~/.claude/` o variable de entorno con el token OAuth.
2. **Sin backup automatizado**: Volumes `podclaw-data`, `podclaw-memory`, `redis-data` sin backup programado.
3. **SUPABASE_SERVICE_KEY como build arg**: Queda en cache de layers de Docker. Deberia ser solo runtime env.

### Importantes (afectan operaciones)

4. **Sin monitoring**: No hay Prometheus, Grafana, ni health dashboard.
5. **Sin rate limiting en Caddy**: El Bridge API y webhooks estan desprotegidos contra DDoS.
6. **Sin CSP header**: Content-Security-Policy no configurado.
7. **Sin rollback strategy**: Si un deploy falla, no hay forma automatica de volver atras.
8. **start.sh requiere python3**: Deberia usar `jq` o parsing bash puro.

### Menores (mejoras de calidad)

9. **rembg sin multi-stage**: Imagen mas grande de lo necesario.
10. **crawl4ai SYS_ADMIN**: Capability amplio pero necesario para Chrome.
11. **Redis password en `docker inspect`**: Visible via interpolacion de compose.
12. **Sin `.dockerignore`** verificado en frontend/admin.

---

## 9. Quick Wins (implementables en 1-2 horas cada uno)

1. **Crear `.dockerignore`** en `frontend/`, `admin/`, `deploy/` — excluir `node_modules`, `.next`, `.git`, `*.md`
2. **Mover SUPABASE_SERVICE_KEY** de build args a runtime-only en Dockerfiles (usar placeholder en build, real en runtime)
3. **Agregar `--timeout 30`** a `do_down()` en `start.sh`
4. **Agregar Content-Security-Policy** en Caddyfile
5. **Agregar rate_limit** en Caddy para `/api/bridge/*` y webhooks
6. **Crear script de backup** para volumes (`docker cp` + `tar.gz` a S3/local)
7. **Pin Docker Compose version** en start.sh (`docker compose version --short | cut -d. -f1,2`)

---

## 10. Roadmap por Fases

### Fase 1: Hardening Inmediato (1-2 dias)

- [ ] `.dockerignore` en todos los proyectos
- [ ] SUPABASE_SERVICE_KEY solo como runtime env
- [ ] CSP header en Caddyfile
- [ ] Rate limiting en Caddy (bridge, webhooks)
- [ ] Script de backup para volumes
- [ ] Verificar Claude SDK auth en Docker container

### Fase 2: Observabilidad (1 semana)

- [ ] Prometheus + node_exporter para metricas de host
- [ ] Grafana con dashboards: CPU, RAM, disk, requests
- [ ] Loki para agregacion de logs (reemplaza json-file)
- [ ] Alertas basicas: servicio caido, disco > 80%, RAM > 90%
- [ ] `/metrics` endpoint en frontend, podclaw, mcp-server

### Fase 3: CI/CD (1-2 semanas)

- [ ] GitHub Actions: build, test, push images a registry
- [ ] Trivy scan en CI para vulnerabilidades de imagen
- [ ] Deploy automatizado via SSH + docker compose pull
- [ ] Rollback automatico si healthcheck falla post-deploy
- [ ] Staging environment (replica de prod)

### Fase 4: Alta Disponibilidad (2-4 semanas)

- [ ] Redis Sentinel o Redis Cluster (failover)
- [ ] Frontend replicas con `deploy.replicas: 2`
- [ ] Caddy con `lb_policy round_robin` para frontends
- [ ] PodClaw: separar bridge API (stateless, escalable) de agents (singleton)
- [ ] Backup automatizado a S3 con retención de 30 dias
- [ ] Watchtower o similar para auto-update de imagenes

---

## 11. Scaling Strategy para 1.000+ Tenants

### Tier 1: Single VPS (1-10 tenants)

- Stack actual tal como esta
- 4-8 GB RAM, 2-4 vCPU
- Un `.env` y un dominio por tenant
- Estimado: $20-40/mes por tenant

### Tier 2: Docker Swarm (10-100 tenants)

- 3-5 nodos con Docker Swarm
- Redis Cluster compartido
- Caddy con wildcard cert (`*.podai.io`)
- Tenant detection por subdomain
- PodClaw scheduler compartido con cola por tenant
- Supabase schemas por tenant
- Estimado: $5-15/mes por tenant

### Tier 3: Kubernetes (100-1.000+ tenants)

- K8s con Helm charts
- Horizontal Pod Autoscaler para frontend/admin
- Redis operator (Redis Sentinel)
- Caddy reemplazado por Ingress NGINX + cert-manager
- PodClaw como CronJob/Deployment con queue (BullMQ/Celery)
- Supabase reemplazado por PostgreSQL operator (Crunchy/Zalando)
- Prometheus + Grafana + Loki (Observability stack)
- Estimado: $2-8/mes por tenant

### Tabla de capacidad

| Metrica | Tier 1 | Tier 2 | Tier 3 |
|---------|--------|--------|--------|
| Tenants | 1-10 | 10-100 | 100-1000+ |
| Req/sec | ~100 | ~1000 | ~10000+ |
| RAM total | 4-8 GB | 16-64 GB | 64+ GB |
| Deploy time | 2-5 min | 5-10 min | 1-3 min (rolling) |
| Downtime | Brief | ~0 (rolling) | 0 (rolling) |
| Costo/tenant | $20-40 | $5-15 | $2-8 |

---

## Archivos Clave Auditados

| Archivo | Ruta absoluta |
|---------|---------------|
| Docker Compose base | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/docker-compose.yml` |
| Override local | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/docker-compose.local.yml` |
| Override prod | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/docker-compose.prod.yml` |
| Env template | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/.env.example` |
| start.sh | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/start.sh` |
| Caddyfile | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/Caddyfile` |
| Frontend Dockerfile | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/Dockerfile` |
| Admin Dockerfile | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/admin/Dockerfile` |
| PodClaw Dockerfile | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/Dockerfile` |
| rembg Dockerfile | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/rembg/Dockerfile` |
