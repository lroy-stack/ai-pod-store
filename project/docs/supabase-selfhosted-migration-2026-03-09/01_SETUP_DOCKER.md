# Supabase Self-Hosted con Docker - Setup Completo

> Fecha: 2026-03-09
> Fuentes: Documentacion oficial Supabase, repositorio GitHub `supabase/supabase`, discusiones de la comunidad
> Proposito: Referencia para migrar de Supabase Cloud a self-hosted en Docker Compose

---

## 1. Arquitectura de Servicios

```
                              Internet
                                 |
                          [Reverse Proxy]
                        (Caddy / Nginx)
                          :80 / :443
                                |
                       +--------+--------+
                       |   Kong Gateway  |
                       |   :8000 / :8443 |
                       +--------+--------+
                                |
        +---------+----+--------+--------+----+---------+---------+
        |         |    |        |        |    |         |         |
   +----+---+ +---+--+ +-------+--+ +---+--+ +---+---+ +---+---+ +--------+
   | GoTrue | | REST | | Realtime | | Store| | Funct | | Meta  | |Analytics|
   | (Auth) | |PostgR| |  (WS)   | | API  | | Edge  | |pg-meta| |Logflare|
   | :9999  | | :3000| |  :4000  | | :5000| | :9000 | | :8080 | | :4000  |
   +----+---+ +---+--+ +----+----+ +---+--+ +---+---+ +---+---+ +---+----+
        |         |          |          |        |         |          |
        +----+----+-----+----+-----+----+--------+---------+----+-----+
             |          |          |                             |
        +----+----+ +---+------+ +-+--------+            +------+-----+
        |Supavisor| |PostgreSQL| | imgproxy |            |   Vector   |
        |(pooler) | |  15.8.1  | |  :5001   |            |   :9001    |
        |:5432    | |          | +----------+            +------------+
        |:6543    | +----------+
        +---------+
```

### Flujo de trafico

1. **Todo el trafico externo** entra por Kong (puerto 8000 HTTP / 8443 HTTPS)
2. Kong enruta segun path:
   - `/auth/v1/*` --> GoTrue (autenticacion)
   - `/rest/v1/*` --> PostgREST (REST API)
   - `/realtime/v1/*` --> Realtime (WebSocket)
   - `/storage/v1/*` --> Storage API (archivos)
   - `/functions/v1/*` --> Edge Functions (Deno)
   - `/analytics/v1/*` --> Logflare (logs)
   - `/pg/*` --> postgres-meta (admin, solo role admin)
   - `/*` --> Studio (dashboard, HTTP Basic Auth)
3. **Supavisor** expone puertos 5432 (session mode) y 6543 (transaction mode) para conexion directa a PostgreSQL
4. **Vector** recolecta logs de todos los contenedores via Docker socket y los envia a Logflare/Analytics
5. **imgproxy** comparte volumen con Storage para transformacion de imagenes

---

## 2. Servicios del Docker Compose Oficial

El stack oficial incluye **12 servicios** (11 + Supavisor):

| # | Servicio | Imagen | Puerto Interno | Puerto Expuesto | Funcion |
|---|----------|--------|---------------|-----------------|---------|
| 1 | **studio** | `supabase/studio:2026.02.16-sha-26c615c` | 3000 | (via Kong) | Dashboard web de administracion |
| 2 | **kong** | `kong:2.8.1` | 8000, 8443 | **8000**, **8443** | API Gateway, enruta todo el trafico |
| 3 | **auth** (GoTrue) | `supabase/gotrue:v2.186.0` | 9999 | (via Kong) | Autenticacion JWT, OAuth, email/phone |
| 4 | **rest** (PostgREST) | `postgrest/postgrest:v14.5` | 3000 | (via Kong) | REST API auto-generada desde esquema DB |
| 5 | **realtime** | `supabase/realtime:v2.76.5` | 4000 | (via Kong) | WebSocket, broadcast cambios DB |
| 6 | **storage** | `supabase/storage-api:v1.37.8` | 5000 | (via Kong) | Gestion de archivos, S3-compatible |
| 7 | **imgproxy** | `darthsim/imgproxy:v3.30.1` | 5001 | -- | Transformacion y optimizacion de imagenes |
| 8 | **meta** (postgres-meta) | `supabase/postgres-meta:v0.95.2` | 8080 | (via Kong) | API REST para administracion de la DB |
| 9 | **functions** (Edge Runtime) | `supabase/edge-runtime:v1.70.3` | 9000 | (via Kong) | Ejecuta funciones JavaScript/TypeScript (Deno) |
| 10 | **analytics** (Logflare) | `supabase/logflare:1.31.2` | 4000 | -- | Logging y analytics |
| 11 | **db** (PostgreSQL) | `supabase/postgres:15.8.1.085` | 5432 | -- | Base de datos principal |
| 12 | **vector** | `timberio/vector:0.53.0-alpine` | 9001 | -- | Agregacion y routing de logs |
| 13 | **supavisor** (pooler) | `supabase/supavisor:2.7.4` | 5432, 6543, 4000 | **5432**, **6543** | Connection pooling (session + transaction mode) |

### Puertos expuestos al host

Solo **3 puertos** se exponen al host:
- **8000** (Kong HTTP) - Punto de entrada principal para API y Dashboard
- **8443** (Kong HTTPS) - HTTPS nativo de Kong (opcional si usas Caddy/Nginx delante)
- **5432** (Supavisor session) - Conexion directa a PostgreSQL via pooler
- **6543** (Supavisor transaction) - Conexion pooled en modo transaccion

---

## 3. Docker Compose Completo (con comentarios)

