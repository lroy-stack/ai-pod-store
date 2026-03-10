# Supabase Self-Hosted: Infrastructure Integration Plan

**Fecha**: 2026-03-09
**Estado**: Investigacion completada, pendiente implementacion
**Objetivo**: Integrar Supabase self-hosted en el stack Docker existente del proyecto POD AI

---

## 1. Arquitectura Actualizada

### 1.1 Diagrama de Arquitectura (antes vs despues)

**ANTES (actual) -- Supabase Cloud:**

```
                        Internet
                           |
                    [ Cloudflare ]
                           |
                      [ Caddy :80/:443 ]
                           |
            +--------------+---------------+------------------+
            |              |               |                  |
     [ frontend ]    [ admin ]       [ podclaw ]        [ mcp-server ]
        :3000         :3001            :8000               :8002
            |              |               |                  |
            +--------------+---+-----------+------------------+
                               |
                         [ Redis :6379 ]
                               |
            +---------+--------+--------+---------+
            |         |                 |         |
     [ rembg ]  [ crawl4ai ]    [ svg-renderer ]  |
       :8080     :11235            :3002           |
                                                   |
                           === INTERNET ===        |
                                                   |
                        [ Supabase Cloud ]  <------+
                     (PostgreSQL + Auth + Storage + Realtime)
```

**DESPUES (propuesto) -- Supabase Self-Hosted:**

```
                        Internet
                           |
                    [ Cloudflare ]
                           |
                      [ Caddy :80/:443 ]   <--- TLS termination
                           |
     +--------+--------+--+--+--------+--------+--------+
     |        |        |     |        |        |        |
  [front]  [admin]  [pod]  [mcp]  [kong]   [studio]  [storage]
   :3000    :3001   :8000  :8002  :8000sb   :3000sb    :5000
     |        |        |     |        |        |        |
     +--------+--------+--+--+--------+--------+--------+
                           |
            +--------------+--------------+
            |              |              |
      [ Redis :6379 ]  [ supabase-db ]  [ supavisor ]
                         :5432(int)     :6543(pool)
                           |
            +---------+----+----+---------+
            |         |         |         |
        [ auth ]  [ rest ]  [ realtime ] [ meta ]
         :9999     :3000r    :4000        :8080m
            |         |         |         |
     +------+---------+---------+---------+------+
     |              |              |              |
  [analytics]   [imgproxy]    [functions]    [vector]
    :4000         :8080i        :9000         :9001

     === AI Services (isolated) ===
     [ rembg :8080 ]  [ crawl4ai :11235 ]  [ svg-renderer :3002 ]
```

### 1.2 Redes (Networks)

```
REDES ACTUALES (mantener):
  proxy:        Caddy <-> frontend, admin, podclaw, mcp-server
  data:         frontend, podclaw, mcp-server <-> Redis
  ai-services:  podclaw <-> rembg, crawl4ai, svg-renderer
  monitoring:   prometheus, grafana, loki, promtail

REDES NUEVAS (anadir):
  supabase:     Todos los servicios Supabase internos (DB, auth, rest, realtime, storage, etc.)
  supabase-gw:  Kong <-> Caddy (gateway expuesto al proxy)

CONEXIONES CROSS-NETWORK:
  Kong:         supabase + supabase-gw (recibe de Caddy, despacha a servicios)
  Caddy:        proxy + supabase-gw (enruta al Kong de Supabase)
  frontend:     proxy + data (mantiene conexion a Redis)
  supabase-db:  supabase + data (Redis wrappers opcionales)
```

---

## 2. Docker Compose Integration

### 2.1 Estrategia: Compose File Separado

**Decision**: Usar `docker-compose.supabase.yml` como override file separado.

**Justificacion**:
- No contamina el docker-compose.yml principal (550 lineas ya)
- Se puede activar/desactivar facilmente
- `start.sh` controla el merge: `docker compose -f docker-compose.yml -f docker-compose.supabase.yml ...`
- El archivo Supabase se puede actualizar independientemente cuando Supabase saca nuevas versiones

**Invocacion**:
```bash
# Con Supabase self-hosted:
docker compose -f docker-compose.yml -f docker-compose.supabase.yml -f docker-compose.prod.yml up -d

# Sin Supabase (cloud):
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 2.2 docker-compose.supabase.yml (Completo)

```yaml
# POD AI — Supabase Self-Hosted Overlay
# ======================================
#
# Usage:
#   docker compose -f docker-compose.yml -f docker-compose.supabase.yml up -d
#   ./start.sh --prod --supabase
#
# This adds ~10 services for a complete self-hosted Supabase stack.
# Kong acts as internal API gateway; Caddy routes to Kong.
#
# IMPORTANT: Update .env with Supabase-specific variables before starting.
# See .env.example section "[SELF-HOSTED SUPABASE]"

x-supabase-logging: &supabase-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"

x-supabase-security: &supabase-security
  cap_drop:
    - ALL
  security_opt:
    - no-new-privileges:true