```yaml
# Referencia: https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml
# Version: Febrero 2026

name: supabase

services:

  ***REMOVED***
  # STUDIO - Dashboard web de administracion
  ***REMOVED***
  studio:
    container_name: supabase-studio
    image: supabase/studio:2026.02.16-sha-26c615c
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e",
        "fetch('http://studio:3000/api/platform/profile').then((r) => {if (r.status !== 200) throw new Error(r.status)})"]
      timeout: 10s
      interval: 5s
      retries: 3
    depends_on:
      analytics:
        condition: service_healthy
    environment:
      HOSTNAME: "::"                        # Bind IPv4 + IPv6
      STUDIO_PG_META_URL: http://meta:8080  # Conexion interna a postgres-meta
      POSTGRES_PORT: ${POSTGRES_PORT}
      POSTGRES_HOST: ${POSTGRES_HOST}
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PG_META_CRYPTO_KEY: ${PG_META_CRYPTO_KEY}
      DEFAULT_ORGANIZATION_NAME: ${STUDIO_DEFAULT_ORGANIZATION}
      DEFAULT_PROJECT_NAME: ${STUDIO_DEFAULT_PROJECT}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}   # Opcional: AI Assistant en Studio
      SUPABASE_URL: http://kong:8000        # Conexion interna a Kong
      SUPABASE_PUBLIC_URL: ${SUPABASE_PUBLIC_URL}
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SERVICE_ROLE_KEY}
      AUTH_JWT_SECRET: ${JWT_SECRET}
      LOGFLARE_API_KEY: ${LOGFLARE_PUBLIC_ACCESS_TOKEN}
      LOGFLARE_PUBLIC_ACCESS_TOKEN: ${LOGFLARE_PUBLIC_ACCESS_TOKEN}
      LOGFLARE_PRIVATE_ACCESS_TOKEN: ${LOGFLARE_PRIVATE_ACCESS_TOKEN}
      LOGFLARE_URL: http://analytics:4000
      NEXT_PUBLIC_ENABLE_LOGS: true
      NEXT_ANALYTICS_BACKEND_PROVIDER: postgres  # BigQuery como alternativa
      SNIPPETS_MANAGEMENT_FOLDER: /app/snippets
      EDGE_FUNCTIONS_MANAGEMENT_FOLDER: /app/edge-functions
    volumes:
      - ./volumes/snippets:/app/snippets:Z
      - ./volumes/functions:/app/edge-functions:Z

  ***REMOVED***
  # KONG - API Gateway (enruta TODAS las requests)
  ***REMOVED***
  kong:
    container_name: supabase-kong
    image: kong:2.8.1
    restart: unless-stopped
    ports:
      - ${KONG_HTTP_PORT}:8000/tcp   # API HTTP
      - ${KONG_HTTPS_PORT}:8443/tcp  # API HTTPS
    volumes:
      - ./volumes/api/kong.yml:/home/kong/temp.yml:ro,z
    depends_on:
      analytics:
        condition: service_healthy
    environment:
      KONG_DATABASE: "off"                    # Modo declarativo (sin DB propia)
      KONG_DECLARATIVE_CONFIG: /home/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl,basic-auth,request-termination,ip-restriction
      KONG_NGINX_PROXY_PROXY_BUFFER_SIZE: 160k
      KONG_NGINX_PROXY_PROXY_BUFFERS: 64 160k
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SERVICE_ROLE_KEY}
      DASHBOARD_USERNAME: ${DASHBOARD_USERNAME}
      DASHBOARD_PASSWORD: ${DASHBOARD_PASSWORD}
    # Sustituye env vars en kong.yml al arrancar
    entrypoint: bash -c 'eval "echo \"$$(cat ~/temp.yml)\"" > ~/kong.yml && /docker-entrypoint.sh kong docker-start'

  ***REMOVED***
  # AUTH (GoTrue) - Autenticacion y JWT
  ***REMOVED***
  auth:
    container_name: supabase-auth
    image: supabase/gotrue:v2.186.0
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:9999/health"]
      timeout: 5s
      interval: 5s
      retries: 3
    depends_on:
      db:
        condition: service_healthy
      analytics:
        condition: service_healthy
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: ${API_EXTERNAL_URL}
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
      GOTRUE_SITE_URL: ${SITE_URL}
      GOTRUE_URI_ALLOW_LIST: ${ADDITIONAL_REDIRECT_URLS}
      GOTRUE_DISABLE_SIGNUP: ${DISABLE_SIGNUP}
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_EXP: ${JWT_EXPIRY}
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_EXTERNAL_EMAIL_ENABLED: ${ENABLE_EMAIL_SIGNUP}
      GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: ${ENABLE_ANONYMOUS_USERS}
      GOTRUE_MAILER_AUTOCONFIRM: ${ENABLE_EMAIL_AUTOCONFIRM}
      GOTRUE_SMTP_ADMIN_EMAIL: ${SMTP_ADMIN_EMAIL}
      GOTRUE_SMTP_HOST: ${SMTP_HOST}
      GOTRUE_SMTP_PORT: ${SMTP_PORT}
      GOTRUE_SMTP_USER: ${SMTP_USER}
      GOTRUE_SMTP_PASS: ${SMTP_PASS}
      GOTRUE_SMTP_SENDER_NAME: ${SMTP_SENDER_NAME}
      GOTRUE_MAILER_URLPATHS_INVITE: ${MAILER_URLPATHS_INVITE}
      GOTRUE_MAILER_URLPATHS_CONFIRMATION: ${MAILER_URLPATHS_CONFIRMATION}
      GOTRUE_MAILER_URLPATHS_RECOVERY: ${MAILER_URLPATHS_RECOVERY}
      GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: ${MAILER_URLPATHS_EMAIL_CHANGE}
      GOTRUE_EXTERNAL_PHONE_ENABLED: ${ENABLE_PHONE_SIGNUP}
      GOTRUE_SMS_AUTOCONFIRM: ${ENABLE_PHONE_AUTOCONFIRM}
      # OAuth: descomentar para habilitar (Google, GitHub, Azure)
      # GOTRUE_EXTERNAL_GOOGLE_ENABLED: ${GOOGLE_ENABLED}
      # GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      # GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_SECRET}
      # GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: ${API_EXTERNAL_URL}/auth/v1/callback
      # MFA: descomentar para configurar
      # GOTRUE_MFA_TOTP_ENROLL_ENABLED: ${MFA_TOTP_ENROLL_ENABLED}
      # GOTRUE_MFA_TOTP_VERIFY_ENABLED: ${MFA_TOTP_VERIFY_ENABLED}

  ***REMOVED***
  # REST (PostgREST) - API REST auto-generada
  ***REMOVED***
  rest:
    container_name: supabase-rest
    image: postgrest/postgrest:v14.5
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      analytics:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgres://authenticator:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
      PGRST_DB_SCHEMAS: ${PGRST_DB_SCHEMAS}  # public,storage,graphql_public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET}
      PGRST_DB_USE_LEGACY_GUCS: "false"
      PGRST_APP_SETTINGS_JWT_SECRET: ${JWT_SECRET}
      PGRST_APP_SETTINGS_JWT_EXP: ${JWT_EXPIRY}
    command: ["postgrest"]

  ***REMOVED***
  # REALTIME - WebSocket, broadcast de cambios DB
  ***REMOVED***
  realtime:
    container_name: realtime-dev.supabase-realtime
    image: supabase/realtime:v2.76.5
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      analytics:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL",
        "curl -sSfL --head -o /dev/null -H \"Authorization: Bearer ${ANON_KEY}\" http://localhost:4000/api/tenants/realtime-dev/health"]
      timeout: 5s
      interval: 30s
      retries: 3
      start_period: 10s
    environment:
      PORT: 4000
      DB_HOST: ${POSTGRES_HOST}
      DB_PORT: ${POSTGRES_PORT}
      DB_USER: supabase_admin
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      DB_NAME: ${POSTGRES_DB}
      DB_AFTER_CONNECT_QUERY: 'SET search_path TO _realtime'
      DB_ENC_KEY: supabaserealtime
      API_JWT_SECRET: ${JWT_SECRET}
      SECRET_KEY_BASE: ${SECRET_KEY_BASE}
      ERL_AFLAGS: -proto_dist inet_tcp
      DNS_NODES: "''"
      RLIMIT_NOFILE: "10000"
      APP_NAME: realtime
      SEED_SELF_HOST: "true"
      RUN_JANITOR: "true"

  ***REMOVED***
  # STORAGE - Gestion de archivos S3-compatible
  ***REMOVED***
  storage:
    container_name: supabase-storage
    image: supabase/storage-api:v1.37.8
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      rest:
        condition: service_started
      imgproxy:
        condition: service_started
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://storage:5000/status"]
      timeout: 5s
      interval: 5s
      retries: 3
    environment:
      ANON_KEY: ${ANON_KEY}
      SERVICE_KEY: ${SERVICE_ROLE_KEY}
      POSTGREST_URL: http://rest:3000
      PGRST_JWT_SECRET: ${JWT_SECRET}
      DATABASE_URL: postgres://supabase_storage_admin:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
      FILE_SIZE_LIMIT: 52428800            # 50MB
      STORAGE_BACKEND: file                # 'file' o 's3'
      GLOBAL_S3_BUCKET: ${GLOBAL_S3_BUCKET}
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      TENANT_ID: ${STORAGE_TENANT_ID}
      REGION: ${REGION}
      ENABLE_IMAGE_TRANSFORMATION: "true"
      IMGPROXY_URL: http://imgproxy:5001
      S3_PROTOCOL_ACCESS_KEY_ID: ${S3_PROTOCOL_ACCESS_KEY_ID}
      S3_PROTOCOL_ACCESS_KEY_SECRET: ${S3_PROTOCOL_ACCESS_KEY_SECRET}
    volumes:
      - ./volumes/storage:/var/lib/storage:z

  ***REMOVED***
  # IMGPROXY - Transformacion de imagenes
  ***REMOVED***
  imgproxy:
    container_name: supabase-imgproxy
    image: darthsim/imgproxy:v3.30.1
    restart: unless-stopped
    volumes:
      - ./volumes/storage:/var/lib/storage:z  # Comparte volumen con Storage
    healthcheck:
      test: ["CMD", "imgproxy", "health"]
      timeout: 5s
      interval: 5s
      retries: 3
    environment:
      IMGPROXY_BIND: ":5001"
      IMGPROXY_LOCAL_FILESYSTEM_ROOT: /
      IMGPROXY_USE_ETAG: "true"
      IMGPROXY_ENABLE_WEBP_DETECTION: ${IMGPROXY_ENABLE_WEBP_DETECTION}
      IMGPROXY_MAX_SRC_RESOLUTION: 16.8

  ***REMOVED***
  # META (postgres-meta) - API de administracion de la DB
  ***REMOVED***
  meta:
    container_name: supabase-meta
    image: supabase/postgres-meta:v0.95.2
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      analytics:
        condition: service_healthy
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: ${POSTGRES_HOST}
      PG_META_DB_PORT: ${POSTGRES_PORT}
      PG_META_DB_NAME: ${POSTGRES_DB}
      PG_META_DB_USER: supabase_admin
      PG_META_DB_PASSWORD: ${POSTGRES_PASSWORD}
      CRYPTO_KEY: ${PG_META_CRYPTO_KEY}

  ***REMOVED***
  # FUNCTIONS (Edge Runtime) - Funciones serverless (Deno)
  ***REMOVED***
  functions:
    container_name: supabase-edge-functions
    image: supabase/edge-runtime:v1.70.3
    restart: unless-stopped
    volumes:
      - ./volumes/functions:/home/deno/functions:Z
      - deno-cache:/root/.cache/deno
    depends_on:
      analytics:
        condition: service_healthy
    environment:
      JWT_SECRET: ${JWT_SECRET}
      SUPABASE_URL: http://kong:8000
      SUPABASE_PUBLIC_URL: ${SUPABASE_PUBLIC_URL}
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
      SUPABASE_DB_URL: postgresql://postgres:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
      VERIFY_JWT: "${FUNCTIONS_VERIFY_JWT}"
    command: ["start", "--main-service", "/home/deno/functions/main"]

  ***REMOVED***
  # ANALYTICS (Logflare) - Logging y observabilidad
  ***REMOVED***
  analytics:
    container_name: supabase-analytics
    image: supabase/logflare:1.31.2
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "http://localhost:4000/health"]
      timeout: 5s
      interval: 5s
      retries: 10
    depends_on:
      db:
        condition: service_healthy
    environment:
      LOGFLARE_NODE_HOST: 127.0.0.1
      DB_USERNAME: supabase_admin
      DB_DATABASE: _supabase
      DB_HOSTNAME: ${POSTGRES_HOST}
      DB_PORT: ${POSTGRES_PORT}
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      DB_SCHEMA: _analytics
      LOGFLARE_PUBLIC_ACCESS_TOKEN: ${LOGFLARE_PUBLIC_ACCESS_TOKEN}
      LOGFLARE_PRIVATE_ACCESS_TOKEN: ${LOGFLARE_PRIVATE_ACCESS_TOKEN}
      LOGFLARE_SINGLE_TENANT: true
      LOGFLARE_SUPABASE_MODE: true
      POSTGRES_BACKEND_URL: postgresql://supabase_admin:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/_supabase
      POSTGRES_BACKEND_SCHEMA: _analytics
      LOGFLARE_FEATURE_FLAG_OVERRIDE: multibackend=true

  ***REMOVED***
  # DB (PostgreSQL) - Base de datos principal
  ***REMOVED***
  db:
    container_name: supabase-db
    image: supabase/postgres:15.8.1.085
    restart: unless-stopped
    volumes:
      - ./volumes/db/realtime.sql:/docker-entrypoint-initdb.d/migrations/99-realtime.sql:Z
      - ./volumes/db/webhooks.sql:/docker-entrypoint-initdb.d/init-scripts/98-webhooks.sql:Z
      - ./volumes/db/roles.sql:/docker-entrypoint-initdb.d/init-scripts/99-roles.sql:Z
      - ./volumes/db/jwt.sql:/docker-entrypoint-initdb.d/init-scripts/99-jwt.sql:Z
      - ./volumes/db/data:/var/lib/postgresql/data:Z          # PGDATA persistente
      - ./volumes/db/_supabase.sql:/docker-entrypoint-initdb.d/migrations/97-_supabase.sql:Z
      - ./volumes/db/logs.sql:/docker-entrypoint-initdb.d/migrations/99-logs.sql:Z
      - ./volumes/db/pooler.sql:/docker-entrypoint-initdb.d/migrations/99-pooler.sql:Z
      - db-config:/etc/postgresql-custom                       # pgsodium decryption key
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 10
    depends_on:
      vector:
        condition: service_healthy
    environment:
      POSTGRES_HOST: /var/run/postgresql
      PGPORT: ${POSTGRES_PORT}
      POSTGRES_PORT: ${POSTGRES_PORT}
      PGPASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATABASE: ${POSTGRES_DB}
      POSTGRES_DB: ${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXP: ${JWT_EXPIRY}
    command:
      - "postgres"
      - "-c"
      - "config_file=/etc/postgresql/postgresql.conf"
      - "-c"
      - "log_min_messages=fatal"   # Suprime queries de polling de Realtime

  ***REMOVED***
  # VECTOR - Agregacion de logs (envia a Logflare)
  ***REMOVED***
  vector:
    container_name: supabase-vector
    image: timberio/vector:0.53.0-alpine
    restart: unless-stopped
    volumes:
      - ./volumes/logs/vector.yml:/etc/vector/vector.yml:ro,z
      - ${DOCKER_SOCKET_LOCATION}:/var/run/docker.sock:ro,z   # Lee logs de Docker
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://vector:9001/health"]
      timeout: 5s
      interval: 5s
      retries: 3
    environment:
      LOGFLARE_PUBLIC_ACCESS_TOKEN: ${LOGFLARE_PUBLIC_ACCESS_TOKEN}
    command: ["--config", "/etc/vector/vector.yml"]
    security_opt:
      - "label=disable"

  ***REMOVED***
  # SUPAVISOR (Pooler) - Connection pooling para PostgreSQL
  ***REMOVED***
  supavisor:
    container_name: supabase-pooler
    image: supabase/supavisor:2.7.4
    restart: unless-stopped
    ports:
      - ${POSTGRES_PORT}:5432                          # Session mode
      - ${POOLER_PROXY_PORT_TRANSACTION}:6543          # Transaction mode
    volumes:
      - ./volumes/pooler/pooler.exs:/etc/pooler/pooler.exs:ro,z
    healthcheck:
      test: ["CMD", "curl", "-sSfL", "--head", "-o", "/dev/null", "http://127.0.0.1:4000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 5
    depends_on:
      db:
        condition: service_healthy
      analytics:
        condition: service_healthy
    environment:
      PORT: 4000
      POSTGRES_PORT: ${POSTGRES_PORT}
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      DATABASE_URL: ecto://supabase_admin:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/_supabase
      CLUSTER_POSTGRES: true
      SECRET_KEY_BASE: ${SECRET_KEY_BASE}
      VAULT_ENC_KEY: ${VAULT_ENC_KEY}
      API_JWT_SECRET: ${JWT_SECRET}
      METRICS_JWT_SECRET: ${JWT_SECRET}
      REGION: local
      ERL_AFLAGS: -proto_dist inet_tcp
      POOLER_TENANT_ID: ${POOLER_TENANT_ID}
      POOLER_DEFAULT_POOL_SIZE: ${POOLER_DEFAULT_POOL_SIZE}
      POOLER_MAX_CLIENT_CONN: ${POOLER_MAX_CLIENT_CONN}
      POOLER_POOL_MODE: transaction
      DB_POOL_SIZE: ${POOLER_DB_POOL_SIZE}
    command: ["/bin/sh", "-c",
      "/app/bin/migrate && /app/bin/supavisor eval \"$$(cat /etc/pooler/pooler.exs)\" && /app/bin/server"]

volumes:
  db-config:        # Persiste pgsodium decryption key
  deno-cache:       # Cache de Deno para Edge Functions
```