services:
  ***REMOVED***=============
  # Supabase PostgreSQL — Core Database
  ***REMOVED***=============
  supabase-db:
    image: supabase/postgres:15.8.1.085
    <<: *supabase-security
    cap_add:
      - CHOWN
      - DAC_OVERRIDE
      - SETGID
      - SETUID
      - FOWNER
    expose:
      - "5432"
    environment:
      POSTGRES_HOST: /var/run/postgresql
      PGPORT: "5432"
      POSTGRES_PORT: "5432"
      PGPASSWORD: ${SB_POSTGRES_PASSWORD:?SB_POSTGRES_PASSWORD is required}
      POSTGRES_PASSWORD: ${SB_POSTGRES_PASSWORD}
      PGDATABASE: ${SB_POSTGRES_DB:-postgres}
      POSTGRES_DB: ${SB_POSTGRES_DB:-postgres}
      JWT_SECRET: ${SB_JWT_SECRET:?SB_JWT_SECRET is required}
      JWT_EXP: ${SB_JWT_EXPIRY:-3600}
    volumes:
      - supabase-db-data:/var/lib/postgresql/data
      - supabase-db-config:/etc/postgresql-custom
      # Mount Supabase init scripts (from supabase/docker repo)
      - ./deploy/supabase/volumes/db/realtime.sql:/docker-entrypoint-initdb.d/migrations/99-realtime.sql:ro
      - ./deploy/supabase/volumes/db/webhooks.sql:/docker-entrypoint-initdb.d/migrations/99-webhooks.sql:ro
      - ./deploy/supabase/volumes/db/roles.sql:/docker-entrypoint-initdb.d/migrations/99-roles.sql:ro
      - ./deploy/supabase/volumes/db/jwt.sql:/docker-entrypoint-initdb.d/migrations/99-jwt.sql:ro
      - ./deploy/supabase/volumes/db/logs.sql:/docker-entrypoint-initdb.d/migrations/99-logs.sql:ro
      - ./deploy/supabase/volumes/db/_supautils.sql:/docker-entrypoint-initdb.d/migrations/97-supautils.sql:ro
    shm_size: 256m
    command:
      - postgres
      - -c
      - config_file=/etc/postgresql/postgresql.conf
      - -c
      - log_min_messages=fatal
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: '2.0', memory: 1536M }
        reservations: { memory: 512M }
    networks: [supabase]
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      start_period: 30s
      retries: 5
    logging: *supabase-logging

  ***REMOVED***=============
  # Supabase Auth (GoTrue) — JWT-based authentication
  ***REMOVED***=============
  supabase-auth:
    image: supabase/gotrue:v2.186.0
    <<: *supabase-security
    expose:
      - "9999"
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: "9999"
      API_EXTERNAL_URL: ${SB_API_EXTERNAL_URL:?SB_API_EXTERNAL_URL is required}
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${SB_POSTGRES_PASSWORD}@supabase-db:5432/${SB_POSTGRES_DB:-postgres}
      GOTRUE_SITE_URL: ${SB_SITE_URL:?SB_SITE_URL is required}
      GOTRUE_URI_ALLOW_LIST: ${SB_ADDITIONAL_REDIRECT_URLS:-}
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_EXP: ${SB_JWT_EXPIRY:-3600}
      GOTRUE_JWT_SECRET: ${SB_JWT_SECRET}
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: "false"
      GOTRUE_MAILER_AUTOCONFIRM: ${SB_ENABLE_EMAIL_AUTOCONFIRM:-false}
      # SMTP (reuse Resend or configure separate)
      GOTRUE_SMTP_HOST: ${SB_SMTP_HOST:-}
      GOTRUE_SMTP_PORT: ${SB_SMTP_PORT:-587}
      GOTRUE_SMTP_USER: ${SB_SMTP_USER:-}
      GOTRUE_SMTP_PASS: ${SB_SMTP_PASS:-}
      GOTRUE_SMTP_ADMIN_EMAIL: ${SB_SMTP_ADMIN_EMAIL:-noreply@yourdomain.com}
      GOTRUE_SMTP_SENDER_NAME: ${SB_SMTP_SENDER_NAME:-SKAPARA}
      GOTRUE_MAILER_URLPATHS_INVITE: "/auth/v1/verify"
      GOTRUE_MAILER_URLPATHS_CONFIRMATION: "/auth/v1/verify"
      GOTRUE_MAILER_URLPATHS_RECOVERY: "/auth/v1/verify"
      GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: "/auth/v1/verify"
      # Phone (disabled by default)
      GOTRUE_EXTERNAL_PHONE_ENABLED: "false"
    depends_on:
      supabase-db: { condition: service_healthy }
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 128M }
        reservations: { memory: 32M }
    networks: [supabase]
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:9999/health"]
      interval: 15s
      timeout: 5s
      start_period: 15s
      retries: 3
    logging: *supabase-logging

  ***REMOVED***=============
  # Supabase REST (PostgREST) — Auto-generated REST API
  ***REMOVED***=============
  supabase-rest:
    image: postgrest/postgrest:v14.5
    <<: *supabase-security
    expose:
      - "3000"
    environment:
      PGRST_DB_URI: postgres://authenticator:${SB_POSTGRES_PASSWORD}@supabase-db:5432/${SB_POSTGRES_DB:-postgres}
      PGRST_DB_SCHEMAS: ${SB_PGRST_DB_SCHEMAS:-public,storage,graphql_public}
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${SB_JWT_SECRET}
      PGRST_DB_USE_LEGACY_GUCS: "false"
      PGRST_APP_SETTINGS_JWT_SECRET: ${SB_JWT_SECRET}
      PGRST_APP_SETTINGS_JWT_EXP: ${SB_JWT_EXPIRY:-3600}
    depends_on:
      supabase-db: { condition: service_healthy }
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 256M }
        reservations: { memory: 64M }
    networks: [supabase]
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:3000/"]
      interval: 15s
      timeout: 5s
      start_period: 10s
      retries: 3
    logging: *supabase-logging

  ***REMOVED***=============
  # Supabase Realtime — WebSocket broadcasts for DB changes
  ***REMOVED***=============
  supabase-realtime:
    image: supabase/realtime:v2.76.5
    <<: *supabase-security
    expose:
      - "4000"
    environment:
      PORT: "4000"
      DB_HOST: supabase-db
      DB_PORT: "5432"
      DB_USER: supabase_admin
      DB_PASSWORD: ${SB_POSTGRES_PASSWORD}
      DB_NAME: ${SB_POSTGRES_DB:-postgres}
      DB_AFTER_CONNECT_QUERY: "SET search_path TO _realtime"
      DB_ENC_KEY: ${SB_VAULT_ENC_KEY:?SB_VAULT_ENC_KEY is required}
      API_JWT_SECRET: ${SB_JWT_SECRET}
      SECRET_KEY_BASE: ${SB_SECRET_KEY_BASE:?SB_SECRET_KEY_BASE is required}
      ERL_AFLAGS: "-proto_dist inet_tcp"
      DNS_NODES: "''"
      RLIMIT_NOFILE: "10000"
      APP_NAME: realtime
      SEED_SELF_HOST: "true"
      RUN_JANITOR: "true"
    depends_on:
      supabase-db: { condition: service_healthy }
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: '1.0', memory: 512M }
        reservations: { memory: 128M }
    networks: [supabase]
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:4000/api/tenants/realtime-dev/health"]
      interval: 15s
      timeout: 5s
      start_period: 30s
      retries: 5
    logging: *supabase-logging

  ***REMOVED***=============
  # Supabase Storage — File storage with S3 protocol
  ***REMOVED***=============
  supabase-storage:
    image: supabase/storage-api:v1.37.8
    <<: *supabase-security
    expose:
      - "5000"
    environment:
      ANON_KEY: ${SB_ANON_KEY:?SB_ANON_KEY is required}
      SERVICE_KEY: ${SB_SERVICE_ROLE_KEY:?SB_SERVICE_ROLE_KEY is required}
      POSTGREST_URL: http://supabase-rest:3000
      PGRST_JWT_SECRET: ${SB_JWT_SECRET}
      DATABASE_URL: postgres://supabase_storage_admin:${SB_POSTGRES_PASSWORD}@supabase-db:5432/${SB_POSTGRES_DB:-postgres}
      FILE_SIZE_LIMIT: "52428800"
      STORAGE_BACKEND: file
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      TENANT_ID: stub
      REGION: eu-central-1
      GLOBAL_S3_BUCKET: stub
      ENABLE_IMAGE_TRANSFORMATION: "true"
      IMGPROXY_URL: http://supabase-imgproxy:8080
      # S3 protocol credentials (for rclone, etc.)
      S3_PROTOCOL_ACCESS_KEY_ID: ${SB_S3_ACCESS_KEY_ID:-}
      S3_PROTOCOL_ACCESS_KEY_SECRET: ${SB_S3_ACCESS_KEY_SECRET:-}
    volumes:
      - supabase-storage-data:/var/lib/storage
    depends_on:
      supabase-db: { condition: service_healthy }
      supabase-rest: { condition: service_started }
      supabase-imgproxy: { condition: service_started }
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 256M }
        reservations: { memory: 64M }
    networks: [supabase]
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/status"]
      interval: 15s
      timeout: 5s
      start_period: 15s
      retries: 3
    logging: *supabase-logging

  ***REMOVED***=============
  # imgproxy — Image transformation for Supabase Storage
  ***REMOVED***=============
  supabase-imgproxy:
    image: darthsim/imgproxy:v3.30.1
    <<: *supabase-security
    expose:
      - "8080"
    environment:
      IMGPROXY_BIND: ":8080"
      IMGPROXY_LOCAL_FILESYSTEM_ROOT: /var/lib/storage
      IMGPROXY_USE_ETAG: "true"
      IMGPROXY_ENABLE_WEBP_DETECTION: "true"
      IMGPROXY_MAX_SRC_RESOLUTION: "20"
    volumes:
      - supabase-storage-data:/var/lib/storage:ro
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 256M }
        reservations: { memory: 64M }
    networks: [supabase]
    healthcheck:
      test: ["CMD", "imgproxy", "health"]
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3
    logging: *supabase-logging

  ***REMOVED***=============
  # Supabase Meta — Database admin API (used by Studio)
  ***REMOVED***=============
  supabase-meta:
    image: supabase/postgres-meta:v0.95.2
    <<: *supabase-security
    expose:
      - "8080"
    environment:
      PG_META_PORT: "8080"
      PG_META_DB_HOST: supabase-db
      PG_META_DB_PORT: "5432"
      PG_META_DB_NAME: ${SB_POSTGRES_DB:-postgres}
      PG_META_DB_USER: supabase_admin
      PG_META_DB_PASSWORD: ${SB_POSTGRES_PASSWORD}
      PG_META_CRYPTO_KEY: ${SB_PG_META_CRYPTO_KEY:?SB_PG_META_CRYPTO_KEY is required}
    depends_on:
      supabase-db: { condition: service_healthy }
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: '0.25', memory: 128M }
        reservations: { memory: 32M }
    networks: [supabase]
    logging: *supabase-logging

  ***REMOVED***=============
  # Kong — Supabase API Gateway (internal, NOT exposed to internet)
  ***REMOVED***=============
  supabase-kong:
    image: kong:2.8.1
    <<: *supabase-security
    cap_add:
      - SETGID
      - SETUID
    expose:
      - "8000"
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /home/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,SRV,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl,basic-auth,request-termination
      KONG_NGINX_PROXY_PROXY_BUFFER_SIZE: 160k
      KONG_NGINX_PROXY_PROXY_BUFFERS: 64 160k
      SUPABASE_ANON_KEY: ${SB_ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SB_SERVICE_ROLE_KEY}
      DASHBOARD_USERNAME: ${SB_DASHBOARD_USERNAME:-supabase}
      DASHBOARD_PASSWORD: ${SB_DASHBOARD_PASSWORD:?SB_DASHBOARD_PASSWORD is required}
    volumes:
      - ./deploy/supabase/volumes/api/kong.yml:/home/kong/temp.yml:ro
    command: >
      bash -c "cp /home/kong/temp.yml /home/kong/kong.yml &&
      sed -i 's/\$$SUPABASE_ANON_KEY/'\"$$SUPABASE_ANON_KEY\"'/' /home/kong/kong.yml &&
      sed -i 's/\$$SUPABASE_SERVICE_KEY/'\"$$SUPABASE_SERVICE_KEY\"'/' /home/kong/kong.yml &&
      sed -i 's/\$$DASHBOARD_USERNAME/'$$DASHBOARD_USERNAME'/' /home/kong/kong.yml &&
      sed -i 's/\$$DASHBOARD_PASSWORD/'$$DASHBOARD_PASSWORD'/' /home/kong/kong.yml &&
      /docker-entrypoint.sh kong docker-start"
    depends_on:
      supabase-auth: { condition: service_healthy }
      supabase-rest: { condition: service_healthy }
      supabase-realtime: { condition: service_healthy }
      supabase-storage: { condition: service_healthy }
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: '1.0', memory: 512M }
        reservations: { memory: 128M }
    networks: [supabase, supabase-gw]
    healthcheck:
      test: ["CMD", "kong", "health"]
      interval: 15s
      timeout: 5s
      start_period: 30s
      retries: 5
    logging: *supabase-logging

  ***REMOVED***=============
  # Supabase Studio — Dashboard UI (OPTIONAL, disable in minimal deploys)
  ***REMOVED***=============
  supabase-studio:
    image: supabase/studio:2026.02.16-sha-26c615c
    <<: *supabase-security
    expose:
      - "3000"
    environment:
      STUDIO_PG_META_URL: http://supabase-meta:8080
      POSTGRES_PASSWORD: ${SB_POSTGRES_PASSWORD}
      SUPABASE_URL: http://supabase-kong:8000
      SUPABASE_PUBLIC_URL: ${SB_API_EXTERNAL_URL}
      SUPABASE_ANON_KEY: ${SB_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SB_SERVICE_ROLE_KEY}
      AUTH_JWT_SECRET: ${SB_JWT_SECRET}
      LOGFLARE_PUBLIC_ACCESS_TOKEN: ${SB_LOGFLARE_PUBLIC_TOKEN:-dummy}
      LOGFLARE_PRIVATE_ACCESS_TOKEN: ${SB_LOGFLARE_PRIVATE_TOKEN:-dummy}
      DEFAULT_ORGANIZATION_NAME: "SKAPARA"
      DEFAULT_PROJECT_NAME: "POD AI Store"
    depends_on:
      supabase-kong: { condition: service_healthy }
      supabase-meta: { condition: service_started }
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 256M }
        reservations: { memory: 64M }
    networks: [supabase]
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/platform/profile',r=>{process.exit(r.statusCode===200?0:1)})"]
      interval: 30s
      timeout: 10s
      start_period: 30s
      retries: 3
    logging: *supabase-logging

  ***REMOVED***=============
  # Supavisor — Connection Pooler (replaces PgBouncer)
  ***REMOVED***=============
  supabase-pooler:
    image: supabase/supavisor:2.7.4
    <<: *supabase-security
    cap_add:
      - SETGID
      - SETUID
    expose:
      - "5432"
      - "6543"
    environment:
      PORT: "4000"
      POSTGRES_PORT: "5432"
      POSTGRES_DB: ${SB_POSTGRES_DB:-postgres}
      POSTGRES_PASSWORD: ${SB_POSTGRES_PASSWORD}
      DATABASE_URL: ecto://supabase_admin:${SB_POSTGRES_PASSWORD}@supabase-db:5432/${SB_POSTGRES_DB:-postgres}
      CLUSTER_POSTGRES: "true"
      SECRET_KEY_BASE: ${SB_SECRET_KEY_BASE}
      VAULT_ENC_KEY: ${SB_VAULT_ENC_KEY}
      API_JWT_SECRET: ${SB_JWT_SECRET}
      METRICS_JWT_SECRET: ${SB_JWT_SECRET}
      REGION: eu-central-1
      ERL_AFLAGS: "-proto_dist inet_tcp"
      POOLER_TENANT_ID: ${SB_POOLER_TENANT_ID:-podai-tenant}
      POOLER_DEFAULT_POOL_SIZE: ${SB_POOLER_POOL_SIZE:-20}
      POOLER_MAX_CLIENT_CONN: ${SB_POOLER_MAX_CONN:-100}
      POOLER_POOL_MODE: transaction
    depends_on:
      supabase-db: { condition: service_healthy }
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 256M }
        reservations: { memory: 64M }
    networks: [supabase, data]
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:4000/api/health"]
      interval: 15s
      timeout: 5s
      start_period: 30s
      retries: 5
    logging: *supabase-logging

  ***REMOVED***=============
  # Vector — Log pipeline (feeds into Logflare/Analytics)
  # OPTIONAL: Can be removed if analytics is disabled
  ***REMOVED***=============
  supabase-vector:
    image: timberio/vector:0.53.0-alpine
    <<: *supabase-security
    cap_add:
      - DAC_READ_SEARCH
    expose:
      - "9001"
    environment:
      LOGFLARE_PUBLIC_ACCESS_TOKEN: ${SB_LOGFLARE_PUBLIC_TOKEN:-dummy}
    volumes:
      - ./deploy/supabase/volumes/logs/vector.yml:/etc/vector/vector.yml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: '0.25', memory: 128M }
        reservations: { memory: 32M }
    networks: [supabase]
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:9001/health"]
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3
    logging: *supabase-logging

  ***REMOVED***=============
  # PG Backup Scheduler — Automated PostgreSQL backups
  ***REMOVED***=============
  supabase-backup:
    image: mxschmitt/pg-backup-scheduler:latest
    <<: *supabase-security
    cap_add:
      - DAC_READ_SEARCH
    environment:
      BACKUP_PODAI: postgresql://postgres:${SB_POSTGRES_PASSWORD}@supabase-db:5432/${SB_POSTGRES_DB:-postgres}
      BACKUP_CRON: ${SB_BACKUP_CRON:-"0 3 * * *"}
      RETENTION_DAYS: ${SB_BACKUP_RETENTION_DAYS:-30}
      TZ: ${TZ:-Europe/Berlin}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - supabase-backups:/data/backups
    depends_on:
      supabase-db: { condition: service_healthy }
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: '0.25', memory: 128M }
        reservations: { memory: 32M }
    networks: [supabase]
    logging: *supabase-logging

  ***REMOVED***=============
  # Override existing services to point to self-hosted Supabase
  ***REMOVED***=============
  frontend:
    environment:
      # Override cloud URLs to point to internal Kong
      SUPABASE_URL: http://supabase-kong:8000
      # NEXT_PUBLIC vars remain pointing to external URL (browser-side)
      # They are baked at build time, so set SB_API_EXTERNAL_URL correctly
    networks:
      - proxy
      - data
      - supabase-gw
    depends_on:
      redis: { condition: service_healthy }
      podclaw: { condition: service_healthy }
      supabase-kong: { condition: service_healthy }

  podclaw:
    environment:
      SUPABASE_URL: http://supabase-kong:8000
    networks:
      - proxy
      - data
      - ai-services
      - supabase-gw
    depends_on:
      redis: { condition: service_healthy }
      rembg: { condition: service_healthy }
      crawl4ai: { condition: service_healthy }
      svg-renderer: { condition: service_healthy }
      supabase-kong: { condition: service_healthy }

  admin:
    environment:
      SUPABASE_URL: http://supabase-kong:8000
    networks:
      - proxy
      - supabase-gw

  mcp-server:
    environment:
      SUPABASE_URL: http://supabase-kong:8000
    networks:
      - proxy
      - data
      - supabase-gw

  caddy:
    depends_on:
      frontend: { condition: service_healthy }
      admin: { condition: service_healthy }
      podclaw: { condition: service_healthy }
      mcp-server: { condition: service_healthy }
      supabase-kong: { condition: service_healthy }
    networks:
      - proxy
      - supabase-gw

***REMOVED***=============
# Volumes
***REMOVED***=============
volumes:
  supabase-db-data:        # PostgreSQL data directory
  supabase-db-config:      # PostgreSQL custom configuration
  supabase-storage-data:   # File storage (uploaded files)
  supabase-backups:        # Automated pg_dump backups

***REMOVED***=============
# Networks
***REMOVED***=============
networks:
  supabase:
    driver: bridge
    internal: true          # NO internet access — fully isolated
  supabase-gw:
    driver: bridge          # Kong <-> Caddy gateway
```

### 2.3 Servicios Opcionales (pueden eliminarse para ahorrar recursos)

| Servicio | RAM idle | Necesario? | Notas |
|---|---|---|---|
| `supabase-studio` | ~72 MB | NO | Dashboard admin. Acceder via `supabase-kong` basico auth. Puede deshabilitarse en prod |
| `supabase-vector` | ~40 MB | NO | Log shipping. Solo necesario si analytics esta activo |
| `supabase-imgproxy` | ~30 MB | DEPENDE | Solo si se usa image transformation en Storage |
| `supabase-pooler` | ~50 MB | RECOMENDADO | Connection pooling. Sin el, conexiones directas a DB |

**Config minima (ahorrar ~190 MB)**: Eliminar studio, vector, e imgproxy.

---

## 3. Caddy Reverse Proxy

### 3.1 Caddyfile Actualizado (diff)

El Caddyfile actual ya tiene rutas para frontend, admin, podclaw y mcp-server. Se deben anadir las rutas de Supabase **ANTES** del fallback `reverse_proxy frontend:3000`.

```caddyfile
# POD AI — Caddy Reverse Proxy Configuration (Updated for Self-Hosted Supabase)
***REMOVED***==================