---

## 4. Variables de Entorno - Tabla Completa

### 4.1 Secretos Criticos (OBLIGATORIO cambiar antes del primer arranque)

| Variable | Descripcion | Min. Caracteres | Usado por |
|----------|-------------|-----------------|-----------|
| `POSTGRES_PASSWORD` | Contrasena de PostgreSQL | -- (alfanumerico recomendado) | db, auth, rest, realtime, storage, meta, analytics, supavisor |
| `JWT_SECRET` | Firma tokens JWT | 32 | auth, rest, realtime, storage, functions, supavisor, studio |
| `ANON_KEY` | API key publica (role: anon) | JWT firmado con JWT_SECRET | kong, studio, storage, functions, realtime |
| `SERVICE_ROLE_KEY` | API key privada (role: service_role) | JWT firmado con JWT_SECRET | kong, studio, storage, functions |
| `SECRET_KEY_BASE` | Encripta Realtime y Supavisor | 64 | realtime, supavisor |
| `VAULT_ENC_KEY` | Encripta connection strings | 32 (exacto) | supavisor |
| `PG_META_CRYPTO_KEY` | Seguridad de Studio/Meta | 32 | meta, studio |
| `LOGFLARE_PUBLIC_ACCESS_TOKEN` | Ingesta de logs | 32 | analytics, vector, studio |
| `LOGFLARE_PRIVATE_ACCESS_TOKEN` | Admin de logs | 32 | analytics, studio |
| `S3_PROTOCOL_ACCESS_KEY_ID` | Acceso S3 protocol endpoint | -- | storage |
| `S3_PROTOCOL_ACCESS_KEY_SECRET` | Secret S3 protocol | -- | storage |
| `DASHBOARD_USERNAME` | Login Studio | solo letras, sin numeros | kong |
| `DASHBOARD_PASSWORD` | Password Studio | min 1 letra | kong |

### 4.2 URLs (OBLIGATORIO configurar con tu dominio)

| Variable | Descripcion | Default | Usado por |
|----------|-------------|---------|-----------|
| `SUPABASE_PUBLIC_URL` | URL publica de acceso | `http://localhost:8000` | studio, functions |
| `API_EXTERNAL_URL` | URL externa del servicio Auth (para callbacks OAuth) | `http://localhost:8000` | auth |
| `SITE_URL` | URL de tu app (redirect por defecto de Auth) | `http://localhost:3000` | auth |
| `ADDITIONAL_REDIRECT_URLS` | URLs adicionales permitidas para redirect | (vacio) | auth |

### 4.3 Base de Datos

| Variable | Descripcion | Default | Usado por |
|----------|-------------|---------|-----------|
| `POSTGRES_HOST` | Hostname de PostgreSQL | `db` | todos los servicios |
| `POSTGRES_DB` | Nombre de la base de datos | `postgres` | todos los servicios |
| `POSTGRES_PORT` | Puerto de PostgreSQL | `5432` | todos los servicios |

### 4.4 Supavisor (Connection Pooler)

| Variable | Descripcion | Default | Usado por |
|----------|-------------|---------|-----------|
| `POOLER_PROXY_PORT_TRANSACTION` | Puerto para transaction mode | `6543` | supavisor |
| `POOLER_DEFAULT_POOL_SIZE` | Conexiones PG por pool | `20` | supavisor |
| `POOLER_MAX_CLIENT_CONN` | Max conexiones de clientes por pool | `100` | supavisor |
| `POOLER_TENANT_ID` | Identificador unico del tenant | `your-tenant-id` | supavisor |
| `POOLER_DB_POOL_SIZE` | Pool size para metadata interna | `5` | supavisor |

### 4.5 Studio (Dashboard)

| Variable | Descripcion | Default | Usado por |
|----------|-------------|---------|-----------|
| `STUDIO_DEFAULT_ORGANIZATION` | Nombre de la org por defecto | `Default Organization` | studio |
| `STUDIO_DEFAULT_PROJECT` | Nombre del proyecto por defecto | `Default Project` | studio |
| `OPENAI_API_KEY` | Habilita AI Assistant en Studio | (vacio, opcional) | studio |