{
	on_demand_tls {
		ask http://frontend:3000/api/verify-domain
		interval 2m
		burst 5
	}
}

{$CADDY_SITE_ADDRESS:http://localhost} {

	# ----- PodClaw Bridge API (existing) -----
	handle /api/bridge/* {
		uri strip_prefix /api/bridge
		reverse_proxy podclaw:8000
	}

	# ----- Admin Panel (existing) -----
	handle /panel* {
		reverse_proxy admin:3001
	}

	# ----- MCP Server (existing) -----
	handle /mcp* {
		reverse_proxy mcp-server:8002
	}
	handle /.well-known/oauth-authorization-server {
		reverse_proxy mcp-server:8002
	}
	handle /.well-known/oauth-protected-resource {
		reverse_proxy mcp-server:8002
	}
	handle /oauth/* {
		reverse_proxy mcp-server:8002
	}

	***REMOVED***=========
	# SUPABASE ROUTES — Proxy to Kong (internal API gateway)
	***REMOVED***=========

	# Auth endpoints (login, signup, verify, callback, OAuth)
	handle /auth/v1/* {
		reverse_proxy supabase-kong:8000
	}

	# REST API (PostgREST)
	handle /rest/v1/* {
		reverse_proxy supabase-kong:8000
	}

	# GraphQL API
	handle /graphql/v1* {
		reverse_proxy supabase-kong:8000
	}

	# Realtime (WebSocket — Caddy handles upgrade automatically)
	handle /realtime/v1/* {
		reverse_proxy supabase-kong:8000
	}

	# Storage (file uploads/downloads)
	# NOTE: Also proxied through Kong. For large uploads, you may want
	# to proxy directly to storage:5000 with appropriate headers.
	handle /storage/v1/* {
		reverse_proxy supabase-kong:8000
	}

	# Edge Functions (if enabled)
	handle /functions/v1/* {
		reverse_proxy supabase-kong:8000
	}

	# Supabase Studio Dashboard — PROTECTED with basic auth
	# Only accessible at /supabase-studio/ path
	# In production, consider IP whitelisting instead of or in addition to basic auth
	handle /supabase-studio* {
		basicauth {
			{$SB_DASHBOARD_USERNAME:supabase} {$SB_DASHBOARD_PASSWORD_HASH}
		}
		uri strip_prefix /supabase-studio
		reverse_proxy supabase-kong:8000
	}

	# Postgres Meta API — BLOCKED from external access
	handle /pg/* {
		respond "Forbidden" 403
	}

	***REMOVED***=========
	# FALLBACK — All other traffic to frontend
	***REMOVED***=========
	reverse_proxy frontend:3000

	# Security headers
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		X-XSS-Protection "1; mode=block"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
		# Updated CSP to allow self-hosted Supabase (connect-src 'self' covers it)
		Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.stripe.com; connect-src 'self' wss://{$CADDY_SITE_ADDRESS} https://api.stripe.com https://generativelanguage.googleapis.com; font-src 'self'; frame-src https://js.stripe.com https://hooks.stripe.com; object-src 'none'; base-uri 'self'"
		-Server
	}

	encode zstd gzip
}

# Custom tenant domains (existing — unchanged)
:443 {
	tls {
		on_demand
	}
	reverse_proxy frontend:3000 {
		header_up Host {host}
	}
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		X-XSS-Protection "1; mode=block"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
		Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.stripe.com; connect-src 'self' wss://{host} https://api.stripe.com https://generativelanguage.googleapis.com; font-src 'self'; frame-src https://js.stripe.com https://hooks.stripe.com; object-src 'none'; base-uri 'self'"
		-Server
	}
	encode zstd gzip
}
```

### 3.2 Notas Importantes sobre Caddy + Supabase

1. **WebSocket (Realtime)**: Caddy maneja upgrade a WebSocket automaticamente. No necesita configuracion extra como Nginx (`proxy_set_header Upgrade`, `Connection`).

2. **CSP actualizado**: Se eliminan las referencias a `*.supabase.co` del Content-Security-Policy ya que todo es `'self'` ahora. Se anade `wss://` para Realtime WebSocket.

3. **Studio protegido**: Se monta en `/supabase-studio/` con basic auth de Caddy. En produccion, considerar IP whitelist adicional:
   ```caddyfile
   handle /supabase-studio* {
       @allowed remote_ip 1.2.3.4/32
       handle @allowed {
           uri strip_prefix /supabase-studio
           reverse_proxy supabase-kong:8000
       }
       handle {
           respond "Forbidden" 403
       }
   }
   ```

4. **Kong vs directo**: Se mantiene Kong como API gateway interno. Las rutas de Caddy apuntan a `supabase-kong:8000`, NO directamente a los servicios individuales. Kong maneja autenticacion (apikey validation, ACL), CORS, y routing interno.

5. **/pg/ bloqueado**: La ruta de Postgres Meta se bloquea externamente. Solo accesible internamente desde Studio.

---

## 4. Redis Integration

### 4.1 Puede Supabase usar el Redis existente?

**Respuesta corta: No directamente.** GoTrue (Auth) no usa Redis nativamente. Supabase en general no tiene un requerimiento de Redis en su stack oficial.

**Sin embargo**, hay oportunidades de integracion:

| Componente | Redis actual (app) | Redis para Supabase | Accion |
|---|---|---|---|
| Frontend rate limiting | SI (ya usa) | No aplica | Mantener |
| GoTrue session cache | N/A | No soportado natively | GoTrue usa JWT stateless |
| PostgREST caching | N/A | No soportado | PostgREST no cachea |
| Realtime | N/A | No usa Redis | Usa PostgreSQL WAL |
| Application-level caching | SI (ya usa) | Opcional | Mantener Redis para app cache |

### 4.2 Recomendacion

- **Mantener el Redis existente** para la aplicacion (frontend, podclaw, mcp-server)
- **No compartir Redis con Supabase** -- no hay servicios Supabase que lo necesiten
- **Supavisor** reemplaza lo que PgBouncer/Redis harian para connection pooling
- Si en el futuro se necesita cache de queries PostgreSQL, considerar `pg_redis_pubsub` o wrappers

---

## 5. VPS Resource Planning

### 5.1 RAM Estimada por Servicio

| Servicio | RAM idle | RAM peak | Notas |
|---|---|---|---|
| **--- Stack actual ---** | | | |
| frontend | 256-384 MB | 384 MB | Next.js SSR |
| admin | 128-256 MB | 256 MB | Next.js admin |
| podclaw | 256-512 MB | 512 MB | Python + agents |
| mcp-server | 128-256 MB | 256 MB | Node.js |
| rembg | 512-768 MB | 768 MB | u2net model |
| redis | 128-256 MB | 256 MB | 256mb maxmemory |
| crawl4ai | 384-768 MB | 768 MB | Chromium |
| svg-renderer | 256-512 MB | 512 MB | resvg + sharp |
| caddy | 32-64 MB | 64 MB | Go binary |
| prometheus | 256-512 MB | 512 MB | TSDB |
| grafana | 128-256 MB | 256 MB | |
| loki | 256-512 MB | 512 MB | |
| **Subtotal actual** | **~2.8 GB** | **~4.9 GB** | |
| **--- Supabase ---** | | | |
| supabase-db (PostgreSQL) | 350-512 MB | 1.5 GB | shared_buffers config-dependent |
| supabase-kong | 128-256 MB | 512 MB | Nota: puede usar hasta 2.5GB sin limites |
| supabase-auth (GoTrue) | 9-32 MB | 128 MB | Muy ligero |
| supabase-rest (PostgREST) | 64-128 MB | 256 MB | Haskell binary |
| supabase-realtime | 128-256 MB | 512 MB | BEAM VM (Elixir) |
| supabase-storage | 40-64 MB | 256 MB | Node.js |
| supabase-imgproxy | 30-64 MB | 256 MB | Go binary |
| supabase-meta | 60-128 MB | 128 MB | Node.js |
| supabase-studio | 72-128 MB | 256 MB | Node.js (OPCIONAL) |
| supabase-pooler | 50-128 MB | 256 MB | Elixir (BEAM VM) |
| supabase-vector | 40-64 MB | 128 MB | Rust (OPCIONAL) |
| supabase-backup | 32-64 MB | 256 MB | Solo durante backup |
| **Subtotal Supabase** | **~1.1 GB** | **~4.3 GB** | |
| | | | |
| **TOTAL (todo)** | **~3.9 GB** | **~9.2 GB** | |
| **TOTAL (sin opcionales)** | **~3.4 GB** | **~7.5 GB** | Sin studio, vector, monitoring |

### 5.2 Disco

| Componente | Estimacion inicial | Crecimiento/mes | Notas |
|---|---|---|---|
| PostgreSQL data | 2-5 GB | 500 MB-2 GB | Depende de productos/usuarios |
| PostgreSQL backups | 5 GB (30 dias retention) | Proporcional a DB size | pg_dump comprimido |
| Storage (files) | 1-5 GB | 1-5 GB | Imagenes de productos |
| Docker images | 8-12 GB | Negligible | Supabase images (~6 GB) |
| Logs (Loki) | 2-5 GB | 500 MB-1 GB | 15 dias retention |
| Redis AOF | 256 MB | Negligible | Con LRU eviction |
| OS + system | 5-8 GB | Negligible | |
| **TOTAL** | **25-40 GB** | **3-9 GB/mes** | |

### 5.3 Recomendaciones de VPS

| Tier | Specs | Para que | Precio estimado/mes |
|---|---|---|---|
| **Minimo viable** | 4 vCPU, 8 GB RAM, 80 GB SSD | Dev/staging, trafico bajo (<100 users) | $24-40 |
| **Recomendado** | 4 vCPU, 16 GB RAM, 160 GB SSD | Produccion, trafico medio (<1000 users) | $48-80 |
| **Optimo** | 8 vCPU, 32 GB RAM, 320 GB SSD | Produccion, trafico alto, headroom | $96-160 |

**Proveedores VPS recomendados (EU datacenter):**
- Hetzner Cloud: CPX31 (4 vCPU, 8 GB, 160 GB) = EUR 15.90/mes -- mejor precio/rendimiento
- Hetzner Cloud: CPX41 (8 vCPU, 16 GB, 240 GB) = EUR 28.90/mes
- Contabo: VPS M (6 vCPU, 16 GB, 400 GB) = EUR 13.99/mes
- DigitalOcean: Droplet (4 vCPU, 8 GB) = $48/mes
- Vultr: Cloud Compute (4 vCPU, 16 GB) = $96/mes

**Nota**: Con Hetzner CPX31 a EUR 15.90/mes, el stack COMPLETO (app + Supabase + monitoring) es viable con 8 GB RAM si se eliminan servicios opcionales (studio, vector, monitoring stack).

### 5.4 CPU

Los servicios **no son CPU-intensive** en operacion normal. Picos de CPU ocurren:
- PostgreSQL: queries complejas, vacuum, indexing
- rembg: procesamiento de imagenes (temporal)
- crawl4ai: Chromium rendering (temporal)
- svg-renderer: conversion de SVG (temporal)

**4 vCPU es suficiente** para trafico normal. 8 vCPU da headroom para picos.

---

## 6. Backup Strategy

### 6.1 PostgreSQL Backups

**Herramienta**: `pg-backup-scheduler` (ya incluido en docker-compose.supabase.yml)

```
Schedule:    Diario a las 3:00 AM (configurable via SB_BACKUP_CRON)
Retention:   30 dias (configurable via SB_BACKUP_RETENTION_DAYS)
Output:      supabase-backups volume -> /data/backups/podai/YYYY-MM-DD/
Contents:    roles.sql + schema.sql + data.sql (tar.gz)
```

### 6.2 Storage Backups (archivos subidos)

Script cron en el host para sincronizar a almacenamiento externo:

```bash
#!/bin/bash
# /opt/podai/scripts/backup-storage.sh
# Ejecutar via crontab: 0 4 * * * /opt/podai/scripts/backup-storage.sh

set -euo pipefail

BACKUP_DIR="/opt/podai/backups/storage"
DATE=$(date +%Y-%m-%d)
STORAGE_VOLUME="podai_supabase-storage-data"

mkdir -p "$BACKUP_DIR"

# Opcion A: Copia directa del volumen Docker
docker run --rm \
  -v "$STORAGE_VOLUME":/source:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/storage-$DATE.tar.gz" -C /source .

# Opcion B: Sync a S3/B2 (si configurado)
# rclone sync "$BACKUP_DIR" remote:podai-backups/storage/ --transfers 4

# Cleanup: mantener ultimos 14 dias
find "$BACKUP_DIR" -name "storage-*.tar.gz" -mtime +14 -delete

echo "[$(date)] Storage backup completed: storage-$DATE.tar.gz"
```

### 6.3 Backup de Configuracion

```bash
#!/bin/bash
# /opt/podai/scripts/backup-config.sh
# Ejecutar via crontab: 0 5 * * 0 /opt/podai/scripts/backup-config.sh (semanal)

set -euo pipefail

BACKUP_DIR="/opt/podai/backups/config"
DATE=$(date +%Y-%m-%d)
PROJECT_DIR="/opt/podai/project"

mkdir -p "$BACKUP_DIR"

tar czf "$BACKUP_DIR/config-$DATE.tar.gz" \
  --exclude='*.env' \
  "$PROJECT_DIR/docker-compose.yml" \
  "$PROJECT_DIR/docker-compose.supabase.yml" \
  "$PROJECT_DIR/docker-compose.prod.yml" \
  "$PROJECT_DIR/deploy/Caddyfile" \
  "$PROJECT_DIR/deploy/supabase/" \
  "$PROJECT_DIR/start.sh"

# Backup de .env (ENCRIPTADO)
gpg --symmetric --cipher-algo AES256 \
  --output "$BACKUP_DIR/env-$DATE.gpg" \
  "$PROJECT_DIR/.env"

# Cleanup: mantener ultimos 8 semanas
find "$BACKUP_DIR" -name "config-*.tar.gz" -mtime +56 -delete
find "$BACKUP_DIR" -name "env-*.gpg" -mtime +56 -delete

echo "[$(date)] Config backup completed"
```

### 6.4 Crontab completo

```cron
# POD AI Backups
# DB: diario 3:00 AM (manejado por pg-backup-scheduler container)
# Storage: diario 4:00 AM
0 4 * * * /opt/podai/scripts/backup-storage.sh >> /var/log/podai-backup.log 2>&1
# Config: semanal domingos 5:00 AM
0 5 * * 0 /opt/podai/scripts/backup-config.sh >> /var/log/podai-backup.log 2>&1
```

### 6.5 Disaster Recovery Plan

| Escenario | RPO | RTO | Procedimiento |
|---|---|---|---|
| Corrupcion DB | 24h (ultimo backup) | 30-60 min | Restaurar pg_dump + replay WAL si disponible |
| Disco lleno | 0 (datos intactos) | 15 min | Expandir disco, cleanup, restart |
| VPS destruido | 24h | 2-4h | Nuevo VPS, deploy stack, restaurar backups |
| Container crash | 0 (volumen persistente) | 2-5 min | Docker auto-restart (unless-stopped) |

**Procedimiento de restore (DB)**:
```bash
# 1. Parar servicios que acceden a la DB
docker compose -p podai stop supabase-auth supabase-rest supabase-realtime supabase-storage

# 2. Restaurar backup
docker exec -i podai-supabase-db-1 psql -U postgres < /data/backups/podai/2026-03-09/roles.sql
docker exec -i podai-supabase-db-1 psql -U postgres < /data/backups/podai/2026-03-09/schema.sql
docker exec -i podai-supabase-db-1 psql -U postgres < /data/backups/podai/2026-03-09/data.sql

# 3. Reiniciar servicios
docker compose -p podai up -d
```

---

## 7. Monitoring

### 7.1 PostgreSQL Monitoring

El stack de monitoring existente (Prometheus + Grafana) se puede extender:

**Opcion A: postgres_exporter (recomendado)**
```yaml
# Anadir a docker-compose.supabase.yml
supabase-pg-exporter:
  image: prometheuscommunity/postgres-exporter:v0.16.0
  environment:
    DATA_SOURCE_NAME: postgresql://supabase_admin:${SB_POSTGRES_PASSWORD}@supabase-db:5432/${SB_POSTGRES_DB:-postgres}?sslmode=disable
  expose:
    - "9187"
  depends_on:
    supabase-db: { condition: service_healthy }
  networks: [supabase, monitoring]
  restart: unless-stopped
```

**Metricas clave a monitorear:**
- `pg_stat_activity` -- conexiones activas/idle
- `pg_stat_database` -- hits/misses del cache, transacciones/s
- `pg_database_size` -- crecimiento del disco
- `pg_stat_user_tables` -- seq scans vs index scans
- `pg_locks` -- deadlocks y lock waits

### 7.2 Storage Monitoring

```bash
# Script para monitorear espacio de Storage
# Exponer como metrica custom para Prometheus
docker exec podai-supabase-db-1 psql -U postgres -t -c \
  "SELECT pg_database_size('postgres');"
```

### 7.3 Auth Monitoring (failed logins)

GoTrue logs failed logins a stdout. Con Vector + Loki, se pueden crear alertas:
```
{container_name="supabase-auth"} |= "invalid_grant"
```

### 7.4 Grafana Dashboards recomendados

| Dashboard | ID (Grafana.com) | Descripcion |
|---|---|---|
| PostgreSQL Overview | 9628 | Conexiones, queries, cache hit ratio |
| Docker Container Monitoring | 893 | CPU/RAM por container |
| Caddy Monitoring | 15049 | Requests, latency, status codes |

---

## 8. Performance Tuning

### 8.1 PostgreSQL Tuning para VPS

Crear archivo `deploy/supabase/postgresql-custom.conf`:

```ini
***REMOVED***=====
# PostgreSQL Custom Configuration for VPS
***REMOVED***=====
# Target: 8 GB RAM VPS, 4 vCPU
# Container memory limit: 1.5 GB
***REMOVED***=====

# --- Memory ---
shared_buffers = 384MB              # 25% of container limit (1.5GB)
effective_cache_size = 1GB           # OS cache estimate
work_mem = 4MB                       # Per-operation sort memory
maintenance_work_mem = 128MB         # VACUUM, CREATE INDEX
wal_buffers = 16MB                   # WAL write buffer

# --- Connections ---
max_connections = 100                # Supavisor handles pooling
superuser_reserved_connections = 3

# --- WAL ---
wal_level = replica                  # Enables future replication
max_wal_size = 1GB
min_wal_size = 80MB
checkpoint_completion_target = 0.9
checkpoint_timeout = 10min

# --- Query Planner ---
random_page_cost = 1.1               # SSD storage
effective_io_concurrency = 200       # SSD concurrent reads
default_statistics_target = 100

# --- Autovacuum ---
autovacuum = on
autovacuum_max_workers = 2           # Limit for small VPS
autovacuum_naptime = 60s
autovacuum_vacuum_scale_factor = 0.05
autovacuum_analyze_scale_factor = 0.02

# --- Logging ---
log_min_messages = warning
log_min_error_statement = error
log_min_duration_statement = 1000    # Log queries >1s
log_checkpoints = on
log_connections = off                # Reduce noise
log_disconnections = off
log_lock_waits = on

# --- Performance ---
huge_pages = try                     # Use if available
jit = off                            # Disable JIT for small workloads
```

Montar en docker-compose:
```yaml
supabase-db:
  volumes:
    - ./deploy/supabase/postgresql-custom.conf:/etc/postgresql-custom/postgresql.conf:ro
```

### 8.2 Supavisor vs PgBouncer

**Supabase usa Supavisor** (Elixir-based, built-in). No se necesita PgBouncer externo.

Supavisor config clave:
```
POOLER_DEFAULT_POOL_SIZE=20    # Max PG connections per pool
POOLER_MAX_CLIENT_CONN=100     # Max client connections
POOLER_POOL_MODE=transaction   # Transaction pooling (recommended)
```

Para VPS con 100 max_connections en PG:
- Supavisor pool: 20 connections
- Servicios internos (auth, rest, realtime, storage, meta): ~30 connections
- Headroom: ~50 connections

### 8.3 Kong Memory Optimization

Kong puede consumir 2.5 GB sin limites. Con `deploy.resources.limits.memory: 512M` se mantiene bajo control. Si Kong se reinicia por OOM:

1. Aumentar limite a 768M
2. O reducir `KONG_NGINX_PROXY_PROXY_BUFFERS: 32 80k` (mitad del default)
3. Monitorear con `docker stats supabase-kong`

### 8.4 Redis Cache Strategy (Application-Level)

El Redis existente sigue siendo util para:
- Rate limiting (frontend)
- Session cache (frontend)
- Queue de tareas (podclaw)
- Cache de respuestas (mcp-server)

**No se necesita cambiar nada en Redis** al migrar a self-hosted Supabase.

---

## 9. start.sh Modifications

### 9.1 Cambios requeridos

```bash
#!/usr/bin/env bash
# Fragmento de las modificaciones a start.sh
# NO ES EL ARCHIVO COMPLETO — solo las secciones que cambian

# --- Nuevo flag en argument parsing ---
# Anadir despues de --status):
#   --supabase)  SUPABASE="true"; shift ;;

# --- Variable nueva ---
SUPABASE="${SUPABASE:-false}"

# --- En la construccion de COMPOSE_CMD ---
if [[ "$SUPABASE" == "true" ]]; then
  SUPABASE_FILE="$SCRIPT_DIR/docker-compose.supabase.yml"
  if [[ ! -f "$SUPABASE_FILE" ]]; then
    error "docker-compose.supabase.yml not found. Cannot enable self-hosted Supabase."
    exit 1
  fi
  COMPOSE_CMD="docker compose -p $PROJECT_NAME -f $COMPOSE_FILE -f $SUPABASE_FILE -f $OVERRIDE_FILE"
fi

# --- Variables requeridas adicionales (en validate_env) ---
if [[ "$SUPABASE" == "true" ]]; then
  REQUIRED_VARS+=(
    SB_POSTGRES_PASSWORD
    SB_JWT_SECRET
    SB_ANON_KEY
    SB_SERVICE_ROLE_KEY
    SB_SECRET_KEY_BASE
    SB_VAULT_ENC_KEY
    SB_PG_META_CRYPTO_KEY
    SB_DASHBOARD_PASSWORD
    SB_API_EXTERNAL_URL
    SB_SITE_URL
  )
fi

# --- Fase de arranque actualizada (en do_up) ---
# Reemplazar Phase 1-3 con Phase 1-5:

do_up() {
  info "Building images..."
  $COMPOSE_CMD build

  if [[ "$SUPABASE" == "true" ]]; then
    info "Phase 1/5: Starting Supabase database..."
    $COMPOSE_CMD up -d supabase-db
    wait_healthy "supabase-db" 60

    info "Phase 2/5: Starting Supabase services..."
    $COMPOSE_CMD up -d supabase-auth supabase-rest supabase-realtime supabase-storage \
      supabase-imgproxy supabase-meta supabase-pooler
    wait_healthy "supabase-auth supabase-rest supabase-realtime supabase-storage" 60

    info "Phase 3/5: Starting Supabase gateway..."
    $COMPOSE_CMD up -d supabase-kong
    wait_healthy "supabase-kong" 30

    # Optional Supabase services
    $COMPOSE_CMD up -d supabase-studio supabase-vector supabase-backup 2>/dev/null || true

    info "Phase 4/5: Starting infrastructure (redis, rembg, crawl4ai)..."
  else
    info "Phase 1/3: Starting infrastructure (redis, rembg, crawl4ai)..."
  fi

  $COMPOSE_CMD up -d redis rembg crawl4ai svg-renderer
  wait_infra_healthy 60

  if [[ "$SUPABASE" == "true" ]]; then
    info "Phase 5/5: Starting application + proxy..."
  else
    info "Phase 2/3: Starting application..."
  fi

  $COMPOSE_CMD up -d podclaw frontend admin mcp-server
  $COMPOSE_CMD up -d caddy

  # Monitoring (optional, existing)
  if [[ "${ENABLE_MONITORING:-false}" == "true" ]]; then
    $COMPOSE_CMD up -d prometheus grafana loki 2>/dev/null || true
  fi

  sleep 3
  ok "All services started!"
  $COMPOSE_CMD ps
}
```

### 9.2 Uso actualizado

```bash
./start.sh                       # Local dev, Supabase Cloud
./start.sh --supabase            # Local dev, Supabase Self-Hosted
./start.sh --prod --supabase     # Production, Supabase Self-Hosted
./start.sh --status              # Show all services
./start.sh --down                # Stop everything
```

---

## 10. Secrets Management

### 10.1 Variables de Entorno Supabase (anadir a .env.example)

```bash
# -------------------------------------------------------------------
# [SELF-HOSTED SUPABASE] — Only needed if using --supabase flag
# Used by: docker-compose.supabase.yml
# -------------------------------------------------------------------

# Database password (use only letters and numbers, no special chars)
# Generate: openssl rand -hex 24
SB_POSTGRES_PASSWORD=change-me

# JWT secret (minimum 32 characters)
# Generate: openssl rand -hex 32
SB_JWT_SECRET=change-me

# Pre-generated JWT tokens (generate at https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys)
# These MUST be generated using the SB_JWT_SECRET above
SB_ANON_KEY=change-me
SB_SERVICE_ROLE_KEY=change-me

# Encryption keys
# Generate: openssl rand -hex 32 (for SECRET_KEY_BASE: min 64 chars)
SB_SECRET_KEY_BASE=change-me-min-64-chars
# Generate: openssl rand -hex 16 (exactly 32 chars)
SB_VAULT_ENC_KEY=change-me-exactly-32-chars
# Generate: openssl rand -hex 16 (min 32 chars)
SB_PG_META_CRYPTO_KEY=change-me-min-32-chars

# Dashboard access (change before deploying!)
SB_DASHBOARD_USERNAME=supabase
SB_DASHBOARD_PASSWORD=change-me-strong-password

# External URLs (set to your domain in production)
SB_API_EXTERNAL_URL=http://localhost:8000
SB_SITE_URL=http://localhost:3000
SB_ADDITIONAL_REDIRECT_URLS=

# SMTP (for auth emails — can reuse Resend)
SB_SMTP_HOST=
SB_SMTP_PORT=587
SB_SMTP_USER=
SB_SMTP_PASS=
SB_SMTP_ADMIN_EMAIL=noreply@yourdomain.com
SB_SMTP_SENDER_NAME=SKAPARA

# PostgreSQL tuning
SB_POSTGRES_DB=postgres

# Connection pooling
SB_POOLER_TENANT_ID=podai-tenant
SB_POOLER_POOL_SIZE=20
SB_POOLER_MAX_CONN=100

# Backup schedule
SB_BACKUP_CRON="0 3 * * *"
SB_BACKUP_RETENTION_DAYS=30

# Analytics (optional — set to dummy if analytics disabled)
SB_LOGFLARE_PUBLIC_TOKEN=dummy-not-used
SB_LOGFLARE_PRIVATE_TOKEN=dummy-not-used

# JWT expiry (seconds)
SB_JWT_EXPIRY=3600

# Email auto-confirm (set true for dev, false for prod)
SB_ENABLE_EMAIL_AUTOCONFIRM=false
```

### 10.2 Principio de Privilegio Minimo

Cada servicio recibe SOLO los secrets que necesita:

| Servicio | Secrets que recibe |
|---|---|
| supabase-db | SB_POSTGRES_PASSWORD, SB_JWT_SECRET |
| supabase-auth | SB_POSTGRES_PASSWORD, SB_JWT_SECRET, SB_SMTP_* |
| supabase-rest | SB_POSTGRES_PASSWORD, SB_JWT_SECRET |
| supabase-realtime | SB_POSTGRES_PASSWORD, SB_JWT_SECRET, SB_SECRET_KEY_BASE, SB_VAULT_ENC_KEY |
| supabase-storage | SB_POSTGRES_PASSWORD, SB_JWT_SECRET, SB_ANON_KEY, SB_SERVICE_ROLE_KEY |
| supabase-kong | SB_ANON_KEY, SB_SERVICE_ROLE_KEY, SB_DASHBOARD_* |
| supabase-studio | SB_POSTGRES_PASSWORD, SB_JWT_SECRET, SB_ANON_KEY, SB_SERVICE_ROLE_KEY |
| supabase-pooler | SB_POSTGRES_PASSWORD, SB_JWT_SECRET, SB_SECRET_KEY_BASE, SB_VAULT_ENC_KEY |
| supabase-meta | SB_POSTGRES_PASSWORD, SB_PG_META_CRYPTO_KEY |
| supabase-backup | SB_POSTGRES_PASSWORD |

### 10.3 Prefijo SB_ para evitar colisiones

Todas las variables de Supabase usan prefijo `SB_` para evitar colisiones con las variables existentes del stack:
- `SUPABASE_URL` (existente, app-level) vs `SB_API_EXTERNAL_URL` (Supabase infra)
- `SUPABASE_SERVICE_KEY` (existente, app-level) vs `SB_SERVICE_ROLE_KEY` (Supabase infra)

**En la migracion**: Los valores de `SUPABASE_SERVICE_KEY` y `SB_SERVICE_ROLE_KEY` seran **el mismo token**, pero se mantienen como variables separadas para claridad.

### 10.4 Generacion de JWT Keys

```bash
# 1. Generar JWT secret
SB_JWT_SECRET=$(openssl rand -hex 32)

# 2. Generar ANON_KEY (rol: anon, exp: 5 years)
# Usar: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
# O con Python:
python3 -c "
import jwt, time
secret = '$SB_JWT_SECRET'
payload = {
    'role': 'anon',
    'iss': 'supabase',
    'iat': int(time.time()),
    'exp': int(time.time()) + 157680000  # 5 years
}
print(jwt.encode(payload, secret, algorithm='HS256'))
"

# 3. Generar SERVICE_ROLE_KEY (rol: service_role, exp: 5 years)
python3 -c "
import jwt, time
secret = '$SB_JWT_SECRET'
payload = {
    'role': 'service_role',
    'iss': 'supabase',
    'iat': int(time.time()),
    'exp': int(time.time()) + 157680000  # 5 years
}
print(jwt.encode(payload, secret, algorithm='HS256'))
"
```

---

## 11. Migration Checklist (Cloud -> Self-Hosted)

### 11.1 Pre-Migration

- [ ] Elegir VPS (minimo 8 GB RAM, 80 GB SSD, 4 vCPU)
- [ ] Configurar DNS (A record del dominio apuntando al VPS)
- [ ] Instalar Docker + Docker Compose en el VPS
- [ ] Clonar repo del proyecto en el VPS
- [ ] Crear directorio `deploy/supabase/` con los archivos de configuracion
- [ ] Copiar init SQL scripts del repo oficial de Supabase (`docker/volumes/db/`)
- [ ] Copiar Kong config YAML (`docker/volumes/api/kong.yml`)
- [ ] Generar TODOS los secrets (ver seccion 10.4)
- [ ] Configurar `.env` con todos los valores `SB_*`
- [ ] Backup completo de la DB en Supabase Cloud (`supabase db dump`)
- [ ] Backup de Storage (descargar archivos desde Supabase Cloud)

### 11.2 Deploy

- [ ] Crear `docker-compose.supabase.yml` (ver seccion 2.2)
- [ ] Crear `deploy/supabase/postgresql-custom.conf` (ver seccion 8.1)
- [ ] Actualizar `deploy/Caddyfile` con rutas de Supabase (ver seccion 3.1)
- [ ] Actualizar `start.sh` con soporte `--supabase` (ver seccion 9.1)
- [ ] Ejecutar `./start.sh --supabase` (local primero para validar)
- [ ] Verificar que supabase-db arranca y pasa healthcheck
- [ ] Verificar que todos los servicios Supabase pasan healthcheck
- [ ] Verificar que Kong responde en las rutas esperadas

### 11.3 Data Migration

- [ ] Restaurar schema en supabase-db self-hosted
- [ ] Restaurar data (pg_restore o psql < dump.sql)
- [ ] Verificar conteo de tablas y registros
- [ ] Restaurar archivos de Storage al volumen `supabase-storage-data`
- [ ] Verificar acceso a archivos via `/storage/v1/`

### 11.4 Application Cutover

- [ ] Actualizar `NEXT_PUBLIC_SUPABASE_URL` al dominio propio (build-time)
- [ ] Actualizar `SUPABASE_URL` para apuntar a `http://supabase-kong:8000` (runtime)
- [ ] Actualizar `SUPABASE_SERVICE_KEY` con el nuevo `SB_SERVICE_ROLE_KEY`
- [ ] Actualizar `SUPABASE_ANON_KEY` con el nuevo `SB_ANON_KEY`
- [ ] Rebuild frontend y admin (`docker compose build frontend admin`)
- [ ] Reiniciar todos los servicios
- [ ] Probar login/signup en la app
- [ ] Probar Realtime (WebSocket subscriptions)
- [ ] Probar Storage (upload/download de archivos)
- [ ] Probar REST API (CRUD operations)
- [ ] Probar checkout flow completo (Stripe + DB)

### 11.5 Post-Migration

- [ ] Configurar backups automaticos (crontab, pg-backup-scheduler)
- [ ] Configurar monitoring (postgres_exporter, Grafana dashboards)
- [ ] Test de disaster recovery (restaurar un backup)
- [ ] Documentar runbook de operaciones
- [ ] Desactivar proyecto en Supabase Cloud (o mantener como fallback 30 dias)
- [ ] Configurar alertas (Grafana -> Telegram) para:
  - DB disk usage > 80%
  - DB connections > 80 (de 100)
  - Container restarts
  - Failed auth attempts > 100/h
- [ ] Optimizar CSP headers (eliminar referencias a *.supabase.co)
- [ ] Verificar que Cloudflare proxy funciona correctamente con Caddy

---

## 12. Riesgos y Mitigaciones

| Riesgo | Impacto | Probabilidad | Mitigacion |
|---|---|---|---|
| PostgreSQL crash con data loss | CRITICO | Baja | Backups diarios, WAL archiving futuro |
| Disco lleno (Storage crece) | Alto | Media | Monitoring + alertas, expansion de disco |
| RAM insuficiente (OOM kills) | Alto | Media | Resource limits por container, swap file 4GB |
| Kong consume 2.5 GB RAM | Medio | Alta | Memory limit 512M, monitorear OOM restarts |
| Upgrade de Supabase rompe algo | Alto | Media | Probar upgrades en staging primero |
| Secrets comprometidos en .env | CRITICO | Baja | Permisos 600 en .env, considerar Vault futuro |
| Realtime WebSocket falla con Caddy | Medio | Baja | Caddy maneja WS natively, probar en staging |
| Migracion de datos pierde registros | CRITICO | Baja | Verificar conteos pre/post migracion |

### Swap file (recomendado en VPS con 8 GB):

```bash
# Crear swap de 4 GB
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Ajustar swappiness
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## 13. Archivos a Crear/Modificar (Resumen)

| Archivo | Accion | Descripcion |
|---|---|---|
| `docker-compose.supabase.yml` | CREAR | Overlay con ~12 servicios Supabase |
| `deploy/Caddyfile` | MODIFICAR | Anadir rutas /auth/*, /rest/*, /storage/*, /realtime/* |
| `deploy/supabase/volumes/db/*.sql` | COPIAR | Init scripts del repo oficial Supabase |
| `deploy/supabase/volumes/api/kong.yml` | COPIAR | Kong API gateway config del repo oficial |
| `deploy/supabase/volumes/logs/vector.yml` | COPIAR | Vector log pipeline config (opcional) |
| `deploy/supabase/postgresql-custom.conf` | CREAR | PostgreSQL tuning para VPS |
| `start.sh` | MODIFICAR | Anadir flag --supabase, fases de arranque |
| `.env.example` | MODIFICAR | Anadir seccion [SELF-HOSTED SUPABASE] |
| `scripts/backup-storage.sh` | CREAR | Backup script para Storage volume |
| `scripts/backup-config.sh` | CREAR | Backup script para config files |

---

## 14. Fuentes

- [Supabase Self-Hosting with Docker (official docs)](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase Docker Compose (GitHub)](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml)
- [Supabase Caddy Proxy Configuration (official docs)](https://supabase.com/docs/guides/self-hosting/self-hosted-proxy-https)
- [Supabase Caddy Docker Overlay (GitHub)](https://github.com/supabase/supabase/blob/master/docker/docker-compose.caddy.yml)
- [Supabase .env.example (GitHub)](https://github.com/supabase/supabase/blob/master/docker/.env.example)
- [Supabase Self-Hosted Resource Usage (Discussion #26159)](https://github.com/orgs/supabase/discussions/26159)
- [Supabase Minimum Requirements (Discussion #21132)](https://github.com/orgs/supabase/discussions/21132)
- [pg-backup-scheduler (GitHub)](https://github.com/mxschmitt/pg-backup-scheduler)
- [PostgreSQL Performance Tuning (Wiki)](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server)
- [PostgreSQL Docker Performance (Bret Fisher)](https://github.com/BretFisher/ama/discussions/219)
- [PostgreSQL Memory Tuning (EDB)](https://www.enterprisedb.com/postgres-tutorials/how-tune-postgresql-memory)
- [Supabase Self-Host with Caddy (flori.dev)](https://flori.dev/reads/supabase-self-host-docker-caddy-reverse-proxy/)
- [Supabase Self-Host with Caddy (Caddy Community)](https://caddy.community/t/reverse-proxy-self-hosted-supabase-with-caddy/20529)
- [Supabase Kong Configuration (GitHub)](https://github.com/supabase/supabase/blob/master/docker/volumes/api/kong.yml)
- [Supabase Backup Discussion (Discussion #37748)](https://github.com/orgs/supabase/discussions/37748)