### 4.6 Autenticacion (GoTrue)

| Variable | Descripcion | Default | Usado por |
|----------|-------------|---------|-----------|
| `JWT_EXPIRY` | Tiempo de expiracion del JWT (segundos) | `3600` | auth, rest |
| `DISABLE_SIGNUP` | Deshabilitar registro de usuarios | `false` | auth |
| `ENABLE_EMAIL_SIGNUP` | Habilitar registro por email | `true` | auth |
| `ENABLE_EMAIL_AUTOCONFIRM` | Auto-confirmar emails | `false` | auth |
| `ENABLE_ANONYMOUS_USERS` | Permitir usuarios anonimos | `false` | auth |
| `ENABLE_PHONE_SIGNUP` | Habilitar registro por telefono | `true` | auth |
| `ENABLE_PHONE_AUTOCONFIRM` | Auto-confirmar telefonos | `true` | auth |

### 4.7 SMTP (Email)

| Variable | Descripcion | Default | Usado por |
|----------|-------------|---------|-----------|
| `SMTP_ADMIN_EMAIL` | Email del admin | `admin@example.com` | auth |
| `SMTP_HOST` | Servidor SMTP | `supabase-mail` | auth |
| `SMTP_PORT` | Puerto SMTP | `2500` | auth |
| `SMTP_USER` | Usuario SMTP | `fake_mail_user` | auth |
| `SMTP_PASS` | Password SMTP | `fake_mail_password` | auth |
| `SMTP_SENDER_NAME` | Nombre del remitente | `fake_sender` | auth |
| `MAILER_URLPATHS_CONFIRMATION` | Path de confirmacion | `/auth/v1/verify` | auth |
| `MAILER_URLPATHS_INVITE` | Path de invitacion | `/auth/v1/verify` | auth |
| `MAILER_URLPATHS_RECOVERY` | Path de recuperacion | `/auth/v1/verify` | auth |
| `MAILER_URLPATHS_EMAIL_CHANGE` | Path de cambio de email | `/auth/v1/verify` | auth |

### 4.8 OAuth (Opcional - Descomentar en docker-compose.yml)

| Variable | Descripcion | Default |
|----------|-------------|---------|
| `GOOGLE_ENABLED` | Habilitar Google OAuth | `false` |
| `GOOGLE_CLIENT_ID` | Client ID de Google | (vacio) |
| `GOOGLE_SECRET` | Client Secret de Google | (vacio) |
| `GITHUB_ENABLED` | Habilitar GitHub OAuth | `false` |
| `GITHUB_CLIENT_ID` | Client ID de GitHub | (vacio) |
| `GITHUB_SECRET` | Client Secret de GitHub | (vacio) |
| `AZURE_ENABLED` | Habilitar Azure OAuth | `false` |
| `AZURE_CLIENT_ID` | Client ID de Azure | (vacio) |
| `AZURE_SECRET` | Client Secret de Azure | (vacio) |

### 4.9 Storage

| Variable | Descripcion | Default | Usado por |
|----------|-------------|---------|-----------|
| `GLOBAL_S3_BUCKET` | Bucket S3 o nombre de directorio (modo file) | `stub` | storage |
| `REGION` | Region S3 | `stub` | storage, supavisor |
| `STORAGE_TENANT_ID` | Tenant ID de Storage | `stub` | storage |
| `MINIO_ROOT_USER` | Usuario admin MinIO (solo con docker-compose.s3.yml) | `supa-storage` | minio |
| `MINIO_ROOT_PASSWORD` | Password admin MinIO | `secret1234` (min 8) | minio |

### 4.10 Edge Functions

| Variable | Descripcion | Default | Usado por |
|----------|-------------|---------|-----------|
| `FUNCTIONS_VERIFY_JWT` | Verificar JWT en todas las funciones | `false` | functions |

### 4.11 API (PostgREST)

| Variable | Descripcion | Default | Usado por |
|----------|-------------|---------|-----------|
| `PGRST_DB_SCHEMAS` | Schemas expuestos via REST | `public,storage,graphql_public` | rest |

### 4.12 Analytics / Logging

| Variable | Descripcion | Default | Usado por |
|----------|-------------|---------|-----------|
| `DOCKER_SOCKET_LOCATION` | Ubicacion del Docker socket | `/var/run/docker.sock` | vector |
| `GOOGLE_PROJECT_ID` | Para BigQuery backend | (placeholder) | analytics |
| `GOOGLE_PROJECT_NUMBER` | Para BigQuery backend | (placeholder) | analytics |

### 4.13 Kong (API Gateway)

| Variable | Descripcion | Default | Usado por |
|----------|-------------|---------|-----------|
| `KONG_HTTP_PORT` | Puerto HTTP del gateway | `8000` | kong |
| `KONG_HTTPS_PORT` | Puerto HTTPS del gateway | `8443` | kong |

### 4.14 imgproxy

| Variable | Descripcion | Default | Usado por |
|----------|-------------|---------|-----------|
| `IMGPROXY_ENABLE_WEBP_DETECTION` | Habilitar soporte WebP | `true` | imgproxy |

### 4.15 Reverse Proxy (Caddy/Nginx - opcional)

| Variable | Descripcion | Default | Usado por |
|----------|-------------|---------|-----------|
| `PROXY_DOMAIN` | Dominio para el proxy | `your-domain.example.com` | caddy/nginx |
| `CERTBOT_EMAIL` | Email para Let's Encrypt (solo nginx) | `admin@example.com` | nginx |

---

## 5. Volumenes y Persistencia

### 5.1 Bind Mounts (datos persistentes en el host)

| Path en Host | Path en Container | Servicio | Contenido |
|-------------|-------------------|----------|-----------|
| `./volumes/db/data` | `/var/lib/postgresql/data` | db | **PGDATA** - Todos los datos de PostgreSQL |
| `./volumes/storage` | `/var/lib/storage` | storage, imgproxy | Archivos subidos por usuarios |
| `./volumes/functions` | `/home/deno/functions` (functions), `/app/edge-functions` (studio) | functions, studio | Codigo de Edge Functions |
| `./volumes/snippets` | `/app/snippets` | studio | SQL snippets guardados |

### 5.2 Bind Mounts (configuracion, read-only)

| Path en Host | Path en Container | Servicio | Contenido |
|-------------|-------------------|----------|-----------|
| `./volumes/api/kong.yml` | `/home/kong/temp.yml` | kong | Template de configuracion de Kong |
| `./volumes/logs/vector.yml` | `/etc/vector/vector.yml` | vector | Configuracion de Vector |
| `./volumes/pooler/pooler.exs` | `/etc/pooler/pooler.exs` | supavisor | Configuracion de Supavisor |
| `./volumes/db/realtime.sql` | `/docker-entrypoint-initdb.d/migrations/99-realtime.sql` | db | Migracion Realtime |
| `./volumes/db/webhooks.sql` | `/docker-entrypoint-initdb.d/init-scripts/98-webhooks.sql` | db | Migracion Webhooks |
| `./volumes/db/roles.sql` | `/docker-entrypoint-initdb.d/init-scripts/99-roles.sql` | db | Creacion de roles |
| `./volumes/db/jwt.sql` | `/docker-entrypoint-initdb.d/init-scripts/99-jwt.sql` | db | Configuracion JWT en DB |
| `./volumes/db/_supabase.sql` | `/docker-entrypoint-initdb.d/migrations/97-_supabase.sql` | db | Schema interno _supabase |
| `./volumes/db/logs.sql` | `/docker-entrypoint-initdb.d/migrations/99-logs.sql` | db | Soporte de Analytics |
| `./volumes/db/pooler.sql` | `/docker-entrypoint-initdb.d/migrations/99-pooler.sql` | db | Soporte de Supavisor |

### 5.3 Named Volumes (gestionados por Docker)

| Volumen | Servicio | Contenido |
|---------|----------|-----------|
| `db-config` | db | pgsodium decryption key |
| `deno-cache` | functions | Cache de Deno (modulos descargados) |

### 5.4 Estrategia de Backup

**Datos criticos a respaldar:**

1. **PostgreSQL** (`./volumes/db/data`):
   - `pg_dump` para backup logico (recomendado)
   - Snapshot de volumen para backup fisico
   - Separar: `pg_dumpall --roles-only` (roles) + `pg_dump --schema-only` (schema) + `pg_dump --data-only` (datos)

2. **Storage** (`./volumes/storage`):
   - Copia directa del directorio (modo file)
   - Si usas S3 backend, los archivos estan en el bucket S3

3. **Edge Functions** (`./volumes/functions`):
   - Deben estar en control de versiones (git)

4. **Named Volumes** (`db-config`):
   - `docker run --rm -v supabase_db-config:/data -v $(pwd):/backup alpine tar czf /backup/db-config.tar.gz /data`

**Ejemplo de script de backup:**
```bash
#!/bin/bash
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 1. Backup PostgreSQL
docker exec supabase-db pg_dumpall -U postgres > "$BACKUP_DIR/full_dump.sql"

# 2. Backup Storage
tar czf "$BACKUP_DIR/storage.tar.gz" ./volumes/storage/

# 3. Backup config
cp .env "$BACKUP_DIR/.env.backup"
tar czf "$BACKUP_DIR/configs.tar.gz" ./volumes/api/ ./volumes/logs/ ./volumes/pooler/

echo "Backup completado en $BACKUP_DIR"
```

---

## 6. Requisitos del Sistema

### Minimos (desarrollo / sitios pequenos)

| Recurso | Minimo | Notas |
|---------|--------|-------|
| **CPU** | 2 cores | Suficiente para desarrollo |
| **RAM** | 4 GB | Limite real, puede ser inestable |
| **Disco** | 50 GB SSD | Incluye imagenes Docker (~8GB) |
| **Docker** | Engine 20.10+ | Requerido |
| **Compose** | V2 | Requerido (no V1 legacy) |

### Recomendados (produccion)

| Recurso | Recomendado | Notas |
|---------|-------------|-------|
| **CPU** | 4+ cores | 8 cores para trafico alto |
| **RAM** | 8 GB | 16 GB para proyectos medianos/grandes |
| **Disco** | 80+ GB SSD | NVMe preferido. Escala segun datos |
| **SO** | Ubuntu 22.04+ / Debian 12+ | Linux recomendado |

### Consumo aproximado por servicio

| Servicio | RAM Idle | RAM Bajo Carga | CPU Idle |
|----------|----------|----------------|----------|
| PostgreSQL | ~200 MB | 500 MB - 2 GB | Bajo |
| GoTrue | ~50 MB | ~150 MB | Bajo |
| PostgREST | ~30 MB | ~100 MB | Bajo |
| Realtime | ~150 MB | ~500 MB | Medio |
| Storage | ~50 MB | ~200 MB | Bajo |
| Studio | ~200 MB | ~500 MB | Medio |
| Kong | ~100 MB | ~200 MB | Bajo |
| Analytics (Logflare) | ~300 MB | ~800 MB | **Alto** |
| Vector | ~50 MB | ~150 MB | Bajo |
| imgproxy | ~50 MB | ~300 MB | Medio (transformaciones) |
| Edge Runtime | ~100 MB | ~300 MB | Bajo |
| Supavisor | ~100 MB | ~300 MB | Bajo |
| **TOTAL** | **~1.4 GB** | **~3.5 GB+** | -- |

**NOTA:** Analytics (Logflare) es el servicio que mas recursos consume. Si no necesitas logging avanzado, es candidato a desactivar para reducir consumo.

### Servicios opcionales (se pueden desactivar)

Para reducir consumo de recursos, estos servicios se pueden eliminar del docker-compose.yml:
- **Analytics (Logflare)** + **Vector** - Logging (~400 MB ahorrados)
- **Edge Functions** - Si no usas funciones serverless (~100 MB)
- **imgproxy** - Si no necesitas transformacion de imagenes (~50 MB)
- **Studio** - Si administras via CLI o API directa (~200 MB)

---

## 7. Orden de Arranque y Dependencias

```
vector (primero - logging)
   |
   v
db (PostgreSQL - espera healthcheck de vector)
   |
   v
analytics (Logflare - espera healthcheck de db)
   |
   +---> auth (GoTrue - espera db + analytics)
   +---> rest (PostgREST - espera db + analytics)
   +---> realtime (espera db + analytics)
   +---> meta (postgres-meta - espera db + analytics)
   +---> kong (espera analytics)
   +---> functions (Edge Runtime - espera analytics)
   +---> supavisor (espera db + analytics)
   |
   +---> storage (espera db + rest + imgproxy)
   |        |
   |        +---> imgproxy (sin dependencias)
   |
   +---> studio (espera analytics)
```

### Proceso del primer arranque

1. **Vector** arranca primero (recolector de logs)
2. **PostgreSQL** arranca y ejecuta scripts de inicializacion en orden:
   - `/docker-entrypoint-initdb.d/migrations/97-_supabase.sql` - Schema interno
   - `/docker-entrypoint-initdb.d/init-scripts/98-webhooks.sql` - Event triggers
   - `/docker-entrypoint-initdb.d/init-scripts/99-roles.sql` - Crea roles (anon, authenticated, service_role, supabase_admin, etc.)
   - `/docker-entrypoint-initdb.d/init-scripts/99-jwt.sql` - Configura JWT_SECRET y JWT_EXP en settings
   - `/docker-entrypoint-initdb.d/migrations/99-realtime.sql` - Schema _realtime
   - `/docker-entrypoint-initdb.d/migrations/99-logs.sql` - Schema _analytics
   - `/docker-entrypoint-initdb.d/migrations/99-pooler.sql` - Config Supavisor
3. **Analytics** se conecta a `_supabase` database, crea schema `_analytics`
4. **Todos los demas servicios** arrancan en paralelo una vez db + analytics estan healthy
5. **Kong** carga `kong.yml` con env vars sustituidas, empieza a enrutar trafico
6. **Supavisor** ejecuta migraciones, carga config de pooler, inicia server

**IMPORTANTE:** Los scripts en `/docker-entrypoint-initdb.d/` SOLO se ejecutan la primera vez (cuando `./volumes/db/data` esta vacio). En arranques posteriores, PostgreSQL usa los datos existentes.

### Roles de base de datos creados automaticamente

| Rol | Privilegio | Usado por |
|-----|-----------|-----------|
| `postgres` | Superuser | Administracion directa |
| `supabase_admin` | Admin interno | Analytics, Meta, Realtime, Supavisor |
| `supabase_auth_admin` | Admin de auth | GoTrue (Auth) |
| `supabase_storage_admin` | Admin de storage | Storage API |
| `authenticator` | Role-switching user | PostgREST (cambia a anon/authenticated/service_role) |
| `anon` | Acceso publico (RLS) | Requests con ANON_KEY |
| `authenticated` | Usuarios logueados (RLS) | Requests con token de usuario |
| `service_role` | Bypass RLS | Requests con SERVICE_ROLE_KEY |

---

## 8. Routing de Kong (API Gateway)

Kong usa un archivo declarativo (`kong.yml`) que se genera al arranque sustituyendo env vars:

| Path Externo | Servicio Interno | Autenticacion | Roles Permitidos |
|-------------|------------------|---------------|-----------------|
| `/auth/v1/*` | GoTrue `:9999` | JWT (key-auth) | admin, anon |
| `/rest/v1/*` | PostgREST `:3000` | JWT (key-auth) | admin, anon |
| `/realtime/v1/` | Realtime `:4000` | JWT (key-auth) | admin, anon |
| `/storage/v1/*` | Storage `:5000` | Auto-gestionada | N/A |
| `/functions/v1/*` | Edge Functions `:9000` | Ninguna | Todos |
| `/analytics/v1/*` | Logflare `:4000` | Ninguna | Todos |
| `/pg/*` | postgres-meta `:8080` | JWT (key-auth) | **solo admin** |
| `/*` (catch-all) | Studio `:3000` | HTTP Basic Auth | Todos |

**Plugins activos de Kong:**
- `request-transformer` - Transforma requests
- `cors` - Cross-Origin Resource Sharing
- `key-auth` - Autenticacion por API key (JWT)
- `acl` - Control de acceso por roles
- `basic-auth` - Para acceso a Studio
- `request-termination` - Bloquea rutas
- `ip-restriction` - Restriccion por IP

---

## 9. Actualizaciones

### Proceso de actualizacion

```bash
# 1. Backup ANTES de actualizar
./backup.sh

# 2. Descargar ultimas imagenes
cd /path/to/supabase/docker
git pull origin master  # O actualizar manualmente las versiones en docker-compose.yml

# 3. Pull de nuevas imagenes
docker compose pull

# 4. Reiniciar servicios (causa downtime)
docker compose down
docker compose up -d

# 5. Verificar salud
docker compose ps
docker compose logs -f --tail=50
```

### Advertencias criticas sobre actualizaciones

1. **Las migraciones SQL NO se re-ejecutan** si `./volumes/db/data` ya existe. Esto significa que los scripts en `/docker-entrypoint-initdb.d/` solo corren la primera vez. Cualquier cambio de schema entre versiones requiere migracion manual.

2. **No hay sistema de migracion automatico** para self-hosted. A diferencia de Supabase Cloud, las actualizaciones de schema deben aplicarse manualmente.

3. **Verificar CHANGELOG** antes de actualizar: `docker/CHANGELOG.md` en el repo oficial (experimental, puede estar incompleto).

4. **Releases mensuales** estables. Se publican aproximadamente una vez al mes.

5. **Downtime inevitable** durante actualizaciones. No hay soporte nativo para zero-downtime updates.

---

## 10. Features NO Disponibles en Self-Hosted

### Completamente ausentes

| Feature | Disponible en Cloud | Disponible Self-Hosted | Notas |
|---------|--------------------|-----------------------|-------|
| **Backups automaticos / PITR** | Si | No | Requiere implementar pg_dump/WAL archiving manualmente |
| **Auto-scaling** | Si | No | Escalado manual de recursos |
| **Multi-region replication** | Si | No | Requiere setup manual con streaming replication |
| **Branch databases** | Si | No | Feature del platform managed |
| **Read replicas** | Si | No | Configuracion manual de PostgreSQL replication |
| **Dashboard: config OAuth via UI** | Si | No | Config via env vars en docker-compose.yml |
| **Dashboard: email templates UI** | Si | No | Montar templates custom en container |
| **Dashboard: backup/restore UI** | Si | No | CLI o scripts manuales |
| **Dashboard: SQL snippets guardados** | Parcial | Limitado | Via volumen montado |
| **Telemetria / Observabilidad avanzada** | Si | Basica | Logflare local tiene limitaciones |
| **Soporte oficial** | Si (pagado) | No | Solo comunidad (GitHub, Discord) |
| **Multiple projects** | Si | No | Un stack = un proyecto |
| **Custom domains (automatico)** | Si | Manual | Configurar reverse proxy manualmente |
| **Cron job status real** | Si | Limitado | Siempre muestra "Succeeded" |
| **Edge Functions UI listing** | Si | No | No hay UI para listar funciones |
| **Uso de Vault (secrets)** | Si | Limitado | pgsodium disponible pero config manual |

### Funcionalidad completa en self-hosted

| Feature | Estado |
|---------|--------|
| Auth (email, phone, OAuth via env) | Completo |
| RLS (Row Level Security) | Completo |
| PostgREST (REST API) | Completo |
| Realtime (subscriptions) | Completo |
| Storage (file + S3 backend) | Completo |
| Edge Functions (Deno) | Completo |
| pgvector (embeddings) | Completo (extension disponible) |
| Supavisor (connection pooling) | Completo |
| Studio (dashboard basico) | Completo (sin features cloud) |
| imgproxy (image transforms) | Completo |

---

## 11. Checklist de Primer Arranque

### Pre-requisitos

- [ ] Docker Engine 20.10+ instalado
- [ ] Docker Compose V2 instalado
- [ ] VPS con minimo 4GB RAM (8GB recomendado)
- [ ] 50GB+ SSD disponible
- [ ] Dominio apuntando al servidor (DNS A record)
- [ ] Puertos 80, 443, 8000 disponibles

### Setup inicial

```bash
# 1. Clonar repositorio
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# 2. Copiar .env.example
cp .env.example .env

# 3. Generar secretos (opcion A: script oficial)
sh ./utils/generate-keys.sh

# 3. Generar secretos (opcion B: manual con OpenSSL)
openssl rand -base64 32  # Para JWT_SECRET
openssl rand -hex 32     # Para VAULT_ENC_KEY, tokens, etc.
```

### Configurar .env

- [ ] Cambiar `POSTGRES_PASSWORD` (alfanumerico, fuerte)
- [ ] Generar y establecer `JWT_SECRET` (min 32 chars)
- [ ] Generar `ANON_KEY` y `SERVICE_ROLE_KEY` (JWTs firmados con JWT_SECRET)
- [ ] Cambiar `SECRET_KEY_BASE` (min 64 chars)
- [ ] Cambiar `VAULT_ENC_KEY` (exactamente 32 chars)
- [ ] Cambiar `PG_META_CRYPTO_KEY` (min 32 chars)
- [ ] Cambiar `LOGFLARE_PUBLIC_ACCESS_TOKEN` y `LOGFLARE_PRIVATE_ACCESS_TOKEN`
- [ ] Cambiar `S3_PROTOCOL_ACCESS_KEY_ID` y `S3_PROTOCOL_ACCESS_KEY_SECRET`
- [ ] Cambiar `DASHBOARD_USERNAME` (solo letras) y `DASHBOARD_PASSWORD`
- [ ] Cambiar `POOLER_TENANT_ID` (identificador unico)
- [ ] Configurar `SUPABASE_PUBLIC_URL` con tu dominio (ej: `https://supabase.tudominio.com`)
- [ ] Configurar `API_EXTERNAL_URL` con tu dominio
- [ ] Configurar `SITE_URL` con la URL de tu app frontend
- [ ] Configurar SMTP real (recomendado: AWS SES, Resend, Mailgun)

### Arrancar

```bash
# 4. Pull de imagenes
docker compose pull

# 5. Arrancar servicios
docker compose up -d

# 6. Verificar estado (esperar ~1 minuto para estabilizar)
docker compose ps

# 7. Verificar logs por errores
docker compose logs -f --tail=100

# 8. Acceder a Studio
# http://localhost:8000 (o tu dominio)
# Login con DASHBOARD_USERNAME / DASHBOARD_PASSWORD
```

### Post-arranque

- [ ] Verificar que todos los servicios estan `healthy` o `running`
- [ ] Acceder a Studio y verificar que conecta a la DB
- [ ] Probar autenticacion (crear usuario de prueba)
- [ ] Probar REST API: `curl http://localhost:8000/rest/v1/ -H "apikey: TU_ANON_KEY"`
- [ ] Configurar reverse proxy (Caddy/Nginx) para HTTPS
- [ ] Configurar firewall (solo exponer 80/443, cerrar 8000/5432/6543)
- [ ] Configurar backups automaticos (cron + pg_dump)
- [ ] NO exponer puertos de Supavisor (5432/6543) al exterior sin firewall

### HTTPS con Caddy (recomendado)

```bash
# Usar overlay de Caddy
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d
```

Requiere:
- `PROXY_DOMAIN` en `.env` apuntando a tu dominio
- DNS A record configurado

### HTTPS con Nginx

```bash
docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d
```

Requiere:
- `PROXY_DOMAIN` y `CERTBOT_EMAIL` en `.env`
- DNS A record configurado

---

## 12. Problemas Conocidos y Workarounds

### Analytics (Logflare) consume excesivos recursos

**Problema:** Logflare puede consumir mucha CPU/RAM y a veces falla al arrancar.
**Workaround:** Si no necesitas analytics avanzados, puedes eliminarlo del compose. Requiere tambien eliminar las dependencias `analytics: condition: service_healthy` de los otros servicios.

### Migraciones no se re-ejecutan en upgrades

**Problema:** Los scripts SQL en `/docker-entrypoint-initdb.d/` solo corren la primera vez.
**Workaround:** Aplicar cambios de schema manualmente con `docker exec supabase-db psql -U postgres < migration.sql`.

### Generador de tokens JWT oficial no funciona

**Problema:** La herramienta oficial para generar ANON_KEY/SERVICE_ROLE_KEY puede fallar.
**Workaround:** Usar jwt.io manualmente:
- Algoritmo: HS256
- Payload para ANON_KEY: `{"role": "anon", "iss": "supabase", "iat": 1641769200, "exp": 1799535600}`
- Payload para SERVICE_ROLE_KEY: `{"role": "service_role", "iss": "supabase", "iat": 1641769200, "exp": 1799535600}`
- Secret: tu `JWT_SECRET`

### Permission denied en NAS/sistemas con UIDs custom

**Problema:** PostgreSQL requiere UID 105:106, Kong requiere 1000:1000.
**Workaround:** Configurar permisos antes de arrancar:
```bash
chown -R 105:106 ./volumes/db/data
chown -R 1000:1000 ./volumes/api
```

### "permission denied for schema public" en SQL Editor

**Workaround:**
```sql
-- Conectar como supabase_admin
GRANT CREATE ON SCHEMA public TO postgres;
```

---

## 13. Integracion con Nuestro Stack (POD AI Store)

### Consideraciones para la migracion desde Supabase Cloud

1. **Caddy ya esta en nuestro stack** - Reutilizar como reverse proxy para Supabase
2. **Redis ya existe** - No conflicto, Supabase no usa Redis
3. **Puertos a reservar**: 8000 (Kong), 5432 (Supavisor session), 6543 (Supavisor transaction)
4. **Consumo total estimado**: ~4 GB RAM adicionales (Supabase) + ~2 GB (nuestro stack actual) = ~6 GB minimo
5. **Recomendacion**: VPS con 8-16 GB RAM para produccion con ambos stacks

### Cambios necesarios en el codigo

1. **Variables de entorno**: Cambiar `NEXT_PUBLIC_SUPABASE_URL` de cloud a `http://kong:8000` (o dominio propio)
2. **SUPABASE_SERVICE_KEY** sigue siendo el mismo concepto, solo cambia el valor del JWT
3. **Conexion directa a PG**: Cambiar de `db.xxxxx.supabase.co:5432` a `localhost:5432` (via Supavisor)

### Networking Docker

Si Supabase y nuestro stack comparten la misma maquina, se necesita una red Docker compartida:
```yaml
# En nuestro docker-compose.yml
networks:
  supabase:
    external: true
    name: supabase_default
```

---

## Fuentes

- [Documentacion oficial: Self-Hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Documentacion oficial: Self-Hosting overview](https://supabase.com/docs/guides/self-hosting)
- [GitHub: docker-compose.yml](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml)
- [GitHub: .env.example](https://github.com/supabase/supabase/blob/master/docker/.env.example)
- [GitHub Discussion: Self-hosting what's working and not](https://github.com/orgs/supabase/discussions/39820)
- [GitHub Discussion: Feature parity cloud vs self-hosted](https://github.com/orgs/supabase/discussions/40583)
- [GitHub Discussion: Lack of features in self-host](https://github.com/orgs/supabase/discussions/12151)
- [DeepWiki: Self-Hosted Deployment](https://deepwiki.com/supabase/supabase/3-self-hosted-deployment)
- [The Ultimate Supabase Self-Hosting Guide](https://blog.activeno.de/the-ultimate-supabase-self-hosting-guide)
- [Supabase Troubleshooting: Features in self-hosted](https://supabase.com/docs/guides/troubleshooting/are-all-features-available-in-self-hosted-supabase-THPcqw)
